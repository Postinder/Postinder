import { apiClient } from '../lib/axios'

export async function fetchActivities(params = {}) {
  const { data } = await apiClient.get('/activities', { params })
  return data.data || []
}

export async function createActivity(activity) {
  const { data } = await apiClient.post('/activities', activity)
  return data.data
}
