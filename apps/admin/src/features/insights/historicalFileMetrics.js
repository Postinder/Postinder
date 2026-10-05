const feedbackPostId = feedback => feedback.post_id || feedback.postId
const fileName = file => file?.name || file?.original_name || file?.originalName || file?.storage_url || file?.url || 'arquivo'
const fileKey = (postId, file) => `${postId}:${file?.id || fileName(file)}`
const hasRejection = file => file.status === 'rejected' || file.rejection_reason || file.rejection_tags?.length

export function getHistoricalRejectedPostIds(posts, historicalFeedbacks = []) {
  const postIds = new Set(posts.map(post => post.id))
  const rejectedIds = new Set(historicalFeedbacks.map(feedbackPostId).filter(id => postIds.has(id)))
  posts.forEach(post => {
    if ((post.files || []).some(hasRejection)) rejectedIds.add(post.id)
  })
  return rejectedIds
}

function getHistoricalRejectedFileKeys(posts, historicalFeedbacks) {
  const postById = new Map(posts.map(post => [post.id, post]))
  const rejectedKeys = new Set()
  posts.forEach(post => {
    ;(post.files || []).forEach(file => {
      if (hasRejection(file)) rejectedKeys.add(fileKey(post.id, file))
    })
  })
  historicalFeedbacks.forEach(feedback => {
    const post = postById.get(feedbackPostId(feedback))
    if (!post) return
    const rejectedFiles = Array.isArray(feedback.rejected_files) ? feedback.rejected_files : []
    const validRejectedFiles = rejectedFiles.filter(item =>
      item?.fileId || item?.file_id || item?.fileName || item?.file_name || (Array.isArray(item?.tags) && item.tags.length))
    validRejectedFiles.forEach(item => {
      const id = item.fileId || item.file_id
      const name = item.fileName || item.file_name
      const matched = id
        ? (post.files || []).find(file => file.id === id)
        : (post.files || []).find(file => fileName(file) === name)
      if (matched) rejectedKeys.add(fileKey(post.id, matched))
      else if (name || id) rejectedKeys.add(`${post.id}:${id || name}`)
    })
    if (!validRejectedFiles.length && (feedback.text || feedback.tags?.length)) {
      rejectedKeys.add(`${post.id}:historical-feedback:${feedback.id}`)
    }
  })
  return rejectedKeys
}

export function getHistoricalFileMetrics(posts, historicalFeedbacks = []) {
  const reviewedPostIds = getHistoricalRejectedPostIds(posts, historicalFeedbacks)
  // A current administrative certificate does not erase an earlier client review.
  // Without review evidence, administrative state alone cannot establish a client decision.
  const clientReviewedPosts = posts.filter(post => post.approvalSource !== 'admin' || reviewedPostIds.has(post.id))
  const totalFiles = clientReviewedPosts.reduce((sum, post) => sum + (post.files || []).length, 0)
  const rejectedFiles = Math.min(getHistoricalRejectedFileKeys(clientReviewedPosts, historicalFeedbacks).size, totalFiles)
  const approvedFiles = Math.max(0, totalFiles - rejectedFiles)
  return {
    totalFiles, rejectedFiles, approvedFiles,
    fileApprovalRate: totalFiles ? Math.round(approvedFiles / totalFiles * 100) : 0,
    fileRejectionRate: totalFiles ? Math.round(rejectedFiles / totalFiles * 100) : 0,
  }
}
