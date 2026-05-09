import { apiClient } from '../lib/axios'

export async function loginAdmin(email, password) {
  const { data } = await apiClient.post('/auth/login', {
    email,
    password,
    userType: 'admin',
  })
  localStorage.setItem('accessToken', data.accessToken)
  localStorage.setItem('refreshToken', data.refreshToken)
  return data.user
}

export async function loginClient(email, password) {
  const { data } = await apiClient.post('/auth/login', {
    email,
    password,
    userType: 'client',
  })
  localStorage.setItem('accessToken', data.accessToken)
  localStorage.setItem('refreshToken', data.refreshToken)
  return data.user
}

export async function logout() {
  await apiClient.post('/auth/logout')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

export async function resetPassword(email) {
  await apiClient.post('/auth/forgot-password', { email })
}
