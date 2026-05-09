import { apiClient } from '../lib/axios'

export async function fetchPosts(filters) {
  const { data } = await apiClient.get('/posts', { params: filters })
  return data.data || []
}

export async function createPost(postData) {
  const { data } = await apiClient.post('/posts', postData)
  return data
}

export async function updatePost(postId, updates) {
  const { data } = await apiClient.put(`/posts/${postId}`, updates)
  return data
}

export async function getPost(postId) {
  const { data } = await apiClient.get(`/posts/${postId}`)
  return data
}

export async function softDeletePost(postId) {
  await apiClient.delete(`/posts/${postId}`)
}

export async function submitPost(postId) {
  const { data } = await apiClient.post(`/posts/${postId}/submit-for-approval`)
  return data
}

export function computePostStatus(files) {
  if (!files || files.length === 0) return 'draft'
  const approved = files.filter(f => f.status === 'APPROVED').length
  const rejected = files.filter(f => f.status === 'REJECTED').length
  const pending = files.filter(f => f.status === 'PENDING').length
  if (rejected > 0) return 'rejected'
  if (pending > 0) return 'pending'
  if (approved === files.length) return 'approved'
  return 'draft'
}
