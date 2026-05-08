import { supabase, uploadFile } from './supabase'

export async function fetchPosts({ clientId, status, search } = {}) {
  let q = supabase
    .from('posts')
    .select('*, client:clients(id,name,color,email), files:post_files(*)')
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
      const key = `clients/${postData.clientId}/posts/${post.id}/${Date.now()}-${file.name}`
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

export function computePostStatus(files = []) {
  if (!files.length) return 'pending'
  if (files.every(f => f.status === 'APPROVED')) return 'approved'
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
