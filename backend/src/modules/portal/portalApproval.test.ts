import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { PortalController } from './presentation/controllers/PortalController'

function responseState() {
  const state: any = { status: 200, body: null }
  const response: any = {
    status(value: number) { state.status = value; return response },
    json(value: any) { state.body = value; return response },
  }
  return { state, response }
}

function request(body: any = {}) {
  return {
    params: { token: 'private-token', postId: 'post-1', fileId: 'file-1' },
    body,
  } as any
}

test('provisional item choices never create official activities', async () => {
  let activities = 0
  const repository = {
    async validateToken() { return { clientId: 'client-1', companyId: 'company-1' } },
    async saveItemDecision() {
      return { kind: 'saved', draft: { decision: 'approved' } }
    },
  }
  const controller = new PortalController(repository as any, {
    async createForPost() { activities += 1 },
  } as any, {} as any, {} as any)
  const { state, response } = responseState()
  await controller.saveItemDecision(request({ decision: 'approved' }), response)
  assert.equal(state.status, 200)
  assert.equal(state.body.draft.decision, 'approved')
  assert.equal(activities, 0)
})

test('completion emits one official activity and an idempotent retry emits none', async () => {
  let completionCalls = 0
  let activities = 0
  const repository = {
    async validateToken() { return { clientId: 'client-1', companyId: 'company-1' } },
    async completeItemReview() {
      completionCalls += 1
      return completionCalls === 1
        ? { kind: 'completed', status: 'rejected', snapshot: [{ fileId: 'file-1', decision: 'rejected' }] }
        : { kind: 'already_completed', status: 'rejected' }
    },
  }
  const controller = new PortalController(repository as any, {
    async createForPost() { activities += 1 },
  } as any, {} as any, {} as any)

  const first = responseState()
  await controller.completeItemReview(request(), first.response)
  assert.equal(first.state.body.status, 'rejected')
  const retry = responseState()
  await controller.completeItemReview(request(), retry.response)
  assert.equal(retry.state.body.idempotent, true)
  assert.equal(activities, 1)
})

test('a full provisional decision path emits no activity until its one final snapshot', async () => {
  let activities = 0
  let provisionalWrites = 0
  const repository = {
    async validateToken() { return { clientId: 'client-1', companyId: 'company-1' } },
    async saveItemDecision() {
      provisionalWrites += 1
      return { kind: 'saved', draft: { decision: 'approved' } }
    },
    async completeItemReview() {
      return {
        kind: 'completed',
        status: 'rejected',
        snapshot: [
          { fileId: 'a', decision: 'approved' },
          { fileId: 'b', decision: 'approved' },
          { fileId: 'c', decision: 'rejected', comment: 'final' },
        ],
      }
    },
  }
  const controller = new PortalController(repository as any, {
    async createForPost() { activities += 1 },
  } as any, {} as any, {} as any)
  for (const [fileId, decision] of [
    ['a', 'approved'], ['a', 'rejected'], ['a', 'approved'],
    ['b', 'rejected'], ['b', 'approved'], ['c', 'rejected'],
  ]) {
    const state = responseState()
    const req = request({ decision, comment: decision === 'rejected' ? 'adjust' : '' })
    req.params.fileId = fileId
    await controller.saveItemDecision(req, state.response)
    assert.equal(state.state.status, 200)
  }
  assert.equal(provisionalWrites, 6)
  assert.equal(activities, 0)
  const completed = responseState()
  await controller.completeItemReview(request(), completed.response)
  assert.equal(completed.state.body.status, 'rejected')
  assert.equal(activities, 1)
})

test('migration and repository separate drafts from the atomic official snapshot', () => {
  const migration = readFileSync(path.resolve(process.cwd(), '../database/migrations/020_portal_approval_mode_and_review_drafts.sql'), 'utf8')
  const repository = readFileSync(path.resolve(process.cwd(), 'src/modules/portal/infrastructure/repositories/PortalRepository.ts'), 'utf8')
  const draftSection = repository.slice(repository.indexOf('async saveItemDecision'), repository.indexOf('async completeItemReview'))
  const completionSection = repository.slice(repository.indexOf('async completeItemReview'), repository.indexOf('async reopenPost'))

  assert.match(migration, /portal_approval_mode VARCHAR\(20\) NOT NULL DEFAULT 'content'/)
  assert.match(migration, /CHECK \(portal_approval_mode IN \('content', 'item'\)\)/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_item_review_drafts/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_post_reviews/)
  assert.doesNotMatch(draftSection, /UPDATE files|INSERT INTO feedback|activity_events/)
  assert.match(draftSection, /ON CONFLICT \(post_id, file_id\) DO UPDATE/)
  assert.match(completionSection, /client\.query\('BEGIN'\)/)
  assert.match(completionSection, /FOR UPDATE OF f/)
  assert.match(completionSection, /UPDATE files f/)
  assert.match(completionSection, /UPDATE posts/)
  assert.match(completionSection, /saveOfficialReview/)
})

test('soundtrack remains an optional secondary condition in item completion', () => {
  const repository = readFileSync(path.resolve(process.cwd(), 'src/modules/portal/infrastructure/repositories/PortalRepository.ts'), 'utf8')
  const controller = readFileSync(path.resolve(process.cwd(), 'src/modules/portal/presentation/controllers/PortalController.ts'), 'utf8')
  const completionSection = repository.slice(repository.indexOf('async completeItemReview'), repository.indexOf('async reopenPost'))

  assert.match(completionSection, /if \(settings\.features\.soundtrack\)/)
  assert.match(completionSection, /mode <> 'none'/)
  assert.match(completionSection, /mediaStatus === 'approved' && soundtrackStatus === 'pending'/)
  assert.match(controller, /recalculatePostStatus: settings\.portal\.approval_mode !== 'item'/)
})
