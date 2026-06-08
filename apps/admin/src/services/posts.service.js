import { supabase, uploadFile } from './supabase'

function sanitizeFileName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_+/g, '_')
}

export async function fetchPosts({ clientId, status, search } = {}) {
  let q = supabase
    .from('posts')
    .select('*, client:clients(id,name,color,email), files:post_files(*, feedbacks:file_feedbacks(*))')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  if (search)   q = q.ilike('title', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  if (status && status !== 'all') {
    return data.filter(p => computePostStatus(p.files) === status)
  }
  return data
}


// ── Fetch ALL posts including soft-deleted — for Insights metrics ──
export async function fetchPostsForInsights({ clientId } = {}) {
  let q = supabase
    .from('posts')
    .select('*, client:clients(id,name,color,email), files:post_files(*, feedbacks:file_feedbacks(*)), approved_at')
    .order('created_at', { ascending: false })
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
export async function createPost(postData, files) {
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title: postData.title, channels: postData.channels,
      formats: postData.formats, caption: postData.caption,
      scheduled_date: postData.scheduledDate || null,
      funnel_tag: postData.funnelTag || null,
      email_link: postData.emailLink || null,
      client_id: postData.clientId, created_by_id: postData.createdById,
    })
    .select().single()
  if (error) throw error
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = sanitizeFileName(file.name)
      const key = `clients/${postData.clientId}/posts/${post.id}/${Date.now()}-${safeName}`
      const url = await uploadFile(file, key)
      await supabase.from('post_files').insert({
        post_id: post.id, name: file.name, original_name: file.name,
        file_type: file.type.startsWith('video/') ? 'VIDEO' : file.name.endsWith('.pdf') ? 'PDF' : 'IMAGE',
        mime_type: file.type, size_bytes: file.size,
        storage_key: key, storage_url: url, sort_order: i,
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      })
    }
  }
  return post
}

export async function softDeletePost(id) {
  const { error } = await supabase
    .from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function resubmitPost(postId, { title, caption, justificativa }) {
  await supabase.from('post_files')
    .update({ status: 'PENDING', updated_badge: false })
    .eq('post_id', postId).neq('status', 'APPROVED')
  const { data, error } = await supabase.from('posts')
    .update({ title, caption, justificativa })
    .eq('id', postId).select().single()
  if (error) throw error
  return data
}

export function computePostStatus(files = [], postStatus = null) {
  // If post has explicit status from DB, use it
  if (postStatus === 'APPROVED') return 'approved'
  if (postStatus === 'REJECTED') return 'rejected'
  // Fallback: compute from files
  if (!files.length) return 'pending'
  if (files.every(f => f.status === 'APPROVED')) return 'approved'
  if (files.some(f => f.status === 'REJECTED') && !files.some(f => f.status === 'PENDING' || f.status === 'UPDATED')) return 'rejected'
  if (files.some(f => f.status === 'REJECTED'))  return 'rejected'
  if (files.some(f => f.status === 'UPDATED'))   return 'updated'
  return 'pending'
}

export async function updatePost(id, updates) {
  const { data, error } = await supabase
    .from('posts').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function replaceFile(fileId, newFile) {
  // Get current file to save to file_versions
  const { data: currentFile, error: fetchErr } = await supabase
    .from('post_files')
    .select('*')
    .eq('id', fileId)
    .single()
  
  if (fetchErr) throw fetchErr
  
  // Save current file version
  if (currentFile.storage_key) {
    const { error: versionErr } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version: currentFile.version,
        storage_key: currentFile.storage_key,
        size_bytes: currentFile.size_bytes
      })
    if (versionErr) console.error('Error saving file version:', versionErr)
  }
  
  // Upload new file
  const post = await supabase
    .from('post_files')
    .select('post_id')
    .eq('id', fileId)
    .single()
  
  if (!post.data) throw new Error('File not found')
  
  const postId = post.data.post_id
  const clientResult = await supabase
    .from('posts')
    .select('client_id')
    .eq('id', postId)
    .single()
  
  if (!clientResult.data) throw new Error('Post not found')
  
  const clientId = clientResult.data.client_id
  const safeName = sanitizeFileName(newFile.name)
  const key = `clients/${clientId}/posts/${postId}/${Date.now()}-${safeName}`
  const url = await uploadFile(newFile, key)
  
  // Update file record
  const { error: updateErr } = await supabase
    .from('post_files')
    .update({
      name: newFile.name,
      original_name: newFile.name,
      file_type: newFile.type.startsWith('video/') ? 'VIDEO' : newFile.name.endsWith('.pdf') ? 'PDF' : 'IMAGE',
      mime_type: newFile.type,
      size_bytes: newFile.size,
      storage_key: key,
      storage_url: url,
      version: (currentFile.version || 1) + 1,
      updated_badge: true,
      status: 'PENDING',
      updated_at: new Date().toISOString()
    })
    .eq('id', fileId)
  
  if (updateErr) throw updateErr
  
  return { success: true }
}
