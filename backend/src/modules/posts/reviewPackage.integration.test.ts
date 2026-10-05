import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, beforeEach, test } from 'node:test'
import { resolvePostRevisionTestDatabase } from '../../testing/postRevisionTestDatabase'

const config = resolvePostRevisionTestDatabase()
const run = config.enabled ? test : test.skip
const companyId = '10000000-0000-4000-8000-000000000001'
const actor = { id: randomUUID(), role: 'admin', companyId }
let pool: any, portal: any, posts: any, admin: any, settings: any, soundtracks: any, jwt: any, server: any, base: string
before(async () => {
  if (!config.enabled) return
  process.env.DATABASE_URL = config.databaseUrl
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET ||= 'review-package-isolated-test-only'
  const db = await import('../../shared/database/pool')
  pool = db.pool
  settings = new (await import('../platformSettings/application/PlatformSettingsService')).PlatformSettingsService()
  portal = new (await import('../portal/infrastructure/repositories/PortalRepository')).PortalRepository(settings)
  posts = new (await import('./infrastructure/repositories/PostRepository')).PostRepository()
  admin = new (await import('./application/services/AdministrativeApprovalService')).AdministrativeApprovalService()
  soundtracks = new (await import('../soundtracks/infrastructure/repositories/SoundtrackRepository')).SoundtrackRepository()
  jwt = new (await import('../auth/infrastructure/JwtProvider')).JwtProvider()
  const app = (await import('../../app')).createApp()
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api/v1`
})
beforeEach(async () => {
  if (!config.enabled) return
  await pool.query('TRUNCATE clients CASCADE')
  await settings.update({ portal: { approval_mode: 'content' }, features: { soundtrack: false } })
})
after(async () => {
  if (!config.enabled) return
  await new Promise<void>(resolve => server.close(resolve))
  await pool.end()
})
async function seed(options: { clientId?: string; soundtrack?: string; email?: boolean } = {}) {
  const clientId = options.clientId || (await pool.query(
    "INSERT INTO clients(email,name,password_hash,company_id) VALUES($1,'Review package','test-only',$2) RETURNING id",
    [`${randomUUID()}@example.test`, companyId])).rows[0].id
  const postId = (await pool.query(`INSERT INTO posts(client_id,company_id,title,description,status,channels,email_link,content_revision,submitted_at)
    VALUES($1,$2,'Conteúdo','Descrição','ready',$3,$4,1,NOW()) RETURNING id`,
    [clientId, companyId, options.email ? ['E-mail Marketing'] : ['Instagram'], options.email ? 'https://example.test/mail' : null])).rows[0].id
  const files = options.email ? [] : (await pool.query(`INSERT INTO files(post_id,url,file_type,original_name,status,sort_order)
    VALUES($1,'https://example.test/a','VIDEO','video.mp4','pending',1),($1,'https://example.test/b','IMAGE','image.png','pending',2) RETURNING *`, [postId])).rows
  if (options.soundtrack) await pool.query(`INSERT INTO post_soundtracks(post_id,mode,source_media_id,external_url,audio_url)
    VALUES($1,$2,$3,$4,$5)`, [postId, options.soundtrack, options.soundtrack === 'embedded' ? files[0].id : null,
    options.soundtrack === 'external_reference' ? 'https://example.test/audio' : null, options.soundtrack === 'uploaded' ? 'https://example.test/audio.mp3' : null])
  await pool.query("UPDATE posts SET status='sent' WHERE id=$1", [postId])
  return { postId, clientId, files, scope: { clientId, companyId } }
}
async function reject(f: any) { return portal.rejectPost(f.postId, 'Corrigir o texto', ['Texto'], f.scope, 1) }
async function intention(f: any) {
  const { expectedRevision, expectedFingerprint } = await admin.prepare(f.postId, companyId)
  return { expectedRevision, expectedFingerprint, justification: 'Correção pontual conferida', idempotencyKey: randomUUID() }
}
async function snapshot(id: string) {
  const tables = ['posts', 'files', 'post_soundtracks', 'portal_review_actions', 'portal_review_decisions', 'post_soundtrack_decisions']
  return Promise.all(tables.map(async table => (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${table === 'posts' ? 'id' : 'post_id'}=$1 ORDER BY id`, [id])).rows))
}
const conflict = (operation: Promise<any>) => assert.rejects(operation, (error: any) => error.statusCode === 409)
const sign = (role = 'admin', tenant = companyId) => jwt.sign({ type: 'admin', userId: actor.id, role, companyId: tenant, email: 'admin@example.test' }, '5m')
async function http(path: string, token?: string, body?: any, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() as any }
}

run('rewind selects B before eligibility, refuses A, survives refresh, consumes one round, then permits C', async () => {
  const a = await seed(), b = await seed({ clientId: a.clientId }), c = await seed({ clientId: a.clientId })
  assert.deepEqual(await portal.getRewind(a.clientId, companyId), { available: false })
  await portal.approvePost(a.postId, a.scope, 1)
  await portal.approvePost(b.postId, b.scope, 1)
  const target = await portal.getRewind(a.clientId, companyId)
  assert.equal(target.postId, b.postId); assert.equal(target.available, true)
  const rewind = () => portal.reopenPost(b.postId, b.scope, 1, 'client', 1, target.decisionId)
  const results = await Promise.all([rewind(), rewind()])
  assert.deepEqual(results.map(r => r.kind).sort(), ['already_reopened', 'reopened'])
  assert.equal(await portal.reopenPost(a.postId, a.scope, 1, 'client', 1), false)
  assert.equal((await portal.getRewind(a.clientId, companyId)).available, false)
  await conflict(portal.approvePost(b.postId, b.scope, 1))
  await portal.approvePost(b.postId, b.scope, 1, 'client', null, null, 1)
  assert.equal((await portal.getRewind(a.clientId, companyId)).available, false)
  await portal.approvePost(c.postId, c.scope, 1)
  assert.equal((await portal.getRewind(a.clientId, companyId)).postId, c.postId)
})
for (const ineligible of ['executed', 'edited', 'deleted', 'reassigned']) run(`latest ${ineligible} completion never falls back to an earlier post`, async () => {
  const a = await seed(), b = await seed({ clientId: a.clientId })
  await portal.approvePost(a.postId, a.scope, 1)
  await reject(b)
  if (ineligible === 'executed') {
    const payload = await intention(b); await admin.approve(b.postId, payload, actor); await posts.markExecuted(b.postId, 24, companyId)
  } else if (ineligible === 'edited') await pool.query("UPDATE posts SET description='Edited',updated_at=clock_timestamp() WHERE id=$1", [b.postId])
  else if (ineligible === 'deleted') await pool.query('UPDATE posts SET deleted_at=NOW() WHERE id=$1', [b.postId])
  else { const other = await seed(); await pool.query('UPDATE posts SET client_id=$2 WHERE id=$1', [b.postId, other.clientId]) }
  const rewind = await portal.getRewind(a.clientId, companyId)
  assert.equal(rewind.postId, b.postId); assert.equal(rewind.available, false)
  assert.equal(await portal.reopenPost(a.postId, a.scope, 1, 'client', 1), false)
})
run('concurrent cross-post completions and rewind have one server-authoritative order', async () => {
  const a = await seed(), b = await seed({ clientId: a.clientId })
  await Promise.all([portal.approvePost(a.postId, a.scope, 1), portal.approvePost(b.postId, b.scope, 1)])
  const target = await portal.getRewind(a.clientId, companyId)
  const c = await seed({ clientId: a.clientId })
  await Promise.all([portal.reopenPost(target.postId, a.scope, 1, 'client', 1, target.decisionId), portal.approvePost(c.postId, c.scope, 1)])
  assert.equal((await portal.getRewind(a.clientId, companyId)).postId, c.postId)
  assert.equal(await portal.reopenPost(target.postId, a.scope, 1, 'client', 1, target.decisionId), false)
})
run('an edit transaction started before rejection still invalidates rewind after it obtains the post lock', async () => {
  const f = await seed(), blocker = await pool.connect()
  await blocker.query('BEGIN'); await blocker.query('SELECT id FROM posts WHERE id=$1 FOR UPDATE', [f.postId])
  const waitLocks = async (expected: number) => {
    for (let n = 0; n < 100; n++) {
      const count = Number((await pool.query("SELECT COUNT(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].count)
      if (count >= expected) return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Expected blocked edit and review transactions')
  }
  const deciding = reject(f)
  try {
    await waitLocks(1)
    const editing = posts.updateFields(f.postId, { description: 'Edited after rejection' }, companyId)
    await waitLocks(2)
    await blocker.query('COMMIT')
    await Promise.all([deciding, editing])
    assert.equal((await portal.getRewind(f.clientId, companyId)).available, false)
    assert.equal(await portal.reopenPost(f.postId, f.scope, 1, 'client', 1), false)
  } finally { await blocker.query('ROLLBACK'); blocker.release() }
})
run('content feedback is immutable, trimmed, retry-sensitive and never enters legacy feedback', async () => {
  const f = await seed()
  await portal.approvePost(f.postId, f.scope, 1, 'client', 'loved', '  Excelente!  ')
  assert.equal((await portal.approvePost(f.postId, f.scope, 1, 'client', 'loved', 'Excelente!')).kind, 'already_completed')
  assert.equal((await portal.approvePost(f.postId, f.scope, 1, 'client', 'loved', 'Outro')).kind, 'decision_conflict')
  const row = (await pool.query('SELECT * FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0]
  assert.equal(row.positive_feedback, 'Excelente!'); assert.equal(row.positive_reaction, 'loved'); assert.equal(row.decision, 'approved')
  assert.equal((await pool.query('SELECT * FROM feedback WHERE post_id=$1', [f.postId])).rowCount, 0)
  await portal.reopenPost(f.postId, f.scope, 1, 'client', 1, row.id)
  await conflict(portal.approvePost(f.postId, f.scope, 1, 'client', 'loved', 'Intenção antiga'))
  await portal.approvePost(f.postId, f.scope, 1, 'client', 'loved', ' \t ', 1)
  const projected = (await portal.listPosts(f.clientId, companyId))[0]
  assert.equal(projected.positiveFeedback, null); assert.equal(projected.reviewHistory[0].positiveFeedback, 'Excelente!')
})
run('mixed item feedback stays provisional, becomes a separate snapshot field and is cleared by rewind', async () => {
  await settings.update({ portal: { approval_mode: 'item' } })
  const f = await seed()
  await portal.saveItemDecision(f.postId, f.files[0].id, { decision: 'approved', positiveReaction: 'loved', positiveFeedback: ' Vídeo ótimo ' }, f.scope, 1)
  await portal.saveItemDecision(f.postId, f.files[1].id, { decision: 'rejected', comment: 'Trocar imagem' }, f.scope, 1)
  assert.equal((await pool.query('SELECT * FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rowCount, 0)
  await portal.completeItemReview(f.postId, f.scope, 1)
  const decision = (await pool.query('SELECT * FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0]
  assert.equal(decision.decision, 'rejected'); assert.equal(decision.positive_feedback, null)
  assert.equal(decision.item_snapshot[0].positiveFeedback, 'Vídeo ótimo'); assert.equal(decision.item_snapshot[0].comment, null)
  assert.equal(decision.item_snapshot[1].comment, 'Trocar imagem')
  assert.doesNotMatch(JSON.stringify((await pool.query('SELECT text FROM feedback WHERE post_id=$1', [f.postId])).rows), /Vídeo ótimo/)
  await portal.reopenPost(f.postId, f.scope, 1, 'client', 1, decision.id)
  await conflict(portal.saveItemDecision(f.postId, f.files[0].id, { decision: 'approved' }, f.scope, 1, 0))
  await conflict(portal.completeItemReview(f.postId, f.scope, 1, 'client', 0))
  assert.equal((await pool.query('SELECT * FROM portal_item_review_drafts WHERE post_id=$1', [f.postId])).rowCount, 0)
  for (const file of f.files) await portal.saveItemDecision(f.postId, file.id, { decision: 'approved' }, f.scope, 1, 1)
  await portal.completeItemReview(f.postId, f.scope, 1, 'client', 1)
  const last = (await pool.query('SELECT item_snapshot FROM portal_review_decisions WHERE post_id=$1 ORDER BY review_sequence DESC', [f.postId])).rows[0]
  assert.doesNotMatch(JSON.stringify(last), /positiveFeedback/)
})

for (const mode of ['none', 'embedded', 'uploaded', 'external_reference']) run(`admin certifies corrected r+1 and ${mode} soundtrack, preserves rejection and permits execution`, async () => {
  await settings.update({ features: { soundtrack: true } })
  const f = await seed({ soundtrack: mode })
  await reject(f)
  const original = (await pool.query('SELECT * FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows
  await pool.query("UPDATE posts SET description='Texto corrigido',updated_at=NOW() WHERE id=$1", [f.postId])
  const payload = await intention(f)
  const result = await admin.approve(f.postId, payload, actor)
  assert.equal(result.contentRevision, 2); assert.equal(result.approvalSource, 'admin')
  assert.equal((await admin.approve(f.postId, payload, actor)).idempotent, true)
  assert.deepEqual((await pool.query('SELECT * FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows, original)
  const current = (await pool.query('SELECT * FROM posts WHERE id=$1', [f.postId])).rows[0]
  assert.equal(current.status, 'approved'); assert.equal(current.approved_revision, 2)
  assert.equal((await portal.listPosts(f.clientId, companyId))[0].approvalSource, 'admin')
  assert.doesNotMatch(JSON.stringify(await portal.listPosts(f.clientId, companyId)), /Correção pontual conferida/)
  if (mode !== 'none') {
    const sd = (await pool.query('SELECT * FROM post_soundtrack_decisions WHERE post_id=$1', [f.postId])).rows[0]
    assert.equal(sd.content_revision, 2); assert.equal(sd.actor_role, 'admin'); assert.equal(sd.actor_id, actor.id)
  }
  assert.equal((await posts.markExecuted(f.postId, 24, companyId)), true)
  assert.equal((await pool.query('SELECT executed_revision FROM posts WHERE id=$1', [f.postId])).rows[0].executed_revision, 2)
  const history = await admin.history(f.postId, companyId)
  assert.equal(history.decisions.length, 1); assert.equal(history.decisions[0].decision, 'rejected')
  assert.equal(history.actions.find((a: any) => a.action === 'admin_approved').decision_id, original[0].id)
})
run('admin also certifies email-only material without attachments', async () => {
  const f = await seed({ email: true }); await reject(f)
  await admin.approve(f.postId, await intention(f), actor)
  assert.equal(await posts.markExecuted(f.postId, 24, companyId), true)
})
for (const edit of ['text', 'file', 'order', 'soundtrack', 'policy']) run(`stale admin modal after ${edit} change refuses certification with no partial mutation`, async () => {
  await settings.update({ features: { soundtrack: true } })
  const f = await seed({ soundtrack: 'external_reference' }); await reject(f)
  const payload = await intention(f)
  if (edit === 'text') await pool.query("UPDATE posts SET description='new' WHERE id=$1", [f.postId])
  if (edit === 'file') await pool.query("UPDATE files SET url='https://example.test/new' WHERE id=$1", [f.files[0].id])
  if (edit === 'order') await pool.query('UPDATE files SET sort_order=4 WHERE id=$1', [f.files[0].id])
  if (edit === 'soundtrack') await pool.query("UPDATE post_soundtracks SET external_url='https://example.test/new' WHERE post_id=$1", [f.postId])
  if (edit === 'policy') await settings.update({ features: { soundtrack: false } })
  const before = await snapshot(f.postId)
  await conflict(admin.approve(f.postId, payload, actor))
  assert.deepEqual(await snapshot(f.postId), before)
})
run('simultaneous admin double click is idempotent and changing any intent field conflicts', async () => {
  const f = await seed(); await reject(f); const payload = await intention(f)
  const results = await Promise.all([admin.approve(f.postId, payload, actor), admin.approve(f.postId, payload, actor)])
  assert.deepEqual(results.map(r => r.idempotent).sort(), [false, true])
  for (const change of [{ justification: 'Outro motivo' }, { expectedFingerprint: 'b'.repeat(64) }, { expectedRevision: 2 }]) await conflict(admin.approve(f.postId, { ...payload, ...change }, actor))
  assert.equal((await pool.query("SELECT * FROM portal_review_actions WHERE post_id=$1 AND action='admin_approved'", [f.postId])).rowCount, 1)
})
run('different concurrent admin keys cannot create two certifications for one revision', async () => {
  const f = await seed(); await reject(f); const payload = await intention(f)
  const results = await Promise.allSettled([admin.approve(f.postId, payload, actor), admin.approve(f.postId, { ...payload, idempotencyKey: randomUUID() }, actor)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
})
run('failure after child certification rolls back files, soundtrack, decisions, action and revision', async () => {
  await settings.update({ features: { soundtrack: true } })
  const f = await seed({ soundtrack: 'external_reference' }); await reject(f); const payload = await intention(f)
  const before = await snapshot(f.postId)
  await pool.query(`CREATE FUNCTION test_fail_admin() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='admin_approved' THEN RAISE EXCEPTION 'induced admin failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_fail_admin BEFORE INSERT ON portal_review_actions FOR EACH ROW EXECUTE FUNCTION test_fail_admin()`)
  try { await assert.rejects(admin.approve(f.postId, payload, actor), /induced admin failure/); assert.deepEqual(await snapshot(f.postId), before) }
  finally { await pool.query('DROP TRIGGER test_fail_admin ON portal_review_actions; DROP FUNCTION test_fail_admin()') }
})
for (const state of ['never-rejected', 'approved', 'executed', 'deleted', 'other-cycle', 'other-client', 'legacy', 'inactive']) run(`admin eligibility conservatively refuses ${state}`, async () => {
  const f = await seed()
  if (!['never-rejected', 'legacy'].includes(state)) await reject(f)
  if (state === 'approved' || state === 'executed') { await admin.approve(f.postId, await intention(f), actor); if (state === 'executed') await posts.markExecuted(f.postId, 24, companyId) }
  if (state === 'deleted') await pool.query('UPDATE posts SET deleted_at=NOW() WHERE id=$1', [f.postId])
  if (state === 'other-cycle') await pool.query('UPDATE posts SET content_revision=2 WHERE id=$1', [f.postId])
  if (state === 'other-client') { const other = await seed(); await pool.query('UPDATE posts SET client_id=$2 WHERE id=$1', [f.postId, other.clientId]) }
  if (state === 'legacy') await pool.query("UPDATE posts SET status='rejected' WHERE id=$1", [f.postId])
  if (state === 'inactive') await pool.query('UPDATE clients SET is_active=FALSE WHERE id=$1', [f.clientId])
  await assert.rejects(admin.prepare(f.postId, companyId))
})
run('execution refuses status-only and older administrative certificates', async () => {
  const f = await seed()
  await pool.query("UPDATE posts SET status='approved',approved_revision=1 WHERE id=$1", [f.postId])
  assert.equal(await posts.markExecuted(f.postId, 24, companyId), false)
  const g = await seed(); await reject(g); await admin.approve(g.postId, await intention(g), actor)
  await posts.reopenForEditing(g.postId, companyId, actor)
  await pool.query("UPDATE posts SET content_revision=3,approved_revision=3,status='approved' WHERE id=$1", [g.postId])
  assert.equal(await posts.markExecuted(g.postId, 24, companyId), false)
})
run('HTTP capability is admin-only, tenant scoped, strict against body spoofing and rejects portal credentials', async () => {
  const f = await seed(); await reject(f); const payload = await intention(f)
  for (const role of ['manager', 'editor', 'viewer']) {
    assert.equal((await http(`/posts/${f.postId}/admin-approve`, sign(role), payload)).status, 403)
    assert.equal((await http(`/posts/${f.postId}/admin-approval`, sign(role))).status, 403)
  }
  const clientToken = jwt.sign({ type: 'client', clientId: f.clientId, email: 'client@example.test', companyId }, '5m')
  assert.equal((await http(`/posts/${f.postId}/admin-approve`, clientToken, payload)).status, 403)
  assert.equal((await http(`/posts/${f.postId}/admin-approve`, 'private-portal-token', payload)).status, 401)
  assert.equal((await http(`/posts/${f.postId}/admin-approve`, sign('admin', randomUUID()), payload)).status, 404)
  assert.equal((await http(`/posts/${f.postId}/admin-approve`, sign(), { ...payload, actorId: randomUUID() })).status, 400)
  assert.equal((await http(`/posts/${f.postId}/admin-approve`, sign(), payload)).status, 200)
  const detail = await http(`/posts/${f.postId}`, sign())
  assert.equal(detail.status, 200)
  assert.equal(detail.body.approvalSource, 'admin')
  const listing = await http('/posts', sign())
  assert.equal(listing.status, 200)
  assert.match(JSON.stringify(listing.body), /"approvalSource":"admin"/)
  const action = (await pool.query("SELECT actor_id FROM portal_review_actions WHERE post_id=$1 AND action='admin_approved'", [f.postId])).rows[0]
  assert.equal(action.actor_id, actor.id)
})
run('token and authenticated HTTP portals expose the same rewind, refuse N-2 and require round identity', async () => {
  const a = await seed(), b = await seed({ clientId: a.clientId })
  const token = (await portal.createToken({ clientId: a.clientId, companyId })).token
  const clientToken = jwt.sign({ type: 'client', clientId: a.clientId, email: 'client@example.test', companyId }, '5m')
  await portal.approvePost(a.postId, a.scope, 1); await portal.approvePost(b.postId, b.scope, 1)
  const tokenGet = await http(`/portal/${token}`), authGet = await http('/client-portal', clientToken)
  assert.equal(tokenGet.status, 200); assert.equal(authGet.status, 200); assert.deepEqual(tokenGet.body.rewind, authGet.body.rewind)
  const target = tokenGet.body.rewind
  const body = { expectedRevision: 1, expectedReviewSequence: 1, expectedDecisionId: target.decisionId }
  assert.equal((await http(`/portal/${token}/posts/${b.postId}/reopen`, undefined, body)).status, 200)
  assert.equal((await http(`/client-portal/posts/${a.postId}/reopen`, clientToken, body)).status, 409)
  assert.equal((await http(`/client-portal/posts/${b.postId}/approve`, clientToken, { expectedRevision: 1, expectedReviewSequence: 0 })).status, 409)
  assert.equal((await http(`/client-portal/posts/${b.postId}/approve`, clientToken, { expectedRevision: 1 })).status, 400)
  assert.equal((await http('/client-portal', clientToken)).body.rewind.available, false)
})
run('HTTP content feedback validates reaction, length, whitespace and immutable retry identity', async () => {
  const f = await seed()
  const token = jwt.sign({ type: 'client', clientId: f.clientId, email: 'client@example.test', companyId }, '5m')
  const path = `/client-portal/posts/${f.postId}/approve`
  const body = { expectedRevision: 1, expectedReviewSequence: 0, positiveReaction: 'loved', positiveFeedback: '  Excelente tema  ' }
  for (const invalid of [{ positiveReaction: 'invalid' }, { positiveReaction: null }, { positiveFeedback: 'x'.repeat(5001) }, { positiveFeedback: {} }]) {
    assert.equal((await http(path, token, { ...body, ...invalid })).status, 400)
  }
  assert.equal((await http(path, token, body)).status, 200)
  assert.equal((await http(path, token, body)).body.idempotent, true)
  assert.equal((await http(path, token, { ...body, positiveFeedback: 'Outro' })).status, 409)
  assert.equal((await pool.query('SELECT positive_feedback FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0].positive_feedback, 'Excelente tema')
  const second = await seed({ clientId: f.clientId })
  assert.equal((await http(`/client-portal/posts/${second.postId}/approve`, token, { ...body, positiveFeedback: '\u00a0 \n' })).status, 200)
  assert.equal((await pool.query('SELECT positive_feedback FROM portal_review_decisions WHERE post_id=$1', [second.postId])).rows[0].positive_feedback, null)
})
run('HTTP item completion uses the opening round and persists only the official positive snapshot', async () => {
  await settings.update({ portal: { approval_mode: 'item' } })
  const f = await seed()
  const token = jwt.sign({ type: 'client', clientId: f.clientId, email: 'client@example.test', companyId }, '5m')
  const path = `/client-portal/posts/${f.postId}`
  for (const file of f.files) assert.equal((await http(`${path}/items/${file.id}/decision`, token,
    { expectedRevision: 1, expectedReviewSequence: 0, decision: 'approved', positiveReaction: 'loved', positiveFeedback: 'Muito bom' }, 'PUT')).status, 200)
  assert.equal((await http(`${path}/complete-review`, token, { expectedRevision: 1, expectedReviewSequence: 0 })).status, 200)
  const target = await portal.getRewind(f.clientId, companyId)
  await portal.reopenPost(f.postId, f.scope, 1, 'client', 1, target.decisionId)
  assert.equal((await http(`${path}/complete-review`, token, { expectedRevision: 1, expectedReviewSequence: 0 })).status, 409)
  const history = (await pool.query('SELECT item_snapshot FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows
  assert.equal(history.length, 1); assert.equal(history[0].item_snapshot[0].positiveFeedback, 'Muito bom')
})

run('controlled concurrent material edit commits before waiting admin confirmation, which fails without writes', async () => {
  const f = await seed(); await reject(f); const payload = await intention(f)
  const editor = await pool.connect()
  await editor.query('BEGIN')
  await editor.query("UPDATE posts SET title='Concurrent edit' WHERE id=$1", [f.postId])
  const approval = admin.approve(f.postId, payload, actor)
  // Attach the rejection assertion immediately, before releasing the lock.
  const rejected = conflict(approval)
  try {
    let blocked = false
    for (let n = 0; n < 100 && !blocked; n++) {
      blocked = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT p.%'")).rowCount > 0
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 10))
    }
    assert.equal(blocked, true)
    await editor.query('COMMIT')
    await rejected
    assert.equal((await pool.query('SELECT content_revision,status FROM posts WHERE id=$1', [f.postId])).rows[0].content_revision, 1)
    assert.equal((await pool.query("SELECT 1 FROM portal_review_actions WHERE post_id=$1 AND action='admin_approved'", [f.postId])).rowCount, 0)
  } finally { await editor.query('ROLLBACK'); editor.release() }
})
run('administrative execution retains attachment and soundtrack certification gates', async () => {
  await settings.update({ features: { soundtrack: true } })
  const f = await seed({ soundtrack: 'external_reference' }); await reject(f)
  await admin.approve(f.postId, await intention(f), actor)
  await assert.rejects(pool.query("UPDATE files SET status='pending' WHERE id=$1", [f.files[0].id]), /frozen/)
  await posts.reopenForEditing(f.postId, companyId, actor)
  await pool.query("UPDATE files SET status='pending' WHERE id=$1", [f.files[0].id])
  await pool.query("UPDATE posts SET status='approved',approved_revision=2 WHERE id=$1", [f.postId])
  assert.equal(await posts.markExecuted(f.postId, 24, companyId), false)
  await posts.reopenForEditing(f.postId, companyId, actor)
  await pool.query("UPDATE files SET status='approved' WHERE post_id=$1", [f.postId])
  await pool.query("UPDATE post_soundtracks SET approval_status='pending',approved_content_revision=NULL WHERE post_id=$1", [f.postId])
  await pool.query("UPDATE posts SET status='approved',approved_revision=2 WHERE id=$1", [f.postId])
  assert.equal(await posts.markExecuted(f.postId, 24, companyId), false)
})
run('stale soundtrack approval and reset cannot cross rewind at the same material revision', async () => {
  await settings.update({ features: { soundtrack: true } })
  const f = await seed({ soundtrack: 'external_reference' })
  await soundtracks.decide(f.postId, 'approved', null, f.scope, 'client', 1, { recalculatePostStatus: false, expectedReviewSequence: 0 })
  await portal.approvePost(f.postId, f.scope, 1)
  await portal.reopenPost(f.postId, f.scope, 1, 'client', 1)
  await conflict(soundtracks.decide(f.postId, 'approved', null, f.scope, 'client', 1, { recalculatePostStatus: false, expectedReviewSequence: 0 }))
  await conflict(soundtracks.resetDecision(f.postId, f.scope, 1, 'client', 0))
})
for (const [name, value] of [['ASCII', 'x'.repeat(5000)], ['emoji', '😀'.repeat(5000)], ['mixed', 'aé😀'.repeat(1666) + 'ç😀']]) {
  run(`positive feedback HTTP and PostgreSQL share the 5000-code-point ${name} boundary`, async () => {
    const f = await seed()
    const token = jwt.sign({ type: 'client', clientId: f.clientId, email: 'client@example.test', companyId }, '5m')
    const path = `/client-portal/posts/${f.postId}/approve`
    const body = { expectedRevision: 1, expectedReviewSequence: 0, positiveReaction: 'loved', positiveFeedback: value }
    assert.equal((await http(path, token, { ...body, positiveFeedback: value + '😀' })).status, 400)
    assert.equal((await pool.query('SELECT id FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rowCount, 0)
    assert.equal((await http(path, token, body)).status, 200)
    const saved = (await pool.query('SELECT positive_feedback, char_length(positive_feedback) AS length FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0]
    assert.equal(saved.positive_feedback, value)
    assert.equal(saved.length, 5000)
    await assert.rejects(pool.query(`INSERT INTO portal_review_decisions
      (post_id,content_revision,review_sequence,decision,approval_mode,client_id,actor_role,positive_reaction,positive_feedback)
      VALUES($1,1,2,'approved','content',$2,'client','loved',$3)`, [f.postId, f.clientId, value + '😀']),
      (error: any) => error.code === '23514')
  })
}

run('migration 025 enforces feedback null semantics, limits and compatible legacy snapshots', async () => {
  const f = await seed()
  const insert = (reaction: string | null, feedback: any, decision = 'approved', mode = 'content', snapshot: any[] = []) => pool.query(`INSERT INTO portal_review_decisions
    (post_id,content_revision,review_sequence,decision,approval_mode,client_id,actor_role,positive_reaction,positive_feedback,item_snapshot)
    VALUES($1,1,1,$2,$3,$4,'client',$5,$6,$7::jsonb)`, [f.postId, decision, mode, f.clientId, reaction, feedback, JSON.stringify(snapshot)])
  for (const args of [[null, 'Praise'], ['loved', ' \n '], ['loved', '\u00a0\u2003\ufeff'], ['loved', 'x'.repeat(5001)], ['loved', 'Praise', 'rejected'], ['loved', 'Praise', 'approved', 'item']] as any[]) {
    await assert.rejects(insert(args[0], args[1], args[2], args[3]), (e: any) => e.code === '23514')
  }
  for (const item of [{ positiveFeedback: 'Praise' }, { decision: 'approved', positiveFeedback: 'Praise' }, { decision: 'approved', positiveReaction: 'loved', positiveFeedback: 3 }]) {
    await assert.rejects(insert(null, null, 'approved', 'item', [item]), (e: any) => e.code === '23514')
  }
  await insert(null, null, 'approved', 'item', [{ fileId: f.files[0].id, decision: 'approved', comment: null }])
  assert.equal((await pool.query('SELECT positive_feedback FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0].positive_feedback, null)
  for (const reaction of [null, 'loved']) await assert.rejects(pool.query(`INSERT INTO portal_item_review_drafts(post_id,file_id,content_revision,decision,positive_reaction,positive_feedback)
    VALUES($1,$2,1,'approved',$3,$4)`, [f.postId, f.files[0].id, reaction, reaction ? ' \t ' : 'Praise']), (e: any) => e.code === '23514')
})
run('migration 025 requires administrative audit identity, unique revision/key and append-only facts', async () => {
  const f = await seed(); await reject(f)
  const origin = (await pool.query('SELECT id FROM portal_review_decisions WHERE post_id=$1', [f.postId])).rows[0].id
  const valid = [f.postId, 2, actor.id, 'admin', origin, 'Reason', randomUUID(), 'a'.repeat(64)]
  const insert = (values: any[]) => pool.query(`INSERT INTO portal_review_actions(post_id,content_revision,action,actor_id,actor_role,decision_id,justification,idempotency_key,request_fingerprint)
    VALUES($1,$2,'admin_approved',$3,$4,$5,$6,$7,$8)`, values)
  for (const [index, value] of [[1, 0], [2, null], [3, 'manager'], [4, null], [5, null], [5, ' \n '], [6, null], [7, null], [7, 'invalid']] as any[]) {
    const values = [...valid]; values[index] = value
    await assert.rejects(insert(values), (e: any) => e.code === '23514')
  }
  await insert(valid)
  await assert.rejects(insert([...valid.slice(0, 6), randomUUID(), valid[7]]), (e: any) => e.code === '23505')
  const sameKey = [...valid]; sameKey[1] = 3
  await assert.rejects(insert(sameKey), (e: any) => e.code === '23505')
  await assert.rejects(pool.query("UPDATE portal_review_actions SET justification='Changed' WHERE post_id=$1", [f.postId]), /append.only|imut|immutable/i)
  await assert.rejects(pool.query('DELETE FROM portal_review_decisions WHERE post_id=$1', [f.postId]), /append.only|imut|immutable/i)
  const indexes = (await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='portal_review_actions' AND indexname LIKE 'idx_portal_admin_approval_%'")).rows
  assert.equal(indexes.length, 2)
  await pool.query('DELETE FROM posts WHERE id=$1', [f.postId])
  assert.equal((await pool.query('SELECT id FROM portal_review_actions WHERE post_id=$1', [f.postId])).rowCount, 0)
})
