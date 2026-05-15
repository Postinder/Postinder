import { apiClient } from '../lib/axios'

export async function fetchUsers() {
  const { data } = await apiClient.get('/users')
  return data.data || []
}

export async function createUser(userData) {
  const { data } = await apiClient.post('/users', userData)
  return data
}

export async function updateUser(userId, updates) {
  const { data } = await apiClient.put(`/users/${userId}`, updates)
  return data
}

export async function deleteUser(userId) {
  await apiClient.delete(`/users/${userId}`)
}
