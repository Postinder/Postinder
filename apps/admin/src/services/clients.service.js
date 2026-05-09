import { apiClient } from '../lib/axios'

export async function fetchClients() {
  const { data } = await apiClient.get('/clients')
  return data.data || data || []
}

export async function createClient(clientData) {
  const { data } = await apiClient.post('/clients', clientData)
  return data
}

export async function updateClient(clientId, updates) {
  const { data } = await apiClient.put(`/clients/${clientId}`, updates)
  return data
}

export async function softDeleteClient(clientId) {
  await apiClient.delete(`/clients/${clientId}`)
}
