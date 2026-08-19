export const BULK_SEND_STATUSES = ['draft', 'ready']
export const DIRECT_EDIT_STATUSES = ['draft', 'ready', 'rejected']
export const REOPEN_FOR_EDITING_STATUSES = ['sent', 'pending_approval', 'approved']

export const POST_REOPEN_REQUIRED_MESSAGE = 'Esta postagem já foi enviada ou aprovada e precisa ser reaberta antes da edição. Use a ação “Reabrir para edição” e tente novamente.'

export function getRawPostStatus(postOrStatus) {
  const status = typeof postOrStatus === 'string' ? postOrStatus : postOrStatus?.status
  return String(status || '').trim().toLowerCase()
}

export function getPostEditingAction(postOrStatus) {
  const status = getRawPostStatus(postOrStatus)
  if (DIRECT_EDIT_STATUSES.includes(status)) return status === 'rejected' ? 'resubmit' : 'edit'
  if (REOPEN_FOR_EDITING_STATUSES.includes(status)) return 'reopen'
  return 'blocked'
}

export function canEditPostDirectly(postOrStatus) {
  return ['edit', 'resubmit'].includes(getPostEditingAction(postOrStatus))
}

export function requiresPostReopenForEditing(postOrStatus) {
  return getPostEditingAction(postOrStatus) === 'reopen'
}

export function canExecutePost(post) {
  if (getRawPostStatus(post) !== 'approved') return false
  const contentRevision = Number(post?.contentRevision ?? post?.content_revision)
  const approvedRevision = Number(post?.approvedRevision ?? post?.approved_revision)
  return Number.isInteger(contentRevision)
    && contentRevision > 0
    && approvedRevision === contentRevision
}

export function getPostReopenConfirmation(postOrStatus) {
  const approved = getRawPostStatus(postOrStatus) === 'approved'
  const currentState = approved ? 'já foi aprovada pelo cliente' : 'já foi enviada para revisão do cliente'
  return `Esta postagem ${currentState}. Reabrir para edição invalidará a revisão e qualquer aprovação atual. Deseja continuar?`
}

export function isPostReopenRequiredError(error) {
  return String(error?.response?.data?.code || error?.code || '').trim().toLowerCase() === 'post_reopen_required'
}

export function getPostMutationErrorMessage(error, fallback = 'Não foi possível atualizar a postagem.') {
  if (isPostReopenRequiredError(error)) return POST_REOPEN_REQUIRED_MESSAGE
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback
}

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
