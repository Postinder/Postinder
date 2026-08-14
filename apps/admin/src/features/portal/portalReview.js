const FINAL_ITEM_DECISIONS = new Set(['approved', 'rejected'])

export function getItemReviewDecision(file) {
  const decision = String(file?.review_decision || '').toLowerCase()
  return FINAL_ITEM_DECISIONS.has(decision) ? decision : null
}

export function getItemPositiveReaction(file) {
  if (getItemReviewDecision(file) !== 'approved') return null
  return (file?.review_positive_reaction || file?.positiveReaction || file?.positive_reaction) === 'loved'
    ? 'loved'
    : null
}

export function isItemReviewComplete(files = []) {
  return files.length > 0 && files.every(file => getItemReviewDecision(file))
}

export function getConsolidatedReviewStatus(files = []) {
  if (!isItemReviewComplete(files)) return null
  return files.some(file => getItemReviewDecision(file) === 'rejected') ? 'rejected' : 'approved'
}

export function hasPendingApplicableSoundtrack(soundtrackEnabled, soundtrack) {
  if (!soundtrackEnabled || !soundtrack || soundtrack.mode === 'none') return false
  return (soundtrack.approvalStatus || soundtrack.approval_status) === 'pending'
}

export function selectReviewMedia(files = [], currentId, targetId) {
  return files.some(file => file.id === targetId) ? targetId : currentId
}
