import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getConsolidatedReviewStatus,
  getItemReviewDecision,
  hasPendingApplicableSoundtrack,
  isItemReviewComplete,
  selectReviewMedia,
} from './portalReview.js'

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
