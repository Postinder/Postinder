import { apiClient } from '../lib/axios'

export async function loginAdmin(email, password) {
  const { data } = await apiClient.post('/auth/login', {
    email,
    password,
    userType: 'admin',
  })
  localStorage.setItem('accessToken', data.accessToken)
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
  return { ...data.user, type: 'admin' }
}

export async function loginClient(email, password) {
  const { data } = await apiClient.post('/auth/login', {
    email,
    password,
    userType: 'client',
  })
  localStorage.setItem('accessToken', data.accessToken)
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
  return { ...data.user, type: 'client' }
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
}

export async function resetPassword(email) {
  await apiClient.post('/auth/forgot-password', { email })
}
