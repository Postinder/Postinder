import { apiClient } from '../lib/axios'

export async function fetchClientQueue(clientId) {
  const { data } = await apiClient.get(`/approvals/queue?clientId=${clientId}`)
  return data.data || []
}

export async function approveFile(fileId) {
  const { data } = await apiClient.post(`/files/${fileId}/approve`)
  return data
}

export async function rejectFile(fileId, tags, comment) {
  const { data } = await apiClient.post(`/files/${fileId}/reject`, { tags, comment })
  return data
}

export async function submitClientFeedback(clientId, rating, text, month) {
  const { data } = await apiClient.post('/feedback', { clientId, rating, text, month })
  return data
}

