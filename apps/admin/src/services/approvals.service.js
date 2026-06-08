import { supabase } from './supabase'
import { notifyAdmins } from './notifications.service'

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

  // Build flat list of ALL files — caller decides what to do with each status
  const allItems = []
  data.forEach(post => {
    if (post.email_link) {
      const allFiles = post.files || []
      const status = allFiles.length
        ? allFiles.every(f => f.status === 'APPROVED') ? 'APPROVED'
          : allFiles.some(f => f.status === 'REJECTED') ? 'REJECTED'
          : 'PENDING'
        : 'PENDING'
      allItems.push({ post, file: { status }, isEmail: true })
    } else {
      ;(post.files || []).forEach((file, fi) => {
        allItems.push({
          post,
          file,
          fileIndex: fi,
          totalFiles: post.files.length,
          isEmail: false,
        })
      })
    }
  })
  return allItems
}

// ── Approve a file — auto-closes post if all files approved ──
export async function approveFile(fileId) {
  // Busca o arquivo para garantir que temos o post_id
  const { data: file, error: fetchError } = await supabase
    .from('post_files')
    .select('id, post_id, name, post:posts(title, client:clients(name))')
    .eq('id', fileId)
    .single()
  if (fetchError || !file) throw fetchError || new Error('Arquivo não encontrado')

  // Aprova o arquivo
  const { error } = await supabase
    .from('post_files')
    .update({ status: 'APPROVED', updated_badge: false })
    .eq('id', fileId)
  if (error) throw error

  // Verifica se todos os arquivos do post foram aprovados
  const { data: allFiles, error: allFilesError } = await supabase
    .from('post_files')
    .select('status')
    .eq('post_id', file.post_id)
  if (allFilesError) throw allFilesError
  const allApproved = allFiles?.every(f => f.status === 'APPROVED')
  if (allApproved) {
    await supabase
      .from('posts')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
      .eq('id', file.post_id)
  }

  // Notificações — nunca quebram o fluxo
  try {
    const clientName = file.post?.client?.name || 'Cliente'
    const postTitle = file.post?.title || 'post'
    if (allApproved) {
      await notifyAdmins(
        `✅ Post totalmente aprovado!`,
        `${clientName} aprovou todos os arquivos de "${postTitle}"`,
        'approved'
      )
    } else {
      await notifyAdmins(
        `✅ Arquivo aprovado`,
        `${clientName} aprovou "${file.name}" em "${postTitle}"`,
        'approved'
      )
    }
  } catch (notifErr) {
    // Notification failed silently — approval already succeeded
    console.warn('Notification error (non-critical):', notifErr)
  }
}

// ── Reject a file with feedback ──
export async function rejectFile(fileId, tags, comment) {
  const tagArray = Array.isArray(tags) ? tags : []

  const { error: statusError } = await supabase
    .from('post_files')
    .update({ status: 'REJECTED', updated_badge: false })
    .eq('id', fileId)
  if (statusError) throw statusError

  const { error: feedbackError } = await supabase
    .from('file_feedbacks')
    .insert({ file_id: fileId, tags: tagArray, comment: comment?.trim() || '' })

  if (feedbackError) {
    console.error('Feedback insertion error:', feedbackError)
    throw new Error(`Feedback não pôde ser salvo: ${feedbackError.message}.`)
  }

  // Notification — isolated: never break the rejection flow
  try {
    const { data: file } = await supabase
      .from('post_files')
      .select('name, post:posts(title, client:clients(name))')
      .eq('id', fileId)
      .single()

    const clientName = file?.post?.client?.name || 'Cliente'
    const postTitle  = file?.post?.title || 'post'
    const tagSummary = tagArray.length
      ? ` (${tagArray.slice(0, 2).join(', ')}${tagArray.length > 2 ? '...' : ''})`
      : ''

    await notifyAdmins(
      `❌ Arquivo recusado`,
      `${clientName} recusou "${file?.name || 'arquivo'}" em "${postTitle}"${tagSummary}`,
      'rejected'
    )
  } catch (notifErr) {
    console.warn('Notification error (non-critical):', notifErr)
  }
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
