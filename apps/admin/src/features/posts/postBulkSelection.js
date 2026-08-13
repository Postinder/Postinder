export const BULK_SEND_STATUSES = ['draft', 'ready', 'rejected']

function hasReviewableContent(post) {
  if (Array.isArray(post?.files) && post.files.length > 0) return true
  const channels = Array.isArray(post?.channels) ? post.channels : []
  const emailLink = post?.emailLink || post?.email_link
  return channels.length === 1
    && channels[0] === 'E-mail Marketing'
    && typeof emailLink === 'string'
    && emailLink.trim().length > 0
}

export function isBulkSendEligible(post, getStatus) {
  return Boolean(post?.id)
    && BULK_SEND_STATUSES.includes(getStatus(post))
    && hasReviewableContent(post)
}

export function getBulkSendEligiblePosts(posts = [], getStatus) {
  return posts.filter(post => isBulkSendEligible(post, getStatus))
}

export function getSelectedBulkSendPosts(posts = [], selectedIds = [], getStatus) {
  const selected = new Set(selectedIds)
  return getBulkSendEligiblePosts(posts, getStatus).filter(post => selected.has(post.id))
}

export function getBulkSelectionState(eligiblePosts = [], selectedIds = []) {
  const selected = new Set(selectedIds)
  const selectedCount = eligiblePosts.reduce((total, post) => total + (selected.has(post.id) ? 1 : 0), 0)
  return {
    checked: eligiblePosts.length > 0 && selectedCount === eligiblePosts.length,
    indeterminate: selectedCount > 0 && selectedCount < eligiblePosts.length,
    selectedCount,
  }
}

export function toggleAllBulkSendPosts(selectedIds = [], eligiblePosts = [], shouldSelect) {
  const eligibleIds = new Set(eligiblePosts.map(post => post.id))
  if (shouldSelect) return [...new Set([...selectedIds, ...eligibleIds])]
  return selectedIds.filter(id => !eligibleIds.has(id))
}
