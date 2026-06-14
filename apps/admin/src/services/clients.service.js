import { apiClient } from '../lib/axios'

function getApiError(error) {
  return new Error(error.response?.data?.error || error.message || 'Erro ao processar solicitacao.')
}

export async function fetchClients(options = {}) {
  const params = {}
  if (options.includeInactive) params.includeInactive = true
  const { data } = await apiClient.get('/clients', { params })
  return data.data || data || []
}

export async function createClient(clientData) {
  try {
    const { data } = await apiClient.post('/clients', clientData)
    return data.data || data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function updateClient(clientId, updates) {
  const { data } = await apiClient.put(`/clients/${clientId}`, updates)
  return data.data || data
}

export async function softDeleteClient(clientId) {
  try {
    await apiClient.delete(`/clients/${clientId}`)
  } catch (error) {
    throw getApiError(error)
  }
}

export async function deleteClientPermanently(clientId) {
  try {
    await apiClient.delete(`/clients/${clientId}/permanent`)
  } catch (error) {
    throw getApiError(error)
  }
}

export async function activateClient(clientId) {
  const { data } = await apiClient.patch(`/clients/${clientId}/activate`)
  return data.data || data
}

export async function notifyClient(clientId) {
  const { data } = await apiClient.post(`/clients/${clientId}/notify`)
  return data
}

export async function generateClientPortalLink(clientId, days = 15) {
  const { data } = await apiClient.post(`/clients/${clientId}/portal-link`, { days })
  return data
}

export function parseVCFText(text) {
  const contacts = []
  const vcfEntries = text.split('BEGIN:VCARD')

  for (const entry of vcfEntries) {
    if (!entry.includes('FN:')) continue

    const contact = {
      name: '',
      email: '',
      phone: '',
      selected: false,
      password: '',
      segment: '',
    }

    const lines = entry.split('\n')
    for (const line of lines) {
      if (line.startsWith('FN:')) contact.name = line.replace('FN:', '').trim()
      if (line.startsWith('EMAIL')) contact.email = line.split(':')[1]?.trim() || ''
      if (line.startsWith('TEL')) contact.phone = line.split(':')[1]?.trim() || ''
    }

    if (contact.name && contact.phone) {
      contacts.push(contact)
    }
  }

  return contacts
}
