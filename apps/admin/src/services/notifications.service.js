import { supabase } from './supabase'

// ── Fetch unread notifications for a user ──
export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data || []
}

// ── Mark a single notification as read ──
export async function markAsRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

// ── Mark all notifications as read ──
export async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

// ── Create a notification for all admin/gestor users ──
export async function notifyAdmins(title, description, type = 'info') {
  // Get all admin and gestor users
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'gestor'])
    .is('deleted_at', null)

  if (!admins?.length) return

  const notifications = admins.map(u => ({
    user_id: u.id,
    title,
    description,
    type,
    is_read: false,
  }))

  const { error } = await supabase
    .from('notifications')
    .insert(notifications)

  if (error) console.error('Error creating notifications:', error)
}
