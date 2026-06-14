import { apiClient } from '../lib/axios'

export async function resetDemoData(confirmation) {
  const { data } = await apiClient.post('/maintenance/reset-demo-data', { confirmation })
  return data
}
