import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getConsolidatedReviewStatus,
  getItemReviewDecision,
  hasPendingApplicableSoundtrack,
  isItemReviewComplete,
  selectReviewMedia,
} from './portalReview.js'
import {
  getPostContentRevision,
  isPortalRevisionConflict,
  PORTAL_REVISION_CONFLICT_MESSAGE,
  reloadAfterPortalRevisionConflict,
} from './portalRevision.js'

test('media selection is free, repeatable and independent from review decisions', () => {
  const files = [1, 2, 3, 4, 5].map(id => ({ id: String(id), review_decision: null }))
  let current = '1'
  for (const target of ['2', '3', '1', '4', '2', '5', '1']) {
    current = selectReviewMedia(files, current, target)
  }
  assert.equal(current, '1')
  assert.deepEqual(files.map(getItemReviewDecision), [null, null, null, null, null])
})

test('item decisions stay editable and only the final snapshot determines consolidation', () => {
  const files = [
    { id: '1', review_decision: null },
    { id: '2', review_decision: 'rejected', review_reason: 'Ajustar chamada' },
  ]
  assert.equal(isItemReviewComplete(files), false)
  files[0].review_decision = 'approved'
  assert.equal(isItemReviewComplete(files), true)
  assert.equal(getConsolidatedReviewStatus(files), 'rejected')
  files[1].review_decision = 'approved'
  assert.equal(getConsolidatedReviewStatus(files), 'approved')
})

test('pending or invalid item state can never be concluded', () => {
  assert.equal(getConsolidatedReviewStatus([]), null)
  assert.equal(getConsolidatedReviewStatus([{ id: '1', review_decision: 'pending' }]), null)
})

test('absent, disabled or non-applicable soundtrack never creates a completion pending state', () => {
  assert.equal(hasPendingApplicableSoundtrack(true, null), false)
  assert.equal(hasPendingApplicableSoundtrack(false, { mode: 'uploaded', approvalStatus: 'pending' }), false)
  assert.equal(hasPendingApplicableSoundtrack(true, { mode: 'none', approvalStatus: 'pending' }), false)
})

test('only an existing applicable soundtrack with a pending decision participates in review', () => {
  assert.equal(hasPendingApplicableSoundtrack(true, { mode: 'uploaded', approvalStatus: 'pending' }), true)
  assert.equal(hasPendingApplicableSoundtrack(true, { mode: 'reference', approval_status: 'approved' }), false)
  assert.equal(hasPendingApplicableSoundtrack(true, { mode: 'embedded', approvalStatus: 'adjustment_requested' }), false)
})

test('content revision accepts both API naming conventions and rejects unversioned legacy zero', () => {
  assert.equal(getPostContentRevision({ contentRevision: 4, content_revision: 2 }), 4)
  assert.equal(getPostContentRevision({ content_revision: 3 }), 3)
  assert.equal(getPostContentRevision({ contentRevision: 0 }), null)
  assert.equal(getPostContentRevision({ contentRevision: '5' }), 5)
})

test('missing or invalid content revision cannot be sent as optimistic concurrency state', () => {
  for (const post of [null, {}, { contentRevision: '' }, { contentRevision: -1 }, { contentRevision: 1.5 }, { contentRevision: 'old' }]) {
    assert.equal(getPostContentRevision(post), null)
  }
})

test('revision conflicts accept backend code casing only with HTTP 409', () => {
  assert.equal(isPortalRevisionConflict({ response: { status: 409, data: { code: 'REVISION_CONFLICT' } } }), true)
  assert.equal(isPortalRevisionConflict({ response: { status: 409, data: { code: 'revision_conflict' } } }), true)
  assert.equal(isPortalRevisionConflict({ response: { status: 400, data: { code: 'REVISION_CONFLICT' } } }), false)
  assert.equal(isPortalRevisionConflict({ response: { status: 409, data: { code: 'wrong_mode' } } }), false)
  assert.match(PORTAL_REVISION_CONFLICT_MESSAGE, /atualizado/i)
})

test('a revision conflict reloads the portal exactly once and reports it as handled', async () => {
  let reloads = 0
  const result = await reloadAfterPortalRevisionConflict(
    { response: { status: 409, data: { code: 'REVISION_CONFLICT', currentRevision: 8 } } },
    async () => { reloads += 1 },
  )

  assert.deepEqual(result, { handled: true, reloaded: true })
  assert.equal(reloads, 1)
})

test('non-conflicts do not reload and reload failure remains distinguishable', async () => {
  let reloads = 0
  assert.deepEqual(
    await reloadAfterPortalRevisionConflict(
      { response: { status: 422, data: { code: 'VALIDATION_ERROR' } } },
      async () => { reloads += 1 },
    ),
    { handled: false, reloaded: false },
  )
  assert.equal(reloads, 0)

  const reloadError = new Error('offline')
  const result = await reloadAfterPortalRevisionConflict(
    { response: { status: 409, data: { code: 'revision_conflict' } } },
    async () => { throw reloadError },
  )
  assert.equal(result.handled, true)
  assert.equal(result.reloaded, false)
  assert.equal(result.reloadError, reloadError)
})
