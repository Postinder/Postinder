import { apiClient } from '../lib/axios'

export async function fetchBranding() {
  const { data } = await apiClient.get('/branding')
  return data
}

export async function uploadBrandingLogo(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post('/branding/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function removeBrandingLogo() {
  const { data } = await apiClient.delete('/branding/logo')
  return data
}
