import { apiClient } from '../lib/axios'

export async function fetchPosts(filters) {
  const { data } = await apiClient.get('/posts', { params: filters })
  return data.data || []
}

export async function createPost(postData, files = []) {
  const { data: post } = await apiClient.post('/posts', postData)

  if (files.length > 0) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    await apiClient.post(`/posts/${post.id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  return post
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

export async function resubmitPost(postId, data) {
  const response = await apiClient.post(`/posts/${postId}/resubmit`, data)
  return response.data
}

export function computePostStatus(post) {
  // Accept post object or files array (backwards-compat)
  if (Array.isArray(post)) {
    const files = post
    if (!files.length) return 'draft'
    if (files.some(f => f.status === 'rejected')) return 'rejected'
    if (files.some(f => f.status === 'pending'))  return 'pending_approval'
    if (files.every(f => f.status === 'approved')) return 'approved'
    return 'draft'
  }
  // Prefer backend status field directly
  return post?.status || 'draft'
}
