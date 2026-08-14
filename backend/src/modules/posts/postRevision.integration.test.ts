import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { Pool } from 'pg'
import {
  POST_REVISION_TEST_CONFIRMATION,
  resolvePostRevisionTestDatabase,
} from '../../testing/postRevisionTestDatabase'

const companyId = '10000000-0000-4000-8000-000000000001'
const databaseConfig = resolvePostRevisionTestDatabase()
const integrationSuite = databaseConfig.enabled ? describe : describe.skip

let administrationPool: Pool | undefined
let applicationPool: Pool | undefined
let postRepository: any
let PostRepositoryClass: any
let portalRepository: any
let soundtrackRepository: any
let settingsService: any
let fixtureSequence = 0

type LegacyFixture = {
  clientId: string
  postIdsByStatus: Record<string, string>
  draftPostId: string
  draftFileId: string
  soundtrackId: string
}

let legacyFixture: LegacyFixture

describe('post revision integration database guard', () => {
  test('stays disabled unless POST_REVISION_INTEGRATION is exactly 1', () => {
    assert.deepEqual(resolvePostRevisionTestDatabase({
      POST_REVISION_INTEGRATION: 'true',
      POST_REVISION_TEST_DATABASE_URL: 'postgresql://example.invalid/production',
    }), { enabled: false })
  })

  test('requires the explicit destructive-test confirmation', () => {
    assert.throws(
      () => resolvePostRevisionTestDatabase({
        POST_REVISION_INTEGRATION: '1',
        POST_REVISION_TEST_DATABASE_URL: 'postgresql://localhost/postinder_test',
      }),
      /POST_REVISION_TEST_CONFIRM/,
    )
  })

  test('rejects remote hosts and database names without the _test suffix', () => {
    assert.throws(
      () => resolvePostRevisionTestDatabase({
        POST_REVISION_INTEGRATION: '1',
        POST_REVISION_TEST_CONFIRM: POST_REVISION_TEST_CONFIRMATION,
        POST_REVISION_TEST_DATABASE_URL: 'postgresql://db.example.com/postinder_test',
      }),
      /host must be localhost/,
    )
    assert.throws(
      () => resolvePostRevisionTestDatabase({
        POST_REVISION_INTEGRATION: '1',
        POST_REVISION_TEST_CONFIRM: POST_REVISION_TEST_CONFIRMATION,
        POST_REVISION_TEST_DATABASE_URL: 'postgresql://127.0.0.1/postinder',
      }),
      /must end with _test/,
    )
  })

  test('rejects URL parameters that could override the validated target', () => {
    assert.throws(
      () => resolvePostRevisionTestDatabase({
        POST_REVISION_INTEGRATION: '1',
        POST_REVISION_TEST_CONFIRM: POST_REVISION_TEST_CONFIRMATION,
        POST_REVISION_TEST_DATABASE_URL: 'postgresql://localhost/postinder_test?host=db.example.com',
      }),
      /parameter host is not allowed/,
    )
  })

  test('accepts only an explicitly confirmed local test database', () => {
    const resolved = resolvePostRevisionTestDatabase({
      POST_REVISION_INTEGRATION: '1',
      POST_REVISION_TEST_CONFIRM: POST_REVISION_TEST_CONFIRMATION,
      POST_REVISION_TEST_DATABASE_URL: 'postgresql://127.0.0.1:55432/postinder_revision_test',
    })
    assert.deepEqual(resolved, {
      enabled: true,
      databaseUrl: 'postgresql://127.0.0.1:55432/postinder_revision_test',
      databaseName: 'postinder_revision_test',
      hostname: '127.0.0.1',
    })
  })
})

function database() {
  assert.ok(administrationPool, 'the isolated integration database was not initialized')
  return administrationPool
}

async function expectConstraintViolation(operation: Promise<unknown>) {
  await assert.rejects(operation, (error: any) => {
    assert.equal(error?.code, '23514')
    return true
  })
}

async function expectApplicationConflict(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: any) => {
    assert.equal(error?.statusCode, 409)
    assert.equal(error?.code, code)
    return true
  })
}

async function waitForBlockedQueries(expected: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const blocked = await database().query(
      `SELECT COUNT(*)::int AS count
       FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    )
    if (Number(blocked.rows[0].count) >= expected) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`Expected ${expected} blocked PostgreSQL queries`)
}

async function applyMigration(filename: string) {
  const migrationPath = path.resolve(__dirname, '../../../../database/migrations', filename)
  await database().query(await readFile(migrationPath, 'utf8'))
}

async function applyMigrationsBeforeRevisionHistory() {
  const migrationsPath = path.resolve(__dirname, '../../../../database/migrations')
  const migrations = (await readdir(migrationsPath))
    .filter(filename => /^\d{3}_.+\.sql$/.test(filename))
    .filter(filename => {
      const number = Number(filename.slice(0, 3))
      return number <= 20 && number !== 2
    })
    .sort()

  for (const migration of migrations) await applyMigration(migration)
}

async function seedLegacyData(): Promise<LegacyFixture> {
  const client = await database().query(
    `INSERT INTO clients (email, name, password_hash, company_id)
     VALUES ('revision-legacy@example.test', 'Revision legacy', 'test-password', $1)
     RETURNING id`,
    [companyId],
  )
  const clientId = client.rows[0].id
  const postIdsByStatus: Record<string, string> = {}

  for (const status of ['sent', 'pending_approval', 'rejected', 'approved', 'executed']) {
    const post = await database().query(
      `INSERT INTO posts (client_id, company_id, title, status, channels, submitted_at)
       VALUES ($1, $2, $3, $4, ARRAY['Instagram']::text[], NOW())
       RETURNING id`,
      [clientId, companyId, `Legacy ${status}`, status],
    )
    postIdsByStatus[status] = post.rows[0].id
  }

  const file = await database().query(
    `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order)
     VALUES ($1, 'https://example.test/legacy.png', 'legacy.png', 'IMAGE', 'pending', 1)
     RETURNING id`,
    [postIdsByStatus.sent],
  )
  await database().query(
    `INSERT INTO portal_item_review_drafts (
       post_id, file_id, decision, rejection_reason
     ) VALUES ($1, $2, 'rejected', 'Unversioned legacy draft')`,
    [postIdsByStatus.sent, file.rows[0].id],
  )

  const soundtrack = await database().query(
    `INSERT INTO post_soundtracks (
       post_id, mode, external_url, approval_status, approved_at
     ) VALUES ($1, 'external_reference', 'https://example.test/legacy-audio', 'approved', NOW())
     RETURNING id`,
    [postIdsByStatus.sent],
  )
  await database().query(
    `INSERT INTO post_soundtrack_decisions (
       soundtrack_id, post_id, revision_number, decision, actor_role
     ) VALUES ($1, $2, 1, 'approved', 'client')`,
    [soundtrack.rows[0].id, postIdsByStatus.sent],
  )

  return {
    clientId,
    postIdsByStatus,
    draftPostId: postIdsByStatus.sent,
    draftFileId: file.rows[0].id,
    soundtrackId: soundtrack.rows[0].id,
  }
}

async function resetBusinessData(
  approvalMode: 'content' | 'item' = 'content',
  soundtrack = false,
) {
  // resolvePostRevisionTestDatabase has already accepted the dedicated URL before
  // either pool is constructed. No destructive statement exists before that gate.
  await database().query('TRUNCATE TABLE clients RESTART IDENTITY CASCADE')
  await settingsService.update({
    portal: { approval_mode: approvalMode },
    features: { soundtrack },
  })
}

async function seedEditablePost(input: {
  fileCount?: number
  fileStatus?: string
  soundtrack?: boolean
  title?: string
} = {}) {
  fixtureSequence += 1
  const client = await database().query(
    `INSERT INTO clients (email, name, password_hash, company_id)
     VALUES ($1, $2, 'test-password', $3)
     RETURNING id`,
    [`revision-${fixtureSequence}@example.test`, `Revision ${fixtureSequence}`, companyId],
  )
  const post = await database().query(
    `INSERT INTO posts (client_id, company_id, title, status, channels)
     VALUES ($1, $2, $3, 'ready', ARRAY['Instagram']::text[])
     RETURNING id`,
    [client.rows[0].id, companyId, input.title || `Revision post ${fixtureSequence}`],
  )
  const files: Array<{ id: string }> = []
  for (let index = 0; index < (input.fileCount ?? 1); index += 1) {
    const file = await database().query(
      `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order)
       VALUES ($1, $2, $3, 'IMAGE', $4, $5)
       RETURNING id`,
      [
        post.rows[0].id,
        `https://example.test/revision-${fixtureSequence}-${index}.png`,
        `revision-${fixtureSequence}-${index}.png`,
        input.fileStatus || 'pending',
        index + 1,
      ],
    )
    files.push(file.rows[0])
  }

  let soundtrackId: string | null = null
  if (input.soundtrack) {
    const soundtrack = await database().query(
      `INSERT INTO post_soundtracks (
         post_id, mode, external_url, track_name, approval_status
       ) VALUES ($1, 'external_reference', $2, 'Revision track', 'pending')
       RETURNING id`,
      [post.rows[0].id, `https://example.test/revision-${fixtureSequence}-audio`],
    )
    soundtrackId = soundtrack.rows[0].id
  }

  return {
    clientId: client.rows[0].id as string,
    postId: post.rows[0].id as string,
    files,
    soundtrackId,
  }
}

async function submit(
  postId: string,
  reviewPolicy: { funnelTagVisibleToClient?: boolean; funnelTagRequired?: boolean } = {},
) {
  assert.equal(
    await postRepository.submitForApproval(
      postId,
      companyId,
      true,
      { role: 'admin' },
      reviewPolicy,
    ),
    true,
  )
}

integrationSuite('PostgreSQL content revision contract', { concurrency: false }, () => {
  before(async () => {
    assert.equal(databaseConfig.enabled, true)
    assert.ok(databaseConfig.databaseUrl)

    // This assignment occurs only after all safety checks. Project modules that
    // construct their own pool are deliberately imported later.
    process.env.DATABASE_URL = databaseConfig.databaseUrl
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET ||= 'post-revision-integration-only'

    administrationPool = new Pool({ connectionString: databaseConfig.databaseUrl })
    await database().query('DROP SCHEMA IF EXISTS public CASCADE')
    await database().query('CREATE SCHEMA public')
    await applyMigrationsBeforeRevisionHistory()
    legacyFixture = await seedLegacyData()
    await applyMigration('021_content_revision_and_review_history.sql')
    await applyMigration('022_funnel_visibility_and_revision_snapshot.sql')
    await applyMigration('023_soundtrack_history_append_only.sql')

    const [postModule, portalModule, soundtrackModule, settingsModule, poolModule] = await Promise.all([
      import('./infrastructure/repositories/PostRepository'),
      import('../portal/infrastructure/repositories/PortalRepository'),
      import('../soundtracks/infrastructure/repositories/SoundtrackRepository'),
      import('../platformSettings/application/PlatformSettingsService'),
      import('../../shared/database/pool'),
    ])
    settingsService = new settingsModule.PlatformSettingsService()
    PostRepositoryClass = postModule.PostRepository
    postRepository = new PostRepositoryClass()
    portalRepository = new portalModule.PortalRepository(settingsService)
    soundtrackRepository = new soundtrackModule.SoundtrackRepository()
    applicationPool = poolModule.pool
  })

  after(async () => {
    await applicationPool?.end()
    await administrationPool?.end()
  })

  test('migration preserves uncertified legacy state, discards old drafts, and is idempotent', async () => {
    const posts = await database().query(
      `SELECT id, status, content_revision, approved_revision, executed_revision
       FROM posts ORDER BY status`,
    )
    const byStatus = Object.fromEntries(posts.rows.map(row => [row.status, row]))
    for (const status of ['sent', 'pending_approval', 'rejected']) {
      assert.equal(Number(byStatus[status].content_revision), 1)
    }
    for (const status of ['approved', 'executed']) {
      assert.equal(Number(byStatus[status].content_revision), 0)
      assert.equal(byStatus[status].approved_revision, null)
      assert.equal(byStatus[status].executed_revision, null)
    }

    assert.equal(
      Number((await database().query(
        'SELECT COUNT(*)::int AS count FROM portal_item_review_drafts',
      )).rows[0].count),
      0,
    )
    const soundtrackHistory = await database().query(
      `SELECT ps.approved_content_revision, d.content_revision
       FROM post_soundtracks ps
       JOIN post_soundtrack_decisions d ON d.soundtrack_id = ps.id
       WHERE ps.id = $1`,
      [legacyFixture.soundtrackId],
    )
    assert.deepEqual(soundtrackHistory.rows[0], {
      approved_content_revision: null,
      content_revision: null,
    })

    await expectConstraintViolation(database().query(
      `INSERT INTO portal_review_decisions (
         post_id, content_revision, review_sequence, decision,
         approval_mode, client_id, actor_role
       ) VALUES ($1, 0, 1, 'approved', 'content', $2, 'client')`,
      [legacyFixture.postIdsByStatus.sent, legacyFixture.clientId],
    ))
    await database().query(
      `INSERT INTO portal_review_actions (
         post_id, content_revision, action, actor_role
       ) VALUES ($1, 0, 'agency_reopen', 'admin')`,
      [legacyFixture.postIdsByStatus.approved],
    )

    await database().query(
      `INSERT INTO portal_item_review_drafts (
         post_id, file_id, content_revision, decision
       ) VALUES ($1, $2, 1, 'approved')`,
      [legacyFixture.draftPostId, legacyFixture.draftFileId],
    )
    await applyMigration('021_content_revision_and_review_history.sql')
    await applyMigration('022_funnel_visibility_and_revision_snapshot.sql')
    await applyMigration('023_soundtrack_history_append_only.sql')
    assert.equal(
      Number((await database().query(
        'SELECT COUNT(*)::int AS count FROM portal_item_review_drafts',
      )).rows[0].count),
      1,
    )
    const funnelDefaults = await database().query(
      `SELECT review_field_visibility FROM posts WHERE id = $1`,
      [legacyFixture.postIdsByStatus.approved],
    )
    assert.deepEqual(funnelDefaults.rows[0].review_field_visibility, { funnel_tag: false })
  })

  test('database triggers protect post, attachment, and soundtrack material while allowing decisions and hard cascades', async () => {
    await resetBusinessData('content', true)
    const seeded = await seedEditablePost({ soundtrack: true })
    await submit(seeded.postId)

    // Canonical review fields are operational while the current revision is
    // actively under review. Once approved/executed, they freeze as well.
    await database().query("UPDATE files SET status = 'approved' WHERE id = $1", [seeded.files[0].id])
    await database().query(
      `UPDATE post_soundtracks
       SET approval_status = 'approved', approved_content_revision = 1
       WHERE id = $1`,
      [seeded.soundtrackId],
    )

    for (const status of ['sent', 'pending_approval', 'approved', 'executed']) {
      if (status !== 'sent') {
        await database().query('UPDATE posts SET status = $2 WHERE id = $1', [seeded.postId, status])
      }
      await expectConstraintViolation(database().query(
        'UPDATE posts SET title = title || $2 WHERE id = $1',
        [seeded.postId, `-${status}`],
      ))
    }

    await expectConstraintViolation(database().query(
      `INSERT INTO files (post_id, url, original_name, file_type)
       VALUES ($1, 'https://example.test/blocked.png', 'blocked.png', 'IMAGE')`,
      [seeded.postId],
    ))
    await expectConstraintViolation(database().query(
      'DELETE FROM files WHERE id = $1',
      [seeded.files[0].id],
    ))
    await expectConstraintViolation(database().query(
      "UPDATE files SET url = url || '?changed=1' WHERE id = $1",
      [seeded.files[0].id],
    ))
    await expectConstraintViolation(database().query(
      'UPDATE files SET sort_order = sort_order + 1 WHERE id = $1',
      [seeded.files[0].id],
    ))
    await expectConstraintViolation(database().query(
      "UPDATE files SET status = 'rejected' WHERE id = $1",
      [seeded.files[0].id],
    ))

    await expectConstraintViolation(database().query(
      "UPDATE post_soundtracks SET track_name = 'Changed' WHERE id = $1",
      [seeded.soundtrackId],
    ))
    await expectConstraintViolation(database().query(
      'DELETE FROM post_soundtracks WHERE id = $1',
      [seeded.soundtrackId],
    ))
    await expectConstraintViolation(database().query(
      `UPDATE post_soundtracks
       SET approval_status = 'pending', approved_content_revision = NULL
       WHERE id = $1`,
      [seeded.soundtrackId],
    ))

    await database().query('DELETE FROM posts WHERE id = $1', [seeded.postId])
    const cascaded = await database().query(
      `SELECT
         (SELECT COUNT(*)::int FROM files WHERE post_id = $1) AS files,
         (SELECT COUNT(*)::int FROM post_soundtracks WHERE post_id = $1) AS soundtracks,
         (SELECT COUNT(*)::int FROM portal_review_actions WHERE post_id = $1) AS actions`,
      [seeded.postId],
    )
    assert.deepEqual(cascaded.rows[0], { files: 0, soundtracks: 0, actions: 0 })
  })

  test('soundtrack history is append-only while soundtrack and post hard deletes still cascade', async () => {
    const client = await database().connect()
    try {
      await client.query('BEGIN')
      const owner = await client.query(
        `INSERT INTO clients (email, name, password_hash, company_id)
         VALUES ($1, 'Soundtrack history owner', 'test-password', $2)
         RETURNING id`,
        [`soundtrack-history-${++fixtureSequence}@example.test`, companyId],
      )

      const seedAggregate = async (suffix: string) => {
        const post = await client.query(
          `INSERT INTO posts (client_id, company_id, title, status)
           VALUES ($1, $2, $3, 'ready') RETURNING id`,
          [owner.rows[0].id, companyId, `Soundtrack history ${suffix}`],
        )
        const soundtrack = await client.query(
          `INSERT INTO post_soundtracks (
             post_id, mode, track_name, external_url, approval_status
           ) VALUES ($1, 'external_reference', $2, $3, 'pending')
           RETURNING id`,
          [post.rows[0].id, `Track ${suffix}`, `https://example.test/${suffix}`],
        )
        const version = await client.query(
          `INSERT INTO post_soundtrack_versions (
             soundtrack_id, post_id, revision_number, reason, snapshot, actor_role
           ) VALUES ($1, $2, 1, 'created', '{"mode":"external_reference"}'::jsonb, 'admin')
           RETURNING id`,
          [soundtrack.rows[0].id, post.rows[0].id],
        )
        const decision = await client.query(
          `INSERT INTO post_soundtrack_decisions (
             soundtrack_id, post_id, revision_number, content_revision,
             decision, actor_role
           ) VALUES ($1, $2, 1, 1, 'approved', 'client')
           RETURNING id`,
          [soundtrack.rows[0].id, post.rows[0].id],
        )
        return {
          postId: post.rows[0].id as string,
          soundtrackId: soundtrack.rows[0].id as string,
          versionId: version.rows[0].id as string,
          decisionId: decision.rows[0].id as string,
        }
      }

      const expectHistoryMutationBlocked = async (
        savepoint: string,
        sql: string,
        params: unknown[],
      ) => {
        await client.query(`SAVEPOINT ${savepoint}`)
        await assert.rejects(client.query(sql, params), (error: any) => {
          assert.equal(error?.code, '23514')
          assert.match(error?.message || '', /Soundtrack history is append-only/)
          return true
        })
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
      }

      const soundtrackCascade = await seedAggregate('soundtrack-cascade')
      await expectHistoryMutationBlocked(
        'version_update',
        `UPDATE post_soundtrack_versions SET reason = 'mutated' WHERE id = $1`,
        [soundtrackCascade.versionId],
      )
      await expectHistoryMutationBlocked(
        'version_delete',
        'DELETE FROM post_soundtrack_versions WHERE id = $1',
        [soundtrackCascade.versionId],
      )
      await expectHistoryMutationBlocked(
        'decision_update',
        `UPDATE post_soundtrack_decisions SET comment = 'mutated' WHERE id = $1`,
        [soundtrackCascade.decisionId],
      )
      await expectHistoryMutationBlocked(
        'decision_delete',
        'DELETE FROM post_soundtrack_decisions WHERE id = $1',
        [soundtrackCascade.decisionId],
      )

      await client.query('DELETE FROM post_soundtracks WHERE id = $1', [soundtrackCascade.soundtrackId])
      const afterSoundtrackDelete = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM post_soundtrack_versions WHERE soundtrack_id = $1) AS versions,
           (SELECT COUNT(*)::int FROM post_soundtrack_decisions WHERE soundtrack_id = $1) AS decisions`,
        [soundtrackCascade.soundtrackId],
      )
      assert.deepEqual(afterSoundtrackDelete.rows[0], { versions: 0, decisions: 0 })

      const postCascade = await seedAggregate('post-cascade')
      await client.query('DELETE FROM posts WHERE id = $1', [postCascade.postId])
      const afterPostDelete = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM post_soundtracks WHERE id = $1) AS soundtracks,
           (SELECT COUNT(*)::int FROM post_soundtrack_versions WHERE post_id = $2) AS versions,
           (SELECT COUNT(*)::int FROM post_soundtrack_decisions WHERE post_id = $2) AS decisions`,
        [postCascade.soundtrackId, postCascade.postId],
      )
      assert.deepEqual(afterPostDelete.rows[0], { soundtracks: 0, versions: 0, decisions: 0 })

      await client.query('ROLLBACK')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  })

  test('stale expectedRevision produces no canonical mutation or review fact', async () => {
    await resetBusinessData('content')
    const seeded = await seedEditablePost()
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }

    const beforeFacts = await database().query(
      `SELECT
         (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback,
         (SELECT COUNT(*)::int FROM portal_review_decisions WHERE post_id = $1) AS decisions,
         (SELECT COUNT(*)::int FROM portal_post_reviews WHERE post_id = $1) AS reviews,
         (SELECT COUNT(*)::int FROM portal_review_actions WHERE post_id = $1) AS actions`,
      [seeded.postId],
    )
    assert.deepEqual(await portalRepository.approvePost(seeded.postId, scope, 2), {
      kind: 'revision_conflict',
      currentRevision: 1,
    })
    const afterFacts = await database().query(
      `SELECT
         (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback,
         (SELECT COUNT(*)::int FROM portal_review_decisions WHERE post_id = $1) AS decisions,
         (SELECT COUNT(*)::int FROM portal_post_reviews WHERE post_id = $1) AS reviews,
         (SELECT COUNT(*)::int FROM portal_review_actions WHERE post_id = $1) AS actions`,
      [seeded.postId],
    )
    assert.deepEqual(afterFacts.rows[0], beforeFacts.rows[0])

    const canonical = await database().query(
      `SELECT p.status, p.content_revision, p.approved_revision, f.status AS file_status
       FROM posts p JOIN files f ON f.post_id = p.id WHERE p.id = $1`,
      [seeded.postId],
    )
    assert.deepEqual(canonical.rows[0], {
      status: 'sent',
      content_revision: 1,
      approved_revision: null,
      file_status: 'pending',
    })

    await settingsService.update({ portal: { approval_mode: 'item' } })
    assert.deepEqual(
      await portalRepository.saveItemDecision(
        seeded.postId,
        seeded.files[0].id,
        { decision: 'approved' },
        scope,
        2,
      ),
      { kind: 'revision_conflict', currentRevision: 1 },
    )
    assert.equal(
      Number((await database().query(
        'SELECT COUNT(*)::int AS count FROM portal_item_review_drafts WHERE post_id = $1',
        [seeded.postId],
      )).rows[0].count),
      0,
    )
  })

  test('funnel submission captures a stable client-visibility snapshot without leaking internal values', async () => {
    await resetBusinessData('content')
    await settingsService.update({
      post_fields: { funnel_tag: 'optional' },
      post_field_client_visibility: { funnel_tag: false },
    })
    const internal = await seedEditablePost()
    await database().query("UPDATE posts SET funnel_tag = 'Topo' WHERE id = $1", [internal.postId])
    await submit(internal.postId, { funnelTagVisibleToClient: false })

    let portalPost = (await portalRepository.listPosts(internal.clientId, companyId))
      .find((post: any) => post.id === internal.postId)
    assert.equal(Object.prototype.hasOwnProperty.call(portalPost, 'funnelTag'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(portalPost, 'funnel_tag'), false)

    await settingsService.update({ post_field_client_visibility: { funnel_tag: true } })
    portalPost = (await portalRepository.listPosts(internal.clientId, companyId))
      .find((post: any) => post.id === internal.postId)
    assert.equal(Object.prototype.hasOwnProperty.call(portalPost, 'funnelTag'), false)

    const scope = { clientId: internal.clientId, companyId }
    assert.equal((await portalRepository.approvePost(internal.postId, scope, 1)).status, 'approved')
    assert.ok(await postRepository.updateInternalFunnelTag(internal.postId, 'Fundo', companyId))
    assert.deepEqual((await database().query(
      `SELECT funnel_tag, content_revision, approved_revision, review_field_visibility
       FROM posts WHERE id = $1`,
      [internal.postId],
    )).rows[0], {
      funnel_tag: 'Fundo',
      content_revision: 1,
      approved_revision: 1,
      review_field_visibility: { funnel_tag: false },
    })
    assert.equal(await postRepository.markExecuted(internal.postId, 24, companyId), true)
  })

  test('visible funnel is material for its revision and the next revision adopts the new global policy', async () => {
    await resetBusinessData('content')
    await settingsService.update({
      post_fields: { funnel_tag: 'optional' },
      post_field_client_visibility: { funnel_tag: true },
    })
    const visible = await seedEditablePost()
    await database().query("UPDATE posts SET funnel_tag = 'Meio' WHERE id = $1", [visible.postId])
    await submit(visible.postId, { funnelTagVisibleToClient: true })

    const visibleEmpty = await seedEditablePost()
    await submit(visibleEmpty.postId, { funnelTagVisibleToClient: true })
    const emptyPortalPost = (await portalRepository.listPosts(visibleEmpty.clientId, companyId))
      .find((post: any) => post.id === visibleEmpty.postId)
    assert.equal(Object.prototype.hasOwnProperty.call(emptyPortalPost, 'funnelTag'), false)

    let portalPost = (await portalRepository.listPosts(visible.clientId, companyId))
      .find((post: any) => post.id === visible.postId)
    assert.equal(portalPost.funnelTag, 'Meio')
    await settingsService.update({
      post_fields: { funnel_tag: 'hidden' },
      post_field_client_visibility: { funnel_tag: false },
    })
    portalPost = (await portalRepository.listPosts(visible.clientId, companyId))
      .find((post: any) => post.id === visible.postId)
    assert.equal(portalPost.funnelTag, 'Meio')

    assert.equal((await portalRepository.approvePost(
      visible.postId,
      { clientId: visible.clientId, companyId },
      1,
    )).status, 'approved')
    assert.equal(await postRepository.updateInternalFunnelTag(visible.postId, 'Fundo', companyId), null)
    await expectConstraintViolation(database().query(
      "UPDATE posts SET funnel_tag = 'Fundo' WHERE id = $1",
      [visible.postId],
    ))

    assert.equal((await postRepository.reopenForEditing(
      visible.postId,
      companyId,
      { role: 'admin' },
    )).reopened, true)
    await postRepository.updateFields(visible.postId, { funnelTag: 'Fundo' }, companyId)
    await submit(visible.postId, { funnelTagVisibleToClient: false })
    const secondRevision = (await database().query(
      `SELECT status, funnel_tag, content_revision, approved_revision, review_field_visibility
       FROM posts WHERE id = $1`,
      [visible.postId],
    )).rows[0]
    assert.deepEqual(secondRevision, {
      status: 'sent',
      funnel_tag: 'Fundo',
      content_revision: 2,
      approved_revision: null,
      review_field_visibility: { funnel_tag: false },
    })
    portalPost = (await portalRepository.listPosts(visible.clientId, companyId))
      .find((post: any) => post.id === visible.postId)
    assert.equal(Object.prototype.hasOwnProperty.call(portalPost, 'funnelTag'), false)
    assert.ok(await postRepository.updateInternalFunnelTag(visible.postId, 'Pos-venda', companyId))
    assert.deepEqual((await database().query(
      'SELECT funnel_tag, content_revision, approved_revision FROM posts WHERE id = $1',
      [visible.postId],
    )).rows[0], { funnel_tag: 'Pos-venda', content_revision: 2, approved_revision: null })
  })

  test('required funnel blocks submission while optional and hidden policies preserve existing values', async () => {
    await resetBusinessData('content')
    const required = await seedEditablePost()
    assert.equal(await postRepository.submitForApproval(
      required.postId,
      companyId,
      true,
      { role: 'admin' },
      { funnelTagRequired: true, funnelTagVisibleToClient: false },
    ), false)
    assert.deepEqual((await database().query(
      'SELECT status, content_revision FROM posts WHERE id = $1',
      [required.postId],
    )).rows[0], { status: 'ready', content_revision: 0 })

    await database().query("UPDATE posts SET funnel_tag = 'Obrigatorio' WHERE id = $1", [required.postId])
    await submit(required.postId, { funnelTagRequired: true, funnelTagVisibleToClient: true })
    assert.deepEqual((await database().query(
      'SELECT content_revision, review_field_visibility FROM posts WHERE id = $1',
      [required.postId],
    )).rows[0], { content_revision: 1, review_field_visibility: { funnel_tag: true } })

    const historical = await seedEditablePost()
    await database().query("UPDATE posts SET funnel_tag = 'Historico' WHERE id = $1", [historical.postId])
    await settingsService.update({
      post_fields: { funnel_tag: 'hidden' },
      post_field_client_visibility: { funnel_tag: true },
    })
    const effectiveSettings = await settingsService.get()
    assert.equal(effectiveSettings.post_field_client_visibility.funnel_tag, false)
    assert.equal((await database().query(
      'SELECT funnel_tag FROM posts WHERE id = $1',
      [historical.postId],
    )).rows[0].funnel_tag, 'Historico')
    await submit(historical.postId, { funnelTagRequired: false, funnelTagVisibleToClient: false })
  })

  test('drafts are revision-bound and resubmit, rewind, and official history preserve their facts', async () => {
    await resetBusinessData('item')
    const seeded = await seedEditablePost({ fileCount: 2 })
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }

    assert.equal((await portalRepository.saveItemDecision(
      seeded.postId, seeded.files[0].id, { decision: 'approved' }, scope, 1,
    )).kind, 'saved')
    assert.equal((await portalRepository.saveItemDecision(
      seeded.postId,
      seeded.files[1].id,
      { decision: 'rejected', comment: 'First revision rejection' },
      scope,
      1,
    )).kind, 'saved')

    const provisional = await database().query(
      `SELECT
         COUNT(*) FILTER (WHERE d.content_revision = 1)::int AS drafts,
         COUNT(*) FILTER (WHERE f.status = 'pending')::int AS pending_files,
         (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback,
         (SELECT COUNT(*)::int FROM portal_review_decisions WHERE post_id = $1) AS decisions
       FROM files f LEFT JOIN portal_item_review_drafts d ON d.file_id = f.id
       WHERE f.post_id = $1`,
      [seeded.postId],
    )
    assert.deepEqual(provisional.rows[0], {
      drafts: 2,
      pending_files: 2,
      feedback: 0,
      decisions: 0,
    })

    const rejected = await portalRepository.completeItemReview(seeded.postId, scope, 1)
    assert.equal(rejected.kind, 'completed')
    assert.equal(rejected.status, 'rejected')
    assert.equal(await postRepository.resubmit(
      seeded.postId,
      { title: 'Second material revision' },
      companyId,
      false,
      { role: 'admin' },
    ), true)

    const resubmitted = await database().query(
      `SELECT status, title, content_revision, approved_revision
       FROM posts WHERE id = $1`,
      [seeded.postId],
    )
    assert.deepEqual(resubmitted.rows[0], {
      status: 'pending_approval',
      title: 'Second material revision',
      content_revision: 2,
      approved_revision: null,
    })
    assert.equal(
      Number((await database().query(
        'SELECT COUNT(*)::int AS count FROM portal_item_review_drafts WHERE post_id = $1',
        [seeded.postId],
      )).rows[0].count),
      0,
    )

    assert.deepEqual(
      await portalRepository.saveItemDecision(
        seeded.postId,
        seeded.files[0].id,
        { decision: 'approved' },
        scope,
        1,
      ),
      { kind: 'revision_conflict', currentRevision: 2 },
    )
    for (const file of seeded.files) {
      assert.equal((await portalRepository.saveItemDecision(
        seeded.postId, file.id, { decision: 'approved' }, scope, 2,
      )).kind, 'saved')
    }
    assert.equal((await portalRepository.completeItemReview(seeded.postId, scope, 2)).status, 'approved')

    const actionCountBeforeStaleRewind = Number((await database().query(
      'SELECT COUNT(*)::int AS count FROM portal_review_actions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].count)
    assert.deepEqual(await portalRepository.reopenPost(seeded.postId, scope, 1), {
      kind: 'revision_conflict',
      currentRevision: 2,
    })
    assert.equal(Number((await database().query(
      'SELECT COUNT(*)::int AS count FROM portal_review_actions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].count), actionCountBeforeStaleRewind)

    assert.deepEqual(await portalRepository.reopenPost(seeded.postId, scope, 2), { kind: 'reopened' })
    assert.equal((await portalRepository.saveItemDecision(
      seeded.postId,
      seeded.files[0].id,
      { decision: 'rejected', comment: 'Changed decision on the same revision' },
      scope,
      2,
    )).kind, 'saved')
    assert.equal((await portalRepository.saveItemDecision(
      seeded.postId, seeded.files[1].id, { decision: 'approved' }, scope, 2,
    )).kind, 'saved')
    assert.equal((await portalRepository.completeItemReview(seeded.postId, scope, 2)).status, 'rejected')

    const decisions = await database().query(
      `SELECT content_revision, review_sequence, decision
       FROM portal_review_decisions WHERE post_id = $1 ORDER BY review_sequence`,
      [seeded.postId],
    )
    assert.deepEqual(decisions.rows, [
      { content_revision: 1, review_sequence: 1, decision: 'rejected' },
      { content_revision: 2, review_sequence: 2, decision: 'approved' },
      { content_revision: 2, review_sequence: 3, decision: 'rejected' },
    ])
    const actions = await database().query(
      `SELECT content_revision, action FROM portal_review_actions
       WHERE post_id = $1 ORDER BY created_at, id`,
      [seeded.postId],
    )
    assert.deepEqual(actions.rows.map(row => row.action), [
      'submitted',
      'resubmitted',
      'client_rewind',
    ])
  })

  test('agency reopen supports a certified cycle and an uncertified revision-zero legacy approval', async () => {
    await resetBusinessData('content')
    const submitted = await seedEditablePost()
    await submit(submitted.postId)
    assert.deepEqual(
      await postRepository.reopenForEditing(
        submitted.postId,
        companyId,
        { role: 'admin' },
      ),
      { reopened: true, status: 'ready', contentRevision: 1 },
    )

    const legacy = await seedEditablePost({ fileStatus: 'approved' })
    await database().query("UPDATE posts SET status = 'approved' WHERE id = $1", [legacy.postId])
    assert.deepEqual(
      await postRepository.reopenForEditing(
        legacy.postId,
        companyId,
        { role: 'admin' },
      ),
      { reopened: true, status: 'ready', contentRevision: 0 },
    )
    const actions = await database().query(
      `SELECT post_id, content_revision, action
       FROM portal_review_actions WHERE post_id = ANY($1::uuid[]) ORDER BY content_revision DESC`,
      [[submitted.postId, legacy.postId]],
    )
    assert.deepEqual(actions.rows.map(row => [row.content_revision, row.action]), [
      [1, 'submitted'],
      [1, 'agency_reopen'],
      [0, 'agency_reopen'],
    ])

    await database().query("UPDATE posts SET title = 'Editable again' WHERE id = $1", [legacy.postId])
    assert.equal(
      (await database().query('SELECT title FROM posts WHERE id = $1', [legacy.postId])).rows[0].title,
      'Editable again',
    )
  })

  test('official approval seals execution and simultaneous completions append only one decision', async () => {
    await resetBusinessData('content')
    const legacy = await seedEditablePost({ fileStatus: 'approved' })
    await database().query("UPDATE posts SET status = 'approved' WHERE id = $1", [legacy.postId])
    assert.equal(await postRepository.markExecuted(legacy.postId, 24, companyId), false)

    const seeded = await seedEditablePost()
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }
    const results = await Promise.all([
      portalRepository.approvePost(seeded.postId, scope, 1),
      portalRepository.approvePost(seeded.postId, scope, 1),
    ])
    assert.deepEqual(results.map(result => result.kind).sort(), ['already_completed', 'completed'])

    const sealed = await database().query(
      `SELECT p.status, p.content_revision, p.approved_revision,
              COUNT(d.id)::int AS decision_count
       FROM posts p
       LEFT JOIN portal_review_decisions d ON d.post_id = p.id
       WHERE p.id = $1 GROUP BY p.id`,
      [seeded.postId],
    )
    assert.deepEqual(sealed.rows[0], {
      status: 'approved',
      content_revision: 1,
      approved_revision: 1,
      decision_count: 1,
    })
    const executionResults = await Promise.all([
      postRepository.markExecuted(seeded.postId, 24, companyId),
      postRepository.markExecuted(seeded.postId, 24, companyId),
    ])
    assert.deepEqual(executionResults.sort(), [false, true])
    const executed = await database().query(
      `SELECT status, content_revision, approved_revision, executed_revision,
              executed_at IS NOT NULL AS has_executed_at,
              files_delete_after IS NOT NULL AS has_retention_deadline
       FROM posts WHERE id = $1`,
      [seeded.postId],
    )
    assert.deepEqual(executed.rows[0], {
      status: 'executed',
      content_revision: 1,
      approved_revision: 1,
      executed_revision: 1,
      has_executed_at: true,
      has_retention_deadline: true,
    })
    assert.equal(await postRepository.markExecuted(seeded.postId, 24, companyId), false)
  })

  test('an idempotent retry is valid only while its official decision remains canonical', async () => {
    await resetBusinessData('content')
    const seeded = await seedEditablePost()
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }

    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 1)).kind, 'completed')
    assert.deepEqual(await portalRepository.approvePost(seeded.postId, scope, 1), {
      kind: 'already_completed',
      status: 'approved',
    })
    assert.equal((await postRepository.reopenForEditing(
      seeded.postId,
      companyId,
      { role: 'admin' },
    )).reopened, true)

    const beforeStaleRetry = (await database().query(
      `SELECT
         (SELECT COUNT(*)::int FROM portal_review_decisions WHERE post_id = $1) AS decisions,
         (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback,
         (SELECT COUNT(*)::int FROM portal_post_reviews WHERE post_id = $1) AS reviews,
         (SELECT COUNT(*)::int FROM portal_review_actions WHERE post_id = $1) AS actions`,
      [seeded.postId],
    )).rows[0]

    assert.deepEqual(await portalRepository.approvePost(seeded.postId, scope, 1), {
      kind: 'revision_conflict',
      currentRevision: 1,
    })
    const afterStaleRetry = (await database().query(
      `SELECT
         (SELECT COUNT(*)::int FROM portal_review_decisions WHERE post_id = $1) AS decisions,
         (SELECT COUNT(*)::int FROM feedback WHERE post_id = $1) AS feedback,
         (SELECT COUNT(*)::int FROM portal_post_reviews WHERE post_id = $1) AS reviews,
         (SELECT COUNT(*)::int FROM portal_review_actions WHERE post_id = $1) AS actions`,
      [seeded.postId],
    )).rows[0]
    assert.deepEqual(afterStaleRetry, beforeStaleRetry)
    assert.deepEqual((await database().query(
      'SELECT status, approved_revision FROM posts WHERE id = $1',
      [seeded.postId],
    )).rows[0], { status: 'ready', approved_revision: null })
  })

  test('soundtrack approvals are sealed to the material revision and stale decisions add no history', async () => {
    await resetBusinessData('content', true)
    const seeded = await seedEditablePost({ soundtrack: true })
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }

    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 1)).kind, 'soundtrack_incomplete')
    const soundtrackDecision = await soundtrackRepository.decide(
      seeded.postId,
      'approved',
      null,
      scope,
      'client',
      1,
      { recalculatePostStatus: false },
    )
    assert.equal(soundtrackDecision.approvalStatus, 'approved')
    assert.equal(soundtrackDecision.approvedContentRevision, 1)
    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 1)).status, 'approved')

    assert.equal((await postRepository.reopenForEditing(
      seeded.postId,
      companyId,
      { role: 'admin' },
    )).reopened, true)
    await submit(seeded.postId)
    const countBeforeStale = Number((await database().query(
      'SELECT COUNT(*)::int AS count FROM post_soundtrack_decisions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].count)
    assert.deepEqual(
      await soundtrackRepository.decide(
        seeded.postId,
        'approved',
        null,
        scope,
        'client',
        1,
        { recalculatePostStatus: false },
      ),
      { kind: 'revision_conflict', currentRevision: 2 },
    )
    assert.equal(Number((await database().query(
      'SELECT COUNT(*)::int AS count FROM post_soundtrack_decisions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].count), countBeforeStale)

    const currentDecision = await soundtrackRepository.decide(
      seeded.postId,
      'approved',
      null,
      scope,
      'client',
      2,
      { recalculatePostStatus: false },
    )
    assert.equal(currentDecision.approvedContentRevision, 2)
    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 2)).status, 'approved')
  })

  test('client reassociation requires an active same-tenant client and history keeps the actual approver', async () => {
    await resetBusinessData('content')
    const seeded = await seedEditablePost()
    const replacement = await database().query(
      `INSERT INTO clients (email, name, password_hash, company_id)
       VALUES ('replacement@example.test', 'Replacement', 'test-password', $1)
       RETURNING id`,
      [companyId],
    )
    const inactive = await database().query(
      `INSERT INTO clients (email, name, password_hash, company_id, is_active)
       VALUES ('inactive@example.test', 'Inactive', 'test-password', $1, FALSE)
       RETURNING id`,
      [companyId],
    )
    const otherCompanyId = '20000000-0000-4000-8000-000000000002'
    const crossTenant = await database().query(
      `INSERT INTO clients (email, name, password_hash, company_id)
       VALUES ('cross-tenant@example.test', 'Cross tenant', 'test-password', $1)
       RETURNING id`,
      [otherCompanyId],
    )

    assert.equal(
      (await postRepository.updateFields(
        seeded.postId,
        { clientId: replacement.rows[0].id },
        companyId,
      )).client_id,
      replacement.rows[0].id,
    )
    await expectApplicationConflict(
      postRepository.updateFields(seeded.postId, { clientId: inactive.rows[0].id }, companyId),
      'INVALID_POST_CLIENT',
    )
    await expectApplicationConflict(
      postRepository.updateFields(seeded.postId, { clientId: crossTenant.rows[0].id }, companyId),
      'INVALID_POST_CLIENT',
    )

    await submit(seeded.postId)
    assert.equal((await portalRepository.approvePost(
      seeded.postId,
      { clientId: replacement.rows[0].id, companyId },
      1,
    )).status, 'approved')
    assert.equal((await database().query(
      'SELECT client_id FROM portal_review_decisions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].client_id, replacement.rows[0].id)
    await expectApplicationConflict(
      postRepository.updateFields(seeded.postId, { clientId: seeded.clientId }, companyId),
      'POST_REOPEN_REQUIRED',
    )
  })

  test('resubmit is accepted only from rejected and never acts as a generic status shortcut', async () => {
    await resetBusinessData('content')
    const ready = await seedEditablePost()
    assert.equal(await postRepository.resubmit(ready.postId, {}, companyId, false), false)
    await database().query("UPDATE posts SET status = 'draft' WHERE id = $1", [ready.postId])
    assert.equal(await postRepository.resubmit(ready.postId, {}, companyId, false), false)

    const sent = await seedEditablePost()
    await submit(sent.postId)
    assert.equal(await postRepository.resubmit(sent.postId, {}, companyId, false), false)
    await database().query("UPDATE posts SET status = 'pending_approval' WHERE id = $1", [sent.postId])
    assert.equal(await postRepository.resubmit(sent.postId, {}, companyId, false), false)

    const approved = await seedEditablePost()
    await submit(approved.postId)
    const scope = { clientId: approved.clientId, companyId }
    assert.equal((await portalRepository.approvePost(approved.postId, scope, 1)).status, 'approved')
    assert.equal(await postRepository.resubmit(approved.postId, {}, companyId, false), false)
    assert.equal(await postRepository.markExecuted(approved.postId, 24, companyId), true)
    assert.equal(await postRepository.resubmit(approved.postId, {}, companyId, false), false)

    for (const status of ['scheduled', 'published']) {
      const legacyState = await seedEditablePost()
      await database().query('UPDATE posts SET status = $2 WHERE id = $1', [legacyState.postId, status])
      assert.equal(await postRepository.resubmit(legacyState.postId, {}, companyId, false), false)
    }
  })

  test('a rejected post disappears from the portal during partial agency correction until resubmit', async () => {
    await resetBusinessData('content')
    const seeded = await seedEditablePost()
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }
    assert.equal((await portalRepository.rejectPost(
      seeded.postId, 'Needs correction', [], scope, 1,
    )).status, 'rejected')
    assert.equal((await portalRepository.listPosts(seeded.clientId, companyId)).some(
      (post: any) => post.id === seeded.postId,
    ), true)

    await postRepository.updateFields(
      seeded.postId,
      { title: 'Partially corrected title' },
      companyId,
    )
    assert.equal((await portalRepository.listPosts(seeded.clientId, companyId)).some(
      (post: any) => post.id === seeded.postId,
    ), false)
    assert.equal(await portalRepository.reopenPost(seeded.postId, scope, 1), false)

    assert.equal(await postRepository.resubmit(
      seeded.postId, {}, companyId, false, { role: 'admin' },
    ), true)
    const visibleAgain = (await portalRepository.listPosts(seeded.clientId, companyId))
      .find((post: any) => post.id === seeded.postId)
    assert.equal(visibleAgain.status, 'pending_approval')
    assert.equal(visibleAgain.contentRevision, 2)
  })

  test('revision mismatch is rejected by the database and an unsealed approval cannot execute', async () => {
    await resetBusinessData('content')
    const seeded = await seedEditablePost()
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }
    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 1)).status, 'approved')

    const decisionId = (await database().query(
      'SELECT id FROM portal_review_decisions WHERE post_id = $1',
      [seeded.postId],
    )).rows[0].id
    await expectConstraintViolation(database().query(
      "UPDATE portal_review_decisions SET actor_role = 'other' WHERE id = $1",
      [decisionId],
    ))
    await expectConstraintViolation(database().query(
      'DELETE FROM portal_review_decisions WHERE id = $1',
      [decisionId],
    ))

    assert.equal((await postRepository.reopenForEditing(
      seeded.postId, companyId, { role: 'admin' },
    )).reopened, true)
    await database().query('UPDATE posts SET content_revision = 2 WHERE id = $1', [seeded.postId])
    await expectConstraintViolation(database().query(
      "UPDATE posts SET status = 'approved', approved_revision = 1 WHERE id = $1",
      [seeded.postId],
    ))
    await database().query("UPDATE posts SET status = 'approved' WHERE id = $1", [seeded.postId])
    assert.equal(await postRepository.markExecuted(seeded.postId, 24, companyId), false)
  })

  test('soundtrack removal requires reopen and mode none cannot preserve an old seal', async () => {
    await resetBusinessData('content', true)
    const seeded = await seedEditablePost({ soundtrack: true })
    await submit(seeded.postId)
    const scope = { clientId: seeded.clientId, companyId }
    await soundtrackRepository.decide(
      seeded.postId, 'approved', null, scope, 'client', 1, { recalculatePostStatus: false },
    )
    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 1)).status, 'approved')

    await expectApplicationConflict(
      soundtrackRepository.save(seeded.postId, { mode: 'none' }, { role: 'admin', companyId }),
      'POST_REOPEN_REQUIRED',
    )
    assert.equal((await postRepository.reopenForEditing(
      seeded.postId, companyId, { role: 'admin' },
    )).reopened, true)
    assert.equal(await soundtrackRepository.save(
      seeded.postId, { mode: 'none' }, { role: 'admin', companyId },
    ), null)
    const removed = await database().query(
      `SELECT mode, approval_status, approved_content_revision, deleted_at IS NOT NULL AS deleted
       FROM post_soundtracks WHERE id = $1`,
      [seeded.soundtrackId],
    )
    assert.deepEqual(removed.rows[0], {
      mode: 'none',
      approval_status: 'pending',
      approved_content_revision: null,
      deleted: true,
    })

    await submit(seeded.postId)
    assert.equal((await portalRepository.approvePost(seeded.postId, scope, 2)).status, 'approved')
    assert.equal(await postRepository.markExecuted(seeded.postId, 24, companyId), true)
  })

  test('file replacement and embedded soundtrack invalidation commit or roll back together', async () => {
    await resetBusinessData('content', true)
    const failed = await seedEditablePost({ soundtrack: true })
    await database().query(
      `UPDATE files
       SET file_type = 'VIDEO', mime_type = 'video/mp4', status = 'rejected',
           bucket = 'integration', storage_path = 'same-video.mp4'
       WHERE id = $1`,
      [failed.files[0].id],
    )
    await database().query(
      `UPDATE post_soundtracks
       SET mode = 'embedded', source_media_id = $2, approval_status = 'approved', revision_number = 3
       WHERE post_id = $1`,
      [failed.postId, failed.files[0].id],
    )
    await database().query("UPDATE posts SET status = 'rejected' WHERE id = $1", [failed.postId])

    const injectedFailureRepository = new PostRepositoryClass(undefined, {
      async invalidateEmbeddedSourceInTransaction() {
        throw new Error('injected soundtrack invalidation failure')
      },
    })
    await assert.rejects(
      () => injectedFailureRepository.replaceFile(
        failed.postId,
        failed.files[0].id,
        {
          url: 'https://example.test/replacement.mp4',
          bucket: 'integration',
          storagePath: 'same-video.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 42,
          originalName: 'replacement.mp4',
          fileType: 'VIDEO',
        },
        companyId,
        { role: 'admin', companyId },
      ),
      /injected soundtrack invalidation failure/,
    )
    assert.deepEqual((await database().query(
      `SELECT url, original_name, status FROM files WHERE id = $1`,
      [failed.files[0].id],
    )).rows[0], {
      url: `https://example.test/revision-${fixtureSequence}-0.png`,
      original_name: `revision-${fixtureSequence}-0.png`,
      status: 'rejected',
    })
    assert.deepEqual((await database().query(
      `SELECT approval_status, revision_number FROM post_soundtracks WHERE post_id = $1`,
      [failed.postId],
    )).rows[0], { approval_status: 'approved', revision_number: 3 })

    const replaced = await postRepository.replaceFile(
      failed.postId,
      failed.files[0].id,
      {
        url: 'https://example.test/replacement.mp4',
        bucket: 'integration',
        storagePath: 'same-video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 42,
        originalName: 'replacement.mp4',
        fileType: 'VIDEO',
      },
      companyId,
      { role: 'admin', companyId },
    )
    assert.equal(replaced.status, 'pending')
    assert.deepEqual((await database().query(
      `SELECT approval_status, approved_content_revision, revision_number
       FROM post_soundtracks WHERE post_id = $1`,
      [failed.postId],
    )).rows[0], {
      approval_status: 'pending',
      approved_content_revision: null,
      revision_number: 4,
    })
    assert.equal(Number((await database().query(
      `SELECT COUNT(*)::int AS count FROM post_soundtrack_versions
       WHERE post_id = $1 AND revision_number = 4 AND reason = 'source_media_replaced'`,
      [failed.postId],
    )).rows[0].count), 1)
  })

  test('post-first lock order lets replacement finish before queued resubmit without deadlock', async () => {
    await resetBusinessData('content', true)
    const seeded = await seedEditablePost({ soundtrack: true })
    await database().query(
      `UPDATE files
       SET file_type = 'VIDEO', mime_type = 'video/mp4', status = 'rejected',
           bucket = 'integration', storage_path = 'queued-video.mp4'
       WHERE id = $1`,
      [seeded.files[0].id],
    )
    await database().query(
      `UPDATE post_soundtracks SET mode = 'embedded', source_media_id = $2
       WHERE post_id = $1`,
      [seeded.postId, seeded.files[0].id],
    )
    await database().query("UPDATE posts SET status = 'rejected' WHERE id = $1", [seeded.postId])

    const blocker = await database().connect()
    await blocker.query('BEGIN')
    await blocker.query('SELECT id FROM posts WHERE id = $1 FOR UPDATE', [seeded.postId])
    const replacement = postRepository.replaceFile(
      seeded.postId,
      seeded.files[0].id,
      {
        url: 'https://example.test/queued-replacement.mp4',
        bucket: 'integration',
        storagePath: 'queued-video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 50,
        originalName: 'queued-replacement.mp4',
        fileType: 'VIDEO',
      },
      companyId,
      { role: 'admin', companyId },
    )
    await waitForBlockedQueries(1)
    const resubmission = postRepository.resubmit(
      seeded.postId,
      {},
      companyId,
      true,
      { role: 'admin' },
    )
    await waitForBlockedQueries(2)
    await blocker.query('COMMIT')
    blocker.release()

    assert.ok(await replacement)
    assert.equal(await resubmission, true)
    assert.deepEqual((await database().query(
      'SELECT status, content_revision FROM posts WHERE id = $1',
      [seeded.postId],
    )).rows[0], { status: 'pending_approval', content_revision: 1 })
  })

  test('client deactivation and execution obey their final database linearization order', async () => {
    await resetBusinessData('content')
    const deactivationWins = await seedEditablePost()
    await submit(deactivationWins.postId)
    assert.equal((await portalRepository.approvePost(
      deactivationWins.postId,
      { clientId: deactivationWins.clientId, companyId },
      1,
    )).status, 'approved')

    const decisionBlocker = await database().connect()
    await decisionBlocker.query('BEGIN')
    await decisionBlocker.query('LOCK TABLE portal_review_decisions IN ACCESS EXCLUSIVE MODE')
    const losingExecution = postRepository.markExecuted(deactivationWins.postId, 24, companyId)
    await waitForBlockedQueries(1)
    await database().query('UPDATE clients SET is_active = FALSE WHERE id = $1', [deactivationWins.clientId])
    await decisionBlocker.query('COMMIT')
    decisionBlocker.release()
    assert.equal(await losingExecution, false)
    assert.equal((await database().query(
      'SELECT status FROM posts WHERE id = $1',
      [deactivationWins.postId],
    )).rows[0].status, 'approved')

    const executionWins = await seedEditablePost()
    await submit(executionWins.postId)
    assert.equal((await portalRepository.approvePost(
      executionWins.postId,
      { clientId: executionWins.clientId, companyId },
      1,
    )).status, 'approved')
    assert.equal(await postRepository.markExecuted(executionWins.postId, 24, companyId), true)
    await database().query('UPDATE clients SET is_active = FALSE WHERE id = $1', [executionWins.clientId])
    assert.deepEqual((await database().query(
      'SELECT status, executed_revision FROM posts WHERE id = $1',
      [executionWins.postId],
    )).rows[0], { status: 'executed', executed_revision: 1 })
  })

  test('execute wins a controlled lock race against text, add, remove, reorder, and reopen mutations', async () => {
    await resetBusinessData('content')

    async function approvedPost() {
      const seeded = await seedEditablePost({ fileCount: 2 })
      await submit(seeded.postId)
      assert.equal((await portalRepository.approvePost(
        seeded.postId,
        { clientId: seeded.clientId, companyId },
        1,
      )).status, 'approved')
      return seeded
    }

    const cases: Array<{
      name: string
      run: (seeded: any) => Promise<any>
      executedResult?: any
    }> = [
      {
        name: 'text',
        run: (seeded: any) => postRepository.updateFields(
          seeded.postId, { title: 'Concurrent edit' }, companyId,
        ),
      },
      {
        name: 'add',
        run: (seeded: any) => postRepository.addFiles(seeded.postId, [{
          url: 'https://example.test/concurrent-add.png',
          bucket: 'integration',
          storagePath: 'concurrent-add.png',
          mimeType: 'image/png',
          sizeBytes: 1,
          originalName: 'concurrent-add.png',
          fileType: 'IMAGE',
        }], companyId),
      },
      {
        name: 'remove',
        run: (seeded: any) => postRepository.removeFile(
          seeded.postId, seeded.files[0].id, companyId, false,
        ),
      },
      {
        name: 'reorder',
        run: (seeded: any) => postRepository.reorderFiles(
          seeded.postId,
          seeded.files.map((file: any, index: number) => ({ id: file.id, sort_order: 2 - index })),
          companyId,
        ),
      },
      {
        name: 'reopen',
        run: (seeded: any) => postRepository.reopenForEditing(
          seeded.postId,
          companyId,
          { role: 'admin' },
        ),
        executedResult: { reopened: false, reason: 'executed' },
      },
    ]

    for (const race of cases) {
      const seeded = await approvedPost()
      const blocker = await database().connect()
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM posts WHERE id = $1 FOR UPDATE', [seeded.postId])

      const execution = postRepository.markExecuted(seeded.postId, 24, companyId)
      await waitForBlockedQueries(1)
      const mutation = race.run(seeded).then(
        (value: any) => ({ value }),
        (error: any) => ({ error }),
      )
      await waitForBlockedQueries(2)
      await blocker.query('COMMIT')
      blocker.release()

      assert.equal(await execution, true, `${race.name} race must execute exactly once`)
      const outcome = await mutation
      if (race.executedResult) {
        assert.ok('value' in outcome, `${race.name} must return its losing result`)
        assert.deepEqual(outcome.value, race.executedResult, `${race.name} must lose after execution`)
      } else {
        assert.ok('error' in outcome, `${race.name} must reject after execution`)
        assert.equal(outcome.error?.code, 'EXECUTED_POST_IMMUTABLE', `${race.name} must lose after execution`)
      }
      assert.equal((await database().query(
        'SELECT status, executed_revision FROM posts WHERE id = $1',
        [seeded.postId],
      )).rows[0].status, 'executed')
    }
  })
})
