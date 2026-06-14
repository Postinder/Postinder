import { apiClient } from '../lib/axios'

function getApiError(error) {
  return new Error(error.response?.data?.error || error.message || 'Erro ao processar solicitacao.')
}

export async function fetchUsers() {
  const { data } = await apiClient.get('/users')
  return data.data || []
}

export async function createUser(userData) {
  try {
    const { data } = await apiClient.post('/users', userData)
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function updateUser(userId, updates) {
  try {
    const { data } = await apiClient.put(`/users/${userId}`, updates)
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function deleteUser(userId) {
  try {
    await apiClient.delete(`/users/${userId}`)
  } catch (error) {
    throw getApiError(error)
  }
}
