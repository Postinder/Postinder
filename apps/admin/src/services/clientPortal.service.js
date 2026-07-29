import { apiClient } from '../lib/axios'

export async function fetchAuthenticatedPortal() {
  const { data } = await apiClient.get('/client-portal')
  return data
}

export async function approveAuthenticatedPortalPost(postId) {
  const { data } = await apiClient.post(`/client-portal/posts/${postId}/approve`)
  return data
}

export async function rejectAuthenticatedPortalPost(postId, comment) {
  const { data } = await apiClient.post(`/client-portal/posts/${postId}/reject`, { comment })
  return data
}

export async function sendAuthenticatedPortalFeedback(payload) {
  const { data } = await apiClient.post('/client-portal/feedback', payload)
  return data
}

export async function approveAuthenticatedPortalFile(fileId) {
  const { data } = await apiClient.post(`/client-portal/files/${fileId}/approve`)
  return data
}

export async function rejectAuthenticatedPortalFile(fileId, comment, tags = []) {
  const { data } = await apiClient.post(`/client-portal/files/${fileId}/reject`, { comment, tags })
  return data
}

export async function resetAuthenticatedPortalFile(fileId) {
  const { data } = await apiClient.post(`/client-portal/files/${fileId}/reset`)
  return data
}

export async function updateAuthenticatedPortalFileFeedback(fileId, comment, tags = []) {
  const { data } = await apiClient.patch(`/client-portal/files/${fileId}/feedback`, { comment, tags })
  return data
}

export async function approveAuthenticatedPortalSoundtrack(postId) {
  const { data } = await apiClient.post(`/client-portal/posts/${postId}/soundtrack/approve`)
  return data
}

export async function adjustAuthenticatedPortalSoundtrack(postId, comment) {
  const { data } = await apiClient.post(`/client-portal/posts/${postId}/soundtrack/adjust`, { comment })
  return data
}

export async function resetAuthenticatedPortalSoundtrack(postId) {
  const { data } = await apiClient.post(`/client-portal/posts/${postId}/soundtrack/reset`)
  return data
}
