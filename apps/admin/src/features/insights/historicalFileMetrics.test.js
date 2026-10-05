import assert from 'node:assert/strict'
import test from 'node:test'
import { getHistoricalFileMetrics, getHistoricalRejectedPostIds } from './historicalFileMetrics.js'
import { countApprovedInMonth, countLovedInMonth } from '../portal/portalMetrics.js'

const date = new Date('2026-10-04T12:00:00Z')
const fixtures = () => [
  { id: 'a', status: 'approved', approvalSource: 'client', approvedAt: date, files: [
    { id: 'a1', status: 'approved' }, { id: 'a2', status: 'approved' },
  ] },
  { id: 'b', status: 'rejected', files: [
    { id: 'b1', status: 'rejected', rejection_reason: 'Corrigir imagem' },
    { id: 'b2', status: 'rejected', rejection_reason: 'Corrigir imagem' },
  ] },
]
const certify = post => ({ ...post, status: 'approved', approvalSource: 'admin', approvedAt: date,
  files: post.files.map(file => ({ ...file, status: 'approved' })) })

test('administrative certification preserves the audited four-file historical metrics', () => {
  const before = fixtures()
  const feedbacks = [{ id: 'feedback', post_id: 'b', text: 'Corrigir imagem' }]
  const expected = { totalFiles: 4, rejectedFiles: 3, approvedFiles: 1, fileApprovalRate: 25, fileRejectionRate: 75 }
  assert.deepEqual(getHistoricalFileMetrics(before, feedbacks), expected)
  const after = [before[0], certify(before[1])]
  assert.deepEqual(getHistoricalFileMetrics(after, feedbacks), expected)
  assert.deepEqual([...getHistoricalRejectedPostIds(after, feedbacks)], ['b'])
  assert.equal(countApprovedInMonth(before, date), 1)
  assert.equal(countApprovedInMonth(after, date), 1)
  assert.equal(countLovedInMonth(after, date), 0)
})

test('retains file-level client approval and rejection when current statuses are administratively certified', () => {
  const posts = fixtures()
  posts[1].files[0] = { id: 'b1', status: 'approved' }
  const history = [{ id: 'f', post_id: 'b', rejected_files: [{ fileId: 'b2' }] }]
  const before = getHistoricalFileMetrics(posts, history)
  assert.deepEqual(before, { totalFiles: 4, rejectedFiles: 1, approvedFiles: 3, fileApprovalRate: 75, fileRejectionRate: 25 })
  assert.deepEqual(getHistoricalFileMetrics([posts[0], certify(posts[1])], history), before)
})

test('historical feedback retains analysis after current rejection fields are cleared', () => {
  const posts = fixtures()
  const history = [{ id: 'f', postId: 'b', text: 'Correção solicitada', rejected_files: [{ fileId: 'b1' }, { fileId: 'b2' }] }]
  const admin = certify({ ...posts[1], files: posts[1].files.map(file => ({ id: file.id })) })
  assert.deepEqual(getHistoricalFileMetrics([posts[0], admin], history), {
    totalFiles: 4, rejectedFiles: 2, approvedFiles: 2, fileApprovalRate: 50, fileRejectionRate: 50,
  })
})

test('administrative state alone cannot invent a client approval or rejection', () => {
  const post = { id: 'admin-only', status: 'approved', approvalSource: 'admin', approvedAt: date,
    files: [{ id: '1', status: 'approved' }, { id: '2', status: 'approved' }] }
  assert.deepEqual(getHistoricalFileMetrics([post]), {
    totalFiles: 0, rejectedFiles: 0, approvedFiles: 0, fileApprovalRate: 0, fileRejectionRate: 0,
  })
  assert.equal(getHistoricalRejectedPostIds([post]).size, 0)
  assert.equal(countApprovedInMonth([post], date), 0)
  assert.equal(countLovedInMonth([{ ...post, positiveReaction: 'loved' }], date), 0)
})

test('normal client and legacy populations keep the existing formulas', () => {
  assert.deepEqual(getHistoricalFileMetrics(fixtures()), {
    totalFiles: 4, rejectedFiles: 2, approvedFiles: 2, fileApprovalRate: 50, fileRejectionRate: 50,
  })
  assert.deepEqual(getHistoricalFileMetrics([{ id: 'legacy', files: [{ id: 'x', status: 'pending' }] }]), {
    totalFiles: 1, rejectedFiles: 0, approvedFiles: 1, fileApprovalRate: 100, fileRejectionRate: 0,
  })
})
