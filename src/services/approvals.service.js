import { supabase } from './supabase'

// ── Get client's pending files queue ──
export async function fetchClientQueue(clientId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      files:post_files(*, feedbacks:file_feedbacks(*))
    `)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Build flat queue of files that need review
  const queue = []
  data.forEach(post => {
    if (post.email_link) {
      const allFiles = post.files || []
      const anyPending = !allFiles.length || allFiles.some(f => f.status === 'PENDING' || f.status === 'UPDATED')
      if (anyPending) queue.push({ post, file: null, isEmail: true })
    } else {
      (post.files || []).forEach((file, fi) => {
        if (file.status === 'PENDING' || file.status === 'UPDATED') {
          queue.push({ post, file, fileIndex: fi, totalFiles: post.files.length, isEmail: false })
        }
      })
    }
  })
  return queue
}

// ── Approve a file ──
export async function approveFile(fileId) {
  const { error } = await supabase
    .from('post_files')
    .update({ status: 'APPROVED', updated_badge: false })
    .eq('id', fileId)
  if (error) throw error
}

// ── Reject a file with feedback ──
export async function rejectFile(fileId, tags, comment) {
  await supabase.from('post_files')
    .update({ status: 'REJECTED', updated_badge: false })
    .eq('id', fileId)
  await supabase.from('file_feedbacks').insert({ file_id: fileId, tags, comment })
}

// ── Admin: approve all files of a post ──
export async function approveAllFiles(postId) {
  const { error } = await supabase
    .from('post_files')
    .update({ status: 'APPROVED' })
    .eq('post_id', postId)
    .neq('status', 'APPROVED')
  if (error) throw error
}

// ── Admin: reject all files of a post ──
export async function rejectAllFiles(postId) {
  const { error } = await supabase
    .from('post_files')
    .update({ status: 'REJECTED' })
    .eq('post_id', postId)
    .neq('status', 'APPROVED')
  if (error) throw error
}

// ── Submit monthly client feedback ──
export async function submitClientFeedback(clientId, rating, text, month) {
  const { error } = await supabase.from('client_feedbacks').insert({
    client_id: clientId,
    rating,
    text,
    month,
  })
  if (error) throw error
}
