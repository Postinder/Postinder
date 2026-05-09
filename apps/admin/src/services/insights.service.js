import { apiClient } from '../lib/axios'

export async function fetchInsightsSummary(period) {
  const { data } = await apiClient.get('/insights/summary', { params: { period } })
  return data
}

export async function fetchRejectionTags(period) {
  const { data } = await apiClient.get('/insights/rejection-tags', { params: { period } })
  return data.tags || []
}

export async function fetchChannelBreakdown(period) {
  const { data } = await apiClient.get('/insights/channel-breakdown', { params: { period } })
  return data.breakdown || []
}

export async function fetchMonthlyFeedbacks({ clientId, month } = {}) {
  const params = {}
  if (clientId) params.clientId = clientId
  if (month) params.month = month

  const { data } = await apiClient.get('/feedback/monthly', { params })
  return data.feedbacks || []
}
