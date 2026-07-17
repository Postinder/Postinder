import { apiClient } from '../lib/axios'

export async function fetchPosts(filters) {
  const { data } = await apiClient.get('/posts', { params: filters })
  return data.data || []
}

function getRequestErrorMessage(error) {
  return error.response?.data?.error || error.response?.data?.message || error.message || 'Não foi possível enviar o arquivo.'
}

export async function createPost(postData, files = [], options = {}) {
  let post
  try {
    const { data } = await apiClient.post('/posts', postData)
    post = data

    if (files.length > 0) {
      await uploadPostFiles(post.id, files, options)
    }

    return post
  } catch (error) {
    const originalMessage = getRequestErrorMessage(error)
    const message = post?.id
      ? `A postagem foi criada, mas o arquivo não foi enviado. Você pode tentar novamente pela edição. Motivo: ${originalMessage}`
      : originalMessage
    throw new Error(message)
  }
}

export async function updatePost(postId, updates) {
  const { data } = await apiClient.put(`/posts/${postId}`, updates)
  return data
}

export async function uploadPostFiles(postId, files = [], options = {}) {
  if (!files.length) return []
  const uploadedFiles = []

  for (let index = 0; index < files.length; index += 1) {
    const item = files[index]
    const file = item.file || item
    const formData = new FormData()
    formData.append('files', file)
    formData.append('sortOrders', String(item.sort_order || item.sortOrder || index + 1))

    try {
      const { data } = await apiClient.post(`/posts/${postId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: event => {
          const percent = event.total ? Math.round((event.loaded * 100) / event.total) : 0
          options.onUploadProgress?.({
            fileIndex: index,
            totalFiles: files.length,
            fileName: file.name,
            percent,
          })
        },
      })
      uploadedFiles.push(...(data.data || []))
    } catch (error) {
      throw new Error(`${file.name}: ${getRequestErrorMessage(error)}`)
    }
  }

  return uploadedFiles
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

export async function replacePostFile(postId, fileId, file, options = {}) {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const { data } = await apiClient.post(`/posts/${postId}/files/${fileId}/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: event => {
        const percent = event.total ? Math.round((event.loaded * 100) / event.total) : 0
        options.onUploadProgress?.({ fileIndex: 0, totalFiles: 1, fileName: file.name, percent })
      },
    })
    return data.data
  } catch (error) {
    throw new Error(`${file.name}: ${getRequestErrorMessage(error)}`)
  }
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
