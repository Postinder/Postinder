import { apiClient } from '../lib/axios'

export async function fetchNotifications() {
  const { data } = await apiClient.get('/notifications')
  return data.data || []
}

export async function markNotificationsAsRead(notificationIds) {
  const { data } = await apiClient.post('/notifications/read', { notificationIds })
  return data.data || []
}

export async function markAllNotificationsAsRead() {
  const { data } = await apiClient.post('/notifications/read-all')
  return data.data || []
}
