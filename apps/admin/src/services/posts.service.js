import { apiClient } from '../lib/axios'

export async function fetchPosts(filters) {
  const { data } = await apiClient.get('/posts', { params: filters })
  return data.data || []
}

export async function createPost(postData, files = []) {
  try {
    const { data: post } = await apiClient.post('/posts', postData)

    if (files.length > 0) {
      const formData = new FormData()
      const sortOrders = []
      files.forEach((item, index) => {
        const file = item.file || item
        formData.append('files', file)
        sortOrders.push(item.sort_order || item.sortOrder || index + 1)
      })
      formData.append('sortOrders', sortOrders.join(','))
      await apiClient.post(`/posts/${post.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }

    return post
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message || error.message
    throw new Error(message)
  }
}

export async function updatePost(postId, updates) {
  const { data } = await apiClient.put(`/posts/${postId}`, updates)
  return data
}

export async function uploadPostFiles(postId, files = []) {
  if (!files.length) return []
  const formData = new FormData()
  const sortOrders = []
  files.forEach((item, index) => {
    const file = item.file || item
    formData.append('files', file)
    sortOrders.push(item.sort_order || item.sortOrder || index + 1)
  })
  formData.append('sortOrders', sortOrders.join(','))
  const { data } = await apiClient.post(`/posts/${postId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data || []
}

export async function reorderPostFiles(postId, files) {
  const { data } = await apiClient.patch(`/posts/${postId}/files/reorder`, { files })
  return data
}

export async function duplicatePost(postId) {
  const { data } = await apiClient.post(`/posts/${postId}/duplicate`)
  return data.data || data
}

export async function updatePostStatus(postId, status) {
  const { data } = await apiClient.patch(`/posts/${postId}/status`, { status })
  return data
}

export async function markPostExecuted(postId, retention = 'never') {
  const { data } = await apiClient.post(`/posts/${postId}/execute`, { retention })
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
  const { data } = await apiClient.post(`/posts/${postId}/send-for-approval`)
  return data
}

export async function submitPostsBatch(postIds) {
  const { data } = await apiClient.post('/posts/send-batch-for-approval', { postIds })
  return data
}

export async function resubmitPost(postId, data) {
  const response = await apiClient.post(`/posts/${postId}/resubmit`, data)
  return response.data
}

export async function replacePostFile(postId, fileId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(`/posts/${postId}/files/${fileId}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export async function removePostFile(postId, fileId) {
  const { data } = await apiClient.delete(`/posts/${postId}/files/${fileId}`)
  return data
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
  const files = Array.isArray(post?.files) ? post.files : []
  const fileStatus = files.length ? computePostStatus(files) : null
  const status = post?.status || 'draft'

  if (status === 'executed') return 'executed'

  if (fileStatus === 'approved' && ['sent', 'pending_approval', 'rejected'].includes(status)) return 'approved'
  if (fileStatus === 'rejected' && ['sent', 'pending_approval', 'approved'].includes(status)) return 'rejected'
  if (fileStatus === 'pending_approval' && ['sent', 'pending_approval'].includes(status)) return 'pending_approval'

  return post?.status || 'draft'
}
