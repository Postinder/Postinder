import { apiClient } from '../lib/axios'

export async function fetchMonthlyFeedbacks({ clientId, month } = {}) {
  const params = {}
  if (clientId) params.clientId = clientId
  if (month) params.month = month

  const { data } = await apiClient.get('/feedback/monthly', { params })
  return data.feedbacks || []
}
