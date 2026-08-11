import { apiClient } from '../lib/axios'

export async function fetchPortal(token) {
  const { data } = await apiClient.get(`/portal/${token}`)
  return data
}

export async function approvePortalPost(token, postId) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/approve`)
  return data
}

export async function rejectPortalPost(token, postId, comment, tags = []) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/reject`, { comment, tags })
  return data
}

export async function savePortalItemDecision(token, postId, fileId, decision, comment = '', tags = []) {
  const { data } = await apiClient.put(`/portal/${token}/posts/${postId}/items/${fileId}/decision`, { decision, comment, tags })
  return data
}

export async function completePortalItemReview(token, postId) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/complete-review`)
  return data
}

export async function reopenPortalPost(token, postId) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/reopen`)
  return data
}

export async function sendPortalFeedback(token, payload) {
  const { data } = await apiClient.post(`/portal/${token}/feedback`, payload)
  return data
}

export async function approvePortalFile(token, fileId) {
  const { data } = await apiClient.post(`/portal/${token}/files/${fileId}/approve`)
  return data
}

export async function rejectPortalFile(token, fileId, comment, tags = []) {
  const { data } = await apiClient.post(`/portal/${token}/files/${fileId}/reject`, { comment, tags })
  return data
}

export async function resetPortalFile(token, fileId) {
  const { data } = await apiClient.post(`/portal/${token}/files/${fileId}/reset`)
  return data
}

export async function updatePortalFileFeedback(token, fileId, comment, tags = []) {
  const { data } = await apiClient.patch(`/portal/${token}/files/${fileId}/feedback`, { comment, tags })
  return data
}

export async function approvePortalSoundtrack(token, postId) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/soundtrack/approve`)
  return data
}

export async function adjustPortalSoundtrack(token, postId, comment) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/soundtrack/adjust`, { comment })
  return data
}

export async function resetPortalSoundtrack(token, postId) {
  const { data } = await apiClient.post(`/portal/${token}/posts/${postId}/soundtrack/reset`)
  return data
}
