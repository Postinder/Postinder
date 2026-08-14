import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { resolvePostRevisionTestDatabase } from '../../testing/postRevisionTestDatabase'

const enabled = process.env.PORTAL_APPROVAL_INTEGRATION === '1'
const databaseConfig = enabled ? resolvePostRevisionTestDatabase(process.env) : { enabled: false as const }
const integrationTest = enabled ? test : test.skip
const companyId = '10000000-0000-4000-8000-000000000001'
let sequence = 0
let pool: any
let query: any
let PlatformSettingsService: any
let PortalRepository: any
let PostRepository: any
let SoundtrackRepository: any

before(async () => {
  if (!enabled) return
  if (!databaseConfig.enabled || !databaseConfig.databaseUrl) {
    throw new Error('The isolated portal approval database was not configured')
  }
  process.env.DATABASE_URL = databaseConfig.databaseUrl
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET ||= 'portal-approval-integration-only'
  const [poolModule, settingsModule, portalModule, postModule, soundtrackModule] = await Promise.all([
    import('../../shared/database/pool'),
    import('../platformSettings/application/PlatformSettingsService'),
    import('./infrastructure/repositories/PortalRepository'),
    import('../posts/infrastructure/repositories/PostRepository'),
    import('../soundtracks/infrastructure/repositories/SoundtrackRepository'),
  ])
  pool = poolModule.pool
  query = poolModule.query
  PlatformSettingsService = settingsModule.PlatformSettingsService
  PortalRepository = portalModule.PortalRepository
  PostRepository = postModule.PostRepository
  SoundtrackRepository = soundtrackModule.SoundtrackRepository
})

async function setSettings(approvalMode: 'content' | 'item', soundtrack = false) {
  await new PlatformSettingsService().update({
    portal: { approval_mode: approvalMode },
    features: { soundtrack },
  })
}

async function seedPost(input: {
  status?: string
  files?: Array<{ status?: string; fileType?: string }>
  emailLink?: string | null
  soundtrack?: { mode: string; status: string } | null
  } = {}) {
  sequence += 1
  const targetStatus = input.status || 'sent'
  const client = await query(
    `INSERT INTO clients (email, name, password_hash, company_id)
     VALUES ($1, $2, 'audit-password', $3)
     RETURNING id`,
    [`portal-audit-${sequence}@example.test`, `Portal audit ${sequence}`, companyId],
  )
  const post = await query(
    `INSERT INTO posts (client_id, company_id, title, status, channels, email_link, submitted_at, content_revision)
     VALUES ($1, $2, $3, 'ready', $4, $5, NOW(), 1)
     RETURNING id`,
    [
      client.rows[0].id,
      companyId,
      `Audit post ${sequence}`,
      input.emailLink ? ['E-mail Marketing'] : ['Instagram'],
      input.emailLink || null,
    ],
  )
  const files = []
  for (const [index, file] of (input.files || []).entries()) {
    const result = await query(
      `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [post.rows[0].id, `https://example.test/${sequence}/${index}`, `asset-${index}`, file.fileType || 'IMAGE', file.status || 'pending', index + 1],
    )
    files.push(result.rows[0])
  }
  if (input.soundtrack) {
    await query(
      `INSERT INTO post_soundtracks (post_id, mode, approval_status, external_url)
       VALUES ($1, $2, $3, 'https://example.test/audio')`,
      [post.rows[0].id, input.soundtrack.mode, input.soundtrack.status],
    )
  }
  if (targetStatus !== 'ready') {
    await query(
      `UPDATE posts SET status = $2, updated_at = NOW() WHERE id = $1`,
      [post.rows[0].id, targetStatus],
    )
  }
  return { clientId: client.rows[0].id, postId: post.rows[0].id, files }
}

beforeEach(async () => {
  if (!enabled) return
  await query('TRUNCATE TABLE clients RESTART IDENTITY CASCADE')
  await setSettings('content', false)
})

after(async () => {
  if (enabled) await pool.end()
})

integrationTest('draft churn has no official side effects and only final snapshots affect current metrics', async () => {
  await setSettings('item')
  const seeded = await seedPost({ files: [{}, {}, { fileType: 'VIDEO' }] })
  const scope = { clientId: seeded.clientId, companyId }
  const repository = new PortalRepository(new PlatformSettingsService())
  const [a, b, c] = seeded.files.map(file => file.id)

  await repository.saveItemDecision(seeded.postId, a, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, a, { decision: 'rejected', comment: 'A1' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, a, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, b, { decision: 'rejected', comment: 'B1' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, b, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, c, { decision: 'rejected', comment: 'C1' }, scope, 1)

  const provisional = await query(
    `SELECT p.status,
            COUNT(f.id) FILTER (WHERE f.status = 'pending')::int AS pending_files,
            (SELECT COUNT(*)::int FROM feedback WHERE post_id = p.id) AS feedback_count,
            (SELECT COUNT(*)::int FROM activity_events WHERE post_id = p.id) AS activity_count
     FROM posts p JOIN files f ON f.post_id = p.id
     WHERE p.id = $1 GROUP BY p.id`,
    [seeded.postId],
  )
  assert.deepEqual(provisional.rows[0], { status: 'sent', pending_files: 3, feedback_count: 0, activity_count: 0 })

  const first = await repository.completeItemReview(seeded.postId, scope, 1)
  assert.equal(first.kind, 'completed')
  assert.equal(first.status, 'rejected')
  assert.deepEqual(first.snapshot.map((item: any) => item.decision), ['approved', 'approved', 'rejected'])
  const retry = await repository.completeItemReview(seeded.postId, scope, 1)
  assert.equal(retry.kind, 'already_completed')

  assert.equal((await repository.reopenPost(seeded.postId, scope, 1)).kind, 'reopened')
  await repository.saveItemDecision(seeded.postId, a, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, b, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, c, { decision: 'approved' }, scope, 1)
  const second = await repository.completeItemReview(seeded.postId, scope, 1)
  assert.equal(second.kind, 'completed')
  assert.equal(second.status, 'approved')

  const official = await query(
    `SELECT p.status, r.revision, r.completed_status, r.rewind_used,
            (SELECT COUNT(*)::int FROM feedback WHERE post_id = p.id) AS feedback_count
     FROM posts p JOIN portal_post_reviews r ON r.post_id = p.id WHERE p.id = $1`,
    [seeded.postId],
  )
  assert.deepEqual(official.rows[0], {
    status: 'approved', revision: 2, completed_status: 'approved', rewind_used: true, feedback_count: 1,
  })
  assert.equal(await repository.reopenPost(seeded.postId, scope, 1), false)
})

integrationTest('completion is idempotent under simultaneous requests', async () => {
  await setSettings('item')
  const seeded = await seedPost({ files: [{}, {}] })
  const scope = { clientId: seeded.clientId, companyId }
  const repository = new PortalRepository(new PlatformSettingsService())
  for (const file of seeded.files) {
    await repository.saveItemDecision(seeded.postId, file.id, { decision: 'approved' }, scope, 1)
  }
  const results = await Promise.all([
    repository.completeItemReview(seeded.postId, scope, 1),
    repository.completeItemReview(seeded.postId, scope, 1),
  ])
  assert.deepEqual(results.map(result => result.kind).sort(), ['already_completed', 'completed'])
  const state = await query(
    `SELECT r.revision,
            (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback_count
     FROM portal_post_reviews r WHERE r.post_id = $1`,
    [seeded.postId],
  )
  assert.deepEqual(state.rows[0], { revision: 1, feedback_count: 0 })
})

integrationTest('approved rewind rejected replaces the current metric without duplicate official completion', async () => {
  await setSettings('item')
  const seeded = await seedPost({ files: [{}, {}] })
  const scope = { clientId: seeded.clientId, companyId }
  const repository = new PortalRepository(new PlatformSettingsService())
  for (const file of seeded.files) {
    await repository.saveItemDecision(seeded.postId, file.id, { decision: 'approved' }, scope, 1)
  }
  assert.equal((await repository.completeItemReview(seeded.postId, scope, 1)).status, 'approved')
  assert.equal((await repository.reopenPost(seeded.postId, scope, 1)).kind, 'reopened')
  await repository.saveItemDecision(seeded.postId, seeded.files[0].id, { decision: 'approved' }, scope, 1)
  await repository.saveItemDecision(seeded.postId, seeded.files[1].id, { decision: 'rejected', comment: 'final rejection' }, scope, 1)
  assert.equal((await repository.completeItemReview(seeded.postId, scope, 1)).status, 'rejected')

  const state = await query(
    `SELECT p.status, r.revision, r.completed_status,
            (SELECT COUNT(*)::int FROM feedback WHERE post_id = p.id) AS feedback_count
     FROM posts p JOIN portal_post_reviews r ON r.post_id = p.id WHERE p.id = $1`,
    [seeded.postId],
  )
  assert.deepEqual(state.rows[0], {
    status: 'rejected', revision: 2, completed_status: 'rejected', feedback_count: 1,
  })
})

integrationTest('a draft save cannot cross a concurrent post completion boundary', async () => {
  await setSettings('item')
  const seeded = await seedPost({ files: [{}] })
  const scope = { clientId: seeded.clientId, companyId }
  const repository = new PortalRepository(new PlatformSettingsService())
  const blocker = await pool.connect()
  await blocker.query('BEGIN')
  await blocker.query('SELECT id FROM posts WHERE id = $1 FOR UPDATE', [seeded.postId])

  let settled = false
  const saving = repository.saveItemDecision(
    seeded.postId,
    seeded.files[0].id,
    { decision: 'approved' },
    scope,
    1,
  ).finally(() => { settled = true })
  await new Promise(resolve => setTimeout(resolve, 100))
  const saveWaitedForPostLock = !settled
  await blocker.query("UPDATE posts SET status = 'approved' WHERE id = $1", [seeded.postId])
  await blocker.query('COMMIT')
  blocker.release()

  const saveResult = await saving
  assert.equal(saveWaitedForPostLock, true)
  assert.equal(saveResult.kind, 'revision_conflict')
  const drafts = await query('SELECT COUNT(*)::int AS count FROM portal_item_review_drafts WHERE post_id = $1', [seeded.postId])
  assert.equal(drafts.rows[0].count, 0)
})

integrationTest('content completion discards obsolete item drafts and waits for an applicable soundtrack', async () => {
  await setSettings('item')
  const seeded = await seedPost({ files: [{}] })
  const scope = { clientId: seeded.clientId, companyId }
  const repository = new PortalRepository(new PlatformSettingsService())
  await repository.saveItemDecision(seeded.postId, seeded.files[0].id, { decision: 'rejected', comment: 'old draft' }, scope, 1)
  await setSettings('content')
  assert.equal((await repository.approvePost(seeded.postId, scope, 1)).kind, 'completed')
  const drafts = await query('SELECT COUNT(*)::int AS count FROM portal_item_review_drafts WHERE post_id = $1', [seeded.postId])
  assert.equal(drafts.rows[0].count, 0)

  await setSettings('content', true)
  const withSoundtrack = await seedPost({
    files: [{}],
    soundtrack: { mode: 'external_reference', status: 'pending' },
  })
  const blocked = await repository.approvePost(withSoundtrack.postId, { clientId: withSoundtrack.clientId, companyId }, 1)
  assert.equal(blocked.kind, 'soundtrack_incomplete')
  const unchanged = await query('SELECT status FROM posts WHERE id = $1', [withSoundtrack.postId])
  assert.equal(unchanged.rows[0].status, 'sent')
})

integrationTest('content mode creates one official decision for mixed image and video files', async () => {
  await setSettings('content')
  const repository = new PortalRepository(new PlatformSettingsService())
  for (const decision of ['approved', 'rejected'] as const) {
    const seeded = await seedPost({ files: [{ fileType: 'IMAGE' }, { fileType: 'VIDEO' }, { fileType: 'IMAGE' }] })
    const scope = { clientId: seeded.clientId, companyId }
    const result = decision === 'approved'
      ? await repository.approvePost(seeded.postId, scope, 1)
      : await repository.rejectPost(seeded.postId, 'one content rejection', ['Vídeo'], scope, 1)
    assert.equal(result.kind, 'completed')
    assert.equal(result.status, decision)
    const state = await query(
      `SELECT p.status, r.revision, r.completed_status,
              COUNT(f.id)::int AS file_count,
              COUNT(f.id) FILTER (WHERE f.status = $2)::int AS decided_files,
              (SELECT COUNT(*)::int FROM feedback WHERE post_id = p.id) AS feedback_count
       FROM posts p JOIN files f ON f.post_id = p.id
       JOIN portal_post_reviews r ON r.post_id = p.id
       WHERE p.id = $1 GROUP BY p.id, r.revision, r.completed_status`,
      [seeded.postId, decision],
    )
    assert.deepEqual(state.rows[0], {
      status: decision,
      revision: 1,
      completed_status: decision,
      file_count: 3,
      decided_files: 3,
      feedback_count: decision === 'rejected' ? 1 : 0,
    })
  }
})

integrationTest('soundtrack decisions remain subordinate and cannot conclude item review', async () => {
  await setSettings('item', true)
  const seeded = await seedPost({
    files: [{}, {}],
    soundtrack: { mode: 'external_reference', status: 'pending' },
  })
  const scope = { clientId: seeded.clientId, companyId }
  const soundtrackRepository = new SoundtrackRepository()
  const repository = new PortalRepository(new PlatformSettingsService())
  const soundtrack = await soundtrackRepository.decide(
    seeded.postId,
    'approved',
    null,
    scope,
    'client_portal',
    1,
    { recalculatePostStatus: false },
  )
  assert.equal(soundtrack?.approvalStatus, 'approved')
  assert.equal((await query('SELECT status FROM posts WHERE id = $1', [seeded.postId])).rows[0].status, 'sent')
  assert.equal((await repository.completeItemReview(seeded.postId, scope, 1)).kind, 'incomplete')
  for (const file of seeded.files) {
    await repository.saveItemDecision(seeded.postId, file.id, { decision: 'approved' }, scope, 1)
  }
  assert.equal((await repository.completeItemReview(seeded.postId, scope, 1)).status, 'approved')
})

integrationTest('agency resubmission removes the obsolete draft of each reset rejected file', async () => {
  await setSettings('item')
  const seeded = await seedPost({ status: 'rejected', files: [{ status: 'rejected' }, { status: 'approved' }] })
  await query(
    `INSERT INTO portal_item_review_drafts (post_id, file_id, content_revision, decision, rejection_reason)
     VALUES ($1, $2, 1, 'rejected', 'old'), ($1, $3, 1, 'approved', NULL)`,
    [seeded.postId, seeded.files[0].id, seeded.files[1].id],
  )
  const repository = new PostRepository()
  assert.equal(await repository.resubmit(seeded.postId, {}, companyId, false), true)
  const drafts = await query(
    'SELECT file_id, decision FROM portal_item_review_drafts WHERE post_id = $1 ORDER BY file_id',
    [seeded.postId],
  )
  assert.deepEqual(drafts.rows, [])
})

integrationTest('batch submission sends only reviewable eligible posts and clears stale drafts atomically', async () => {
  await setSettings('item')
  const rejected = await seedPost({ status: 'rejected', files: [{ status: 'rejected' }] })
  const empty = await seedPost({ status: 'ready' })
  const email = await seedPost({ status: 'ready', emailLink: 'https://example.test/email-preview' })
  await query(
    `INSERT INTO portal_item_review_drafts (post_id, file_id, content_revision, decision, rejection_reason)
     VALUES ($1, $2, 1, 'rejected', 'old batch draft')`,
    [rejected.postId, rejected.files[0].id],
  )
  const repository = new PostRepository()
  const sent = await repository.submitManyForApproval(
    [rejected.postId, empty.postId, email.postId],
    companyId,
    false,
  )
  assert.deepEqual(new Set(sent.map((post: any) => post.id)), new Set([email.postId]))
  const states = await query(
    `SELECT id, status FROM posts WHERE id = ANY($1::uuid[]) ORDER BY id`,
    [[rejected.postId, empty.postId, email.postId]],
  )
  assert.equal(states.rows.find((post: any) => post.id === rejected.postId).status, 'rejected')
  assert.equal(states.rows.find((post: any) => post.id === empty.postId).status, 'ready')
  assert.equal(states.rows.find((post: any) => post.id === email.postId).status, 'sent')
  assert.equal((await query('SELECT COUNT(*)::int AS count FROM portal_item_review_drafts WHERE post_id = $1', [rejected.postId])).rows[0].count, 1)
})

integrationTest('email-only content remains a single review item in either approval mode', async () => {
  const repository = new PortalRepository(new PlatformSettingsService())
  for (const mode of ['content', 'item'] as const) {
    await setSettings(mode)
    const seeded = await seedPost({ emailLink: 'https://example.test/email-preview' })
    const result = await repository.approvePost(seeded.postId, { clientId: seeded.clientId, companyId }, 1)
    assert.equal(result.kind, 'completed')
    const reviews = await query('SELECT revision FROM portal_post_reviews WHERE post_id = $1', [seeded.postId])
    assert.equal(reviews.rows.length, 1)
    assert.equal(reviews.rows[0].revision, 1)
  }
})

integrationTest('an email-only agency resubmission starts a fresh rewind cycle', async () => {
  await setSettings('content')
  const seeded = await seedPost({ emailLink: 'https://example.test/email-preview' })
  const scope = { clientId: seeded.clientId, companyId }
  const portalRepository = new PortalRepository(new PlatformSettingsService())
  const postRepository = new PostRepository()
  assert.equal((await portalRepository.rejectPost(seeded.postId, 'first rejection', [], scope, 1)).status, 'rejected')
  assert.equal((await portalRepository.reopenPost(seeded.postId, scope, 1)).kind, 'reopened')
  assert.equal((await portalRepository.rejectPost(seeded.postId, 'changed rejection', [], scope, 1)).status, 'rejected')
  assert.equal(await portalRepository.reopenPost(seeded.postId, scope, 1), false)

  assert.equal(await postRepository.resubmit(seeded.postId, {}, companyId, false), true)
  assert.equal((await portalRepository.approvePost(seeded.postId, scope, 2)).status, 'approved')
  assert.equal((await portalRepository.reopenPost(seeded.postId, scope, 2)).kind, 'reopened')
})

integrationTest('migration constraints enforce defaults, valid modes, file ownership and cascades', async () => {
  const defaultValue = await query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'portal_approval_mode'`,
  )
  assert.match(defaultValue.rows[0].column_default, /content/)
  const postPolicyDefault = await query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'post_field_policies'`,
  )
  assert.match(postPolicyDefault.rows[0].column_default, /funnel_tag.*hidden/)
  await assert.rejects(
    query("UPDATE platform_settings SET portal_approval_mode = 'invalid' WHERE singleton_key = TRUE"),
    (error: any) => error?.code === '23514',
  )

  const first = await seedPost({ files: [{}] })
  const second = await seedPost({ files: [{}] })
  await assert.rejects(
    query(
      `INSERT INTO portal_item_review_drafts (post_id, file_id, content_revision, decision)
       VALUES ($1, $2, 1, 'approved')`,
      [first.postId, second.files[0].id],
    ),
    (error: any) => error?.code === '23503',
  )
  await query(
    `INSERT INTO portal_item_review_drafts (post_id, file_id, content_revision, decision)
     VALUES ($1, $2, 1, 'approved')`,
    [first.postId, first.files[0].id],
  )
  await query(
    `INSERT INTO portal_post_reviews (post_id, revision, completed_status, completed_at)
     VALUES ($1, 1, 'approved', NOW())`,
    [first.postId],
  )
  await query('DELETE FROM posts WHERE id = $1', [first.postId])
  const cascaded = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM portal_item_review_drafts WHERE post_id = $1) AS drafts,
       (SELECT COUNT(*)::int FROM portal_post_reviews WHERE post_id = $1) AS reviews`,
    [first.postId],
  )
  assert.deepEqual(cascaded.rows[0], { drafts: 0, reviews: 0 })
})
