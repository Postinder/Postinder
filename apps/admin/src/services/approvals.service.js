import { apiClient } from '../lib/axios'

export async function fetchClientQueue() {
  const { data } = await apiClient.get('/posts?status=pending_approval')
  return data.data || []
}

export async function approveFile(postId, comment) {
  const { data } = await apiClient.post(`/posts/${postId}/approve`, { comment })
  return data
}

export async function rejectFile(postId, reason) {
  const { data } = await apiClient.post(`/posts/${postId}/reject`, { reason })
  return data
}

export async function submitClientFeedback(feedback) {
  await apiClient.post('/feedback', feedback)
}
