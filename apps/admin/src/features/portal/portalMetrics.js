import { getPostStatus, isClientVisiblePost } from './portalStatus.js'

function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function countApprovedInMonth(posts, referenceDate = new Date()) {
  const referenceMonth = monthKey(referenceDate)
  return posts.filter(post => {
    const approvedAt = post.approvedAt || post.approved_at
    return approvedAt && monthKey(approvedAt) === referenceMonth
  }).length
}

export function countContentsWithAdjustments(posts) {
  return posts.filter(post => getPostStatus(post) === 'rejected').length
}

export function findNextScheduledPost(posts, referenceDate = new Date()) {
  const now = referenceDate.getTime()

  return posts
    .filter(post => isClientVisiblePost(post) && getPostStatus(post) !== 'executed')
    .map(post => ({ post, date: new Date(post.scheduledDate || post.scheduled_date) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()) && date.getTime() > now)
    .sort((a, b) => a.date - b.date)[0]?.post || null
}
