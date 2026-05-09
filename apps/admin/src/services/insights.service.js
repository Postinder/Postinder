import { supabase } from './supabase'
import { computePostStatus } from './posts.service'

export async function fetchInsightsSummary(period) {
  const from = periodStart(period)
  const { data: posts } = await supabase
    .from('posts')
    .select('*, files:post_files(*)')
    .gte('created_at', from.toISOString())
    .is('deleted_at', null)

  if (!posts) return { total:0, approvalRate:0, rejectionRate:0, concluded:0 }

  const total    = posts.length
  const approved = posts.filter(p => computePostStatus(p.files) === 'approved').length
  const rejected = posts.filter(p => computePostStatus(p.files) === 'rejected').length

  return {
    total,
    approvalRate:  total ? Math.round(approved / total * 100) : 0,
    rejectionRate: total ? Math.round(rejected / total * 100) : 0,
    concluded:     approved,
  }
}

export async function fetchRejectionTags(period) {
  const from = periodStart(period)
  const { data } = await supabase
    .from('file_feedbacks')
    .select('tags, created_at')
    .gte('created_at', from.toISOString())

  const counts = {}
  ;(data || []).forEach(fb => {
    ;(fb.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1 })
  })
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export async function fetchChannelBreakdown(period) {
  const from = periodStart(period)
  const { data } = await supabase
    .from('posts')
    .select('channels')
    .gte('created_at', from.toISOString())
    .is('deleted_at', null)

  const counts = {}
  ;(data || []).forEach(p => {
    ;(p.channels || []).forEach(ch => { counts[ch] = (counts[ch] || 0) + 1 })
  })
  return Object.entries(counts).map(([channel, count]) => ({ channel, count }))
}

export async function fetchMonthlyFeedbacks({ clientId, month } = {}) {
  let q = supabase
    .from('client_feedbacks')
    .select('*, client:clients(name, color)')
    .order('created_at', { ascending: false })

  if (clientId) q = q.eq('client_id', clientId)
  if (month)    q = q.like('month', `${month}%`)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

function periodStart(period) {
  const d = new Date()
  if (period === 'week')  d.setDate(d.getDate() - 7)
  if (period === 'month') d.setMonth(d.getMonth() - 1)
  if (period === 'year')  d.setFullYear(d.getFullYear() - 1)
  return d
}
