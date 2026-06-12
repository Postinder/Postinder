import { useState, useEffect } from 'react'
import { BarChart2, Download, MessageSquare } from 'lucide-react'
import { fetchMonthlyFeedbacks } from '../../services/insights.service'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { createActivity } from '../../services/activities.service'
import Card from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import AIInsightsPanel from '../../components/ai/AIInsightsPanel'
import PageHeader from '../../components/ui/PageHeader'
import toast from 'react-hot-toast'

function VerticalBarChart({ data, colorFn }) {
  if (!data.length) return <div className="text-center text-neutral-400 py-8 text-sm">Sem dados no período</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2" style={{ height: '110px' }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">{d.value}</span>
          <div className="w-full rounded-t transition-all"
            style={{ height: `${Math.max(4, Math.round(d.value / max * 80))}px`, background: colorFn(i) }} />
          <span className="text-[9px] text-neutral-400 text-center leading-tight truncate w-full">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function HorizontalBarChart({ data, color }) {
  if (!data.length) return <div className="text-center text-neutral-400 py-4 text-sm">Sem dados</div>
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate" style={{ width: '70px', flexShrink: 0 }}>
            {d.label.split(' ')[0]}
          </div>
          <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${d.value}%`, background: color(d.value) }} />
          </div>
          <div className="text-xs font-semibold w-8 text-right" style={{ color: color(d.value) }}>
            {d.value}%
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ concluded, total, pending }) {
  const pct = total ? Math.round(concluded / total * 100) : 0
  const r = 30
  const ci = Math.round(2 * Math.PI * r)
  const offset = Math.round(ci * (1 - pct / 100))
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', width: 72, height: 72 }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#3087A6" strokeWidth="8"
            strokeDasharray={ci} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-extrabold text-sm" style={{ color: '#3087A6' }}>
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-3xl font-extrabold" style={{ color: '#3087A6' }}>{concluded}</div>
        <div className="text-xs text-neutral-400">concluídos</div>
        <div className="text-xs mt-1" style={{ color: '#d97706' }}>{pending} em andamento</div>
      </div>
    </div>
  )
}

function FeedbacksCard({ posts, clients, clientFilter }) {
  const filtered = posts.filter(p =>
    (p.files || []).some(f => f.feedbacks?.length > 0) &&
    (!clientFilter || p.client_id === clientFilter)
  )
  if (!filtered.length) return (
    <div className="text-center py-6 text-neutral-400 text-sm">Nenhum feedback registrado.</div>
  )
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {filtered.map(p => {
        const client = clients.find(c => c.id === p.client_id)
        const ini = client ? client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
        return (p.files || []).filter(f => f.feedbacks?.length).map(f => (
          f.feedbacks.map((fb, i) => (
            <div key={`${f.id}-${i}`} className="flex items-start gap-3 py-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: client?.color || '#888' }}>{ini}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-1">
                  {p.title} · <span className="font-normal text-neutral-400">{client?.name || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(fb.tags || []).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#f4e6ed', color: '#A7014B' }}>{t}</span>
                  ))}
                  {fb.comment && <span className="text-xs text-neutral-400 italic">"{fb.comment}"</span>}
                </div>
              </div>
            </div>
          ))
        ))
      })}
    </div>
  )
}

const COLORS = ['#A7014B','#e05577','#3087A6','#E65A00','#6B21A8','#0F766E','#B45309','#1D4ED8']
const PERIODS = [{ key:'week', label:'Semanal' }, { key:'month', label:'Mensal' }, { key:'year', label:'Anual' }]
const MONTHS  = ['2025-05','2025-04','2025-03','2025-02']
const PAGE_SIZE_OPTIONS = [5, 10]
const INSIGHTS_FILTERS_KEY = 'postinder-insights-filters'
const DASHBOARD_ACTIVITY_KEY = 'postinder-dashboard-activities'

function getSavedInsightsFilters() {
  try {
    return JSON.parse(localStorage.getItem(INSIGHTS_FILTERS_KEY) || '{}')
  } catch {
    return {}
  }
}

async function addDashboardActivity(activity) {
  try {
    await createActivity(activity)
  } catch {
    const current = JSON.parse(localStorage.getItem(DASHBOARD_ACTIVITY_KEY) || '[]')
    localStorage.setItem(DASHBOARD_ACTIVITY_KEY, JSON.stringify([activity, ...current].slice(0, 20)))
  }
}

function PaginationControls({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, totalItems)

  function handlePageSizeChange(event) {
    onPageSizeChange(Number(event.target.value))
    onPageChange(1)
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        Mostrando {start}-{end} de {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <Select value={pageSize} onChange={handlePageSizeChange} className="w-24">
          {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}/pag.</option>)}
        </Select>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-mag-500 hover:text-mag-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300"
        >
          Anterior
        </button>
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-mag-500 hover:text-mag-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}

function PaginatedFeedbacksCard({ posts, clients, clientFilter, historicalFeedbacks = [] }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const feedbackItems = getFileFeedbackItems(posts, clients, clientFilter, historicalFeedbacks)

  useEffect(() => {
    setPage(1)
  }, [clientFilter, posts])

  const totalPages = Math.max(1, Math.ceil(feedbackItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = feedbackItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (!feedbackItems.length) return (
    <div className="text-center py-6 text-neutral-400 text-sm">Nenhum feedback registrado.</div>
  )

  return (
    <>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {pageItems.map(item => (
          <div key={item.key} className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: item.client?.color || '#888' }}>{item.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold mb-1">
                {item.post.title} · <span className="font-normal text-neutral-400">{item.client?.name || '-'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(item.feedback.tags || []).map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: '#f4e6ed', color: '#A7014B' }}>{t}</span>
                ))}
                {item.feedback.comment && <span className="text-xs text-neutral-400 italic">"{item.feedback.comment}"</span>}
                {!item.feedback.comment && <span className="text-xs text-neutral-400 italic">Sem comentario detalhado</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        page={currentPage}
        pageSize={pageSize}
        totalItems={feedbackItems.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  )
}

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function getPostDate(post) {
  const value = post.updatedAt || post.updated_at || post.createdAt || post.created_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function formatMonthKey(date) {
  return date.toISOString().slice(0, 7)
}

function startOfWeek(date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + diff)
  return start
}

function endOfDay(date) {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDefaultPeriodValue(period) {
  const now = new Date()

  if (period === 'week') {
    return formatDateKey(startOfWeek(now))
  }

  if (period === 'month') {
    return formatMonthKey(now)
  }

  return String(now.getFullYear())
}

function getPeriodRange(period, value) {
  if (period === 'week') {
    const start = value ? new Date(`${value}T00:00:00`) : startOfWeek(new Date())
    return { start, end: endOfDay(addDays(start, 6)) }
  }

  if (period === 'month') {
    const [year, month] = (value || getDefaultPeriodValue('month')).split('-').map(Number)
    return {
      start: new Date(year, month - 1, 1),
      end: endOfDay(new Date(year, month, 0)),
    }
  }

  const year = Number(value || getDefaultPeriodValue('year'))
  return {
    start: new Date(year, 0, 1),
    end: endOfDay(new Date(year, 11, 31)),
  }
}

function formatPeriodOption(period, value) {
  if (period === 'week') {
    const start = new Date(`${value}T00:00:00`)
    const end = addDays(start, 6)
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
    return `${fmt.format(start)} a ${fmt.format(end)}`
  }

  if (period === 'month') {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
  }

  return value
}

function buildPeriodOptions(posts, period, selectedValue) {
  const values = new Set([selectedValue || getDefaultPeriodValue(period)])

  posts.forEach(post => {
    const date = getPostDate(post)
    if (!date) return

    if (period === 'week') values.add(formatDateKey(startOfWeek(date)))
    else if (period === 'month') values.add(formatMonthKey(date))
    else values.add(String(date.getFullYear()))
  })

  return Array.from(values)
    .sort((a, b) => b.localeCompare(a))
    .map(value => ({ value, label: formatPeriodOption(period, value) }))
}

function getStatus(post) {
  const status = computePostStatus(post)
  if (status !== 'draft' || !post?.files?.length) return status
  return computePostStatus(post.files)
}

function getSubmittedDate(post) {
  const value = post.submittedAt || post.submitted_at || post.createdAt || post.created_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDecisionDate(post) {
  const value = post.approvedAt || post.approved_at || post.updatedAt || post.updated_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function getFeedbackPostId(feedback) {
  return feedback.post_id || feedback.postId
}

function getHistoricalFeedbackDate(feedback) {
  const date = new Date(feedback.created_at || feedback.createdAt || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function getHistoricalRejectedPostIds(posts, historicalFeedbacks = []) {
  const postIds = new Set(posts.map(post => post.id))
  const rejectedIds = new Set()

  historicalFeedbacks.forEach(feedback => {
    const postId = getFeedbackPostId(feedback)
    if (postId && postIds.has(postId)) rejectedIds.add(postId)
  })

  posts.forEach(post => {
    if ((post.files || []).some(file => file.rejection_reason || file.rejection_tags?.length || file.status === 'rejected')) {
      rejectedIds.add(post.id)
    }
  })

  return rejectedIds
}

function getFileName(file) {
  return file?.name || file?.original_name || file?.originalName || file?.storage_url || file?.url || 'arquivo'
}

function getFileKey(postId, file) {
  return `${postId}:${file?.id || getFileName(file)}`
}

function getHistoricalRejectedFileKeys(posts, historicalFeedbacks = []) {
  const postById = new Map(posts.map(post => [post.id, post]))
  const rejectedKeys = new Set()

  posts.forEach(post => {
    ;(post.files || []).forEach(file => {
      if (file.status === 'rejected' || file.rejection_reason || file.rejection_tags?.length) {
        rejectedKeys.add(getFileKey(post.id, file))
      }
    })
  })

  historicalFeedbacks.forEach(feedback => {
    const postId = getFeedbackPostId(feedback)
    const post = postById.get(postId)
    if (!post) return
    const rejectedFiles = Array.isArray(feedback.rejected_files) ? feedback.rejected_files : []

    const validRejectedFiles = rejectedFiles.filter(item =>
      item?.fileId || item?.file_id || item?.fileName || item?.file_name || (Array.isArray(item?.tags) && item.tags.length)
    )

    validRejectedFiles.forEach(item => {
      const fileId = item.fileId || item.file_id
      const fileName = item.fileName || item.file_name
      const matchedFile = fileId
        ? (post.files || []).find(file => file.id === fileId)
        : (post.files || []).find(file => getFileName(file) === fileName)

      if (matchedFile) rejectedKeys.add(getFileKey(post.id, matchedFile))
      else if (fileName || fileId) rejectedKeys.add(`${post.id}:${fileId || fileName}`)
    })

    if (!validRejectedFiles.length && (feedback.text || feedback.tags?.length)) {
      rejectedKeys.add(`${post.id}:historical-feedback:${feedback.id}`)
    }
  })

  return rejectedKeys
}

function getFileFeedbackItems(posts, clients, clientFilter = '', historicalFeedbacks = []) {
  const postById = new Map(posts.map(post => [post.id, post]))
  const currentItems = posts
    .filter(post => !clientFilter || getPostClientId(post) === clientFilter)
    .flatMap(post => {
      const client = clients.find(c => c.id === getPostClientId(post))
      const initials = client ? client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

      return (post.files || [])
        .filter(file => file.rejection_reason || file.rejection_tags?.length)
        .map(file => ({
          key: `${post.id}-${file.id}`,
          post,
          file,
          client,
          initials,
          feedback: {
            tags: file.rejection_tags || [],
            comment: file.rejection_reason || '',
            created_at: file.updated_at || file.created_at || post.updatedAt || post.updated_at,
          },
        }))
    })

  const currentKeys = new Set(currentItems.map(item => `${item.post.id}-${item.feedback.comment}`))
  const historicalItems = historicalFeedbacks
    .filter(feedback => getFeedbackPostId(feedback))
    .filter(feedback => !clientFilter || feedback.client_id === clientFilter || feedback.clientId === clientFilter)
    .map(feedback => {
      const post = postById.get(getFeedbackPostId(feedback)) || { id: getFeedbackPostId(feedback), title: feedback.post_title || feedback.postTitle || 'Postagem' }
      const client = clients.find(c => c.id === (feedback.client_id || feedback.clientId)) || feedback.client
      const initials = client ? client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
      return {
        key: `historical-${feedback.id}`,
        post,
        file: { name: 'Feedback historico' },
        client,
        initials,
        feedback: {
          tags: feedback.tags || [],
          comment: feedback.text || '',
          created_at: feedback.created_at || feedback.createdAt,
        },
      }
    })
    .filter(item => item.feedback.comment)
    .filter(item => {
      const key = `${item.post.id}-${item.feedback.comment}`
      if (currentKeys.has(key)) return false
      currentKeys.add(key)
      return true
    })

  return [...currentItems, ...historicalItems]
    .sort((a, b) => new Date(b.feedback.created_at || 0) - new Date(a.feedback.created_at || 0))
}

function getTagAnalysis(posts, historicalFeedbacks = []) {
  const postsWithTag = new Map()
  const rejectedPostIds = new Set()
  const validPostIds = new Set(posts.map(post => post.id))

  posts.forEach(post => {
    const tags = new Set()
    ;(post.files || []).forEach(file => {
      ;(file.rejection_tags || []).forEach(tag => tags.add(tag))
    })
    if (!tags.size) return
    rejectedPostIds.add(post.id)
    tags.forEach(tag => {
      if (!postsWithTag.has(tag)) postsWithTag.set(tag, new Set())
      postsWithTag.get(tag).add(post.id)
    })
  })

  historicalFeedbacks.forEach(feedback => {
    const postId = getFeedbackPostId(feedback)
    if (!postId || !validPostIds.has(postId)) return
    const tags = Array.isArray(feedback.tags) ? feedback.tags.filter(Boolean) : []
    if (!tags.length) return
    rejectedPostIds.add(postId)
    tags.forEach(tag => {
      if (!postsWithTag.has(tag)) postsWithTag.set(tag, new Set())
      postsWithTag.get(tag).add(postId)
    })
  })

  const denominator = rejectedPostIds.size || 0
  return Array.from(postsWithTag.entries())
    .map(([label, postIds]) => ({
      label,
      count: postIds.size,
      value: denominator ? Math.round((postIds.size / denominator) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || b.count - a.count)
}

function formatAverageDuration(hours) {
  if (!hours) return 'Sem dados'
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rest = Math.round(hours % 24)
  return rest ? `${days}d ${rest}h` : `${days}d`
}

function getActivityData(posts, period, periodRange) {
  if (period === 'week') {
    const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
    const values = Array(7).fill(0)

    posts.forEach(post => {
      const date = getPostDate(post)
      if (!date) return
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const diff = Math.round((dayStart - periodRange.start) / 86400000)
      if (diff >= 0 && diff < 7) values[diff] += 1
    })

    return values.map((value, index) => {
      const date = addDays(periodRange.start, index)
      return { label: labels[date.getDay()], value }
    })
  }

  if (period === 'month') {
    const values = [0, 0, 0, 0]
    posts.forEach(post => {
      const date = getPostDate(post)
      if (!date) return
      const bucket = Math.min(3, Math.floor((date.getDate() - 1) / 7))
      values[bucket] += 1
    })
    return values.map((value, index) => ({ label: `S${index + 1}`, value }))
  }

  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const values = Array(12).fill(0)
  posts.forEach(post => {
    const date = getPostDate(post)
    if (date) values[date.getMonth()] += 1
  })
  return labels.map((label, index) => ({ label, value: values[index] }))
}

function csvValue(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function csvLine(values) {
  return values.map(csvValue).join(';')
}

function downloadCSV(filename, sections) {
  const content = sections
    .flatMap(section => [
      section.title,
      csvLine(section.headers),
      ...section.rows.map(csvLine),
      '',
    ])
    .join('\n')

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getSafeFilenamePart(value) {
  return normalizeString(value || 'todos')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeString(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function MetricCard({ label, value, color, sub }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </Card>
  )
}

export default function InsightsPage() {
  const savedFilters = getSavedInsightsFilters()
  const [period, setPeriod]   = useState(savedFilters.period || 'week')
  const [periodValue, setPeriodValue] = useState(savedFilters.periodValue || getDefaultPeriodValue(savedFilters.period || 'week'))
  const [tab, setTab]         = useState(savedFilters.tab || 'metrics')
  const [clients, setClients] = useState([])
  const [posts, setPosts]     = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [historicalFeedbacks, setHistoricalFeedbacks] = useState([])
  const [metricsClientFilter, setMetricsClientFilter] = useState(savedFilters.metricsClientFilter || '')
  const [fbFilter, setFbFilter]   = useState(savedFilters.fbFilter || '')
  const [fbClientFilter, setFbClientFilter] = useState(savedFilters.fbClientFilter || '')
  const [fbMonth, setFbMonth] = useState(savedFilters.fbMonth || '')
  const [feedbacksPage, setFeedbacksPage] = useState(1)
  const [feedbacksPageSize, setFeedbacksPageSize] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchClients(), fetchPosts(), fetchMonthlyFeedbacks()])
      .then(([c, p, hf]) => { setClients(c); setPosts(p); setHistoricalFeedbacks(hf) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'feedbacks') {
      fetchMonthlyFeedbacks({ clientId: fbFilter || undefined, month: fbMonth || undefined })
        .then(setFeedbacks).catch(() => {})
    }
  }, [tab, fbFilter, fbMonth])

  useEffect(() => {
    setFeedbacksPage(1)
  }, [fbFilter, fbMonth, feedbacksPageSize])

  useEffect(() => {
    localStorage.setItem(INSIGHTS_FILTERS_KEY, JSON.stringify({
      tab,
      period,
      periodValue,
      metricsClientFilter,
      fbFilter,
      fbClientFilter,
      fbMonth,
    }))
  }, [tab, period, periodValue, metricsClientFilter, fbFilter, fbClientFilter, fbMonth])

  const periodOptions = buildPeriodOptions(posts, period, periodValue)
  const periodRange = getPeriodRange(period, periodValue)
  const metricsPosts = posts.filter(post => {
    const date = getPostDate(post)
    return (!metricsClientFilter || getPostClientId(post) === metricsClientFilter) &&
      date &&
      date >= periodRange.start &&
      date <= periodRange.end
  })
  const activeMetricsClient = clients.find(c => c.id === metricsClientFilter)

  const total     = metricsPosts.length
  const approved  = metricsPosts.filter(p => getStatus(p) === 'approved').length
  const currentRejected  = metricsPosts.filter(p => getStatus(p) === 'rejected').length
  const pending   = metricsPosts.filter(p => ['pending_approval','pending','updated','draft'].includes(getStatus(p))).length
  const historicalRejectedPostIds = getHistoricalRejectedPostIds(metricsPosts, historicalFeedbacks)
  const initiallyRejected = historicalRejectedPostIds.size
  const initiallyApproved = metricsPosts.filter(post => getStatus(post) === 'approved' && !historicalRejectedPostIds.has(post.id)).length
  const initialDecisionTotal = initiallyApproved + initiallyRejected
  const approvalRate  = initialDecisionTotal ? Math.round(initiallyApproved / initialDecisionTotal * 100) : 0
  const rejectionRate = initialDecisionTotal ? Math.round(initiallyRejected / initialDecisionTotal * 100) : 0
  const concludedWithRevision = metricsPosts.filter(post => getStatus(post) === 'approved' && historicalRejectedPostIds.has(post.id)).length
  const concludedWithoutRevision = metricsPosts.filter(post => getStatus(post) === 'approved' && !historicalRejectedPostIds.has(post.id)).length
  const totalFiles = metricsPosts.reduce((sum, post) => sum + (post.files || []).length, 0)
  const rejectedFileKeys = getHistoricalRejectedFileKeys(metricsPosts, historicalFeedbacks)
  const rejectedFiles = Math.min(rejectedFileKeys.size, totalFiles)
  const approvedFiles = Math.max(0, totalFiles - rejectedFiles)
  const fileApprovalRate = totalFiles ? Math.round((approvedFiles / totalFiles) * 100) : 0
  const fileRejectionRate = totalFiles ? Math.round((rejectedFiles / totalFiles) * 100) : 0
  const decisionDurations = metricsPosts
    .filter(post => ['approved', 'rejected'].includes(getStatus(post)))
    .map(post => {
      const submitted = getSubmittedDate(post)
      const decided = getDecisionDate(post)
      if (!submitted || !decided || decided < submitted) return null
      return (decided - submitted) / 36e5
    })
    .filter(value => Number.isFinite(value) && value >= 0)
  const averageDecisionHours = decisionDurations.length
    ? decisionDurations.reduce((sum, value) => sum + value, 0) / decisionDurations.length
    : 0

  const rejectionFeedbackItems = getFileFeedbackItems(metricsPosts, clients, '', historicalFeedbacks)
  const tagAnalysisData = getTagAnalysis(metricsPosts, historicalFeedbacks)
  const rejTagsData = tagAnalysisData.slice(0, 8)

  const chanCounts = {}
  metricsPosts.forEach(p => (p.channels||[]).forEach(ch => {
    const k = ch.split('/')[0].slice(0, 10)
    chanCounts[k] = (chanCounts[k]||0) + 1
  }))
  const chanData = Object.entries(chanCounts).map(([label, value]) => ({ label, value }))

  const actLabels = period === 'week'
    ? ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
    : period === 'month'
      ? ['S1','S2','S3','S4']
      : ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const actValues = period === 'week' ? [3,5,2,6,4,1,2]
    : period === 'month' ? [12,18,9,15]
    : [8,12,15,10,18,22,16,14,20,11,9,13]
  const actData = getActivityData(metricsPosts, period, periodRange)

  const clientApproval = clients.map(c => {
    const cp = posts.filter(p => {
      const date = getPostDate(p)
      return getPostClientId(p) === c.id && date && date >= periodRange.start && date <= periodRange.end
    })
    const rejectedIds = getHistoricalRejectedPostIds(cp, historicalFeedbacks)
    const firstApproved = cp.filter(p => getStatus(p) === 'approved' && !rejectedIds.has(p.id)).length
    const firstTotal = firstApproved + rejectedIds.size
    const r  = firstTotal ? Math.round(firstApproved / firstTotal * 100) : 0
    return { label: c.name, value: r }
  })
  const clientRejection = clients.map(c => {
    const cp = posts.filter(p => {
      const date = getPostDate(p)
      return getPostClientId(p) === c.id && date && date >= periodRange.start && date <= periodRange.end
    })
    const rejectedIds = getHistoricalRejectedPostIds(cp, historicalFeedbacks)
    const firstApproved = cp.filter(p => getStatus(p) === 'approved' && !rejectedIds.has(p.id)).length
    const firstTotal = firstApproved + rejectedIds.size
    const r  = firstTotal ? Math.round(rejectedIds.size / firstTotal * 100) : 0
    return { label: c.name, value: r }
  })
  const approvalChartData = activeMetricsClient
    ? [{ label: activeMetricsClient.name, value: approvalRate }]
    : clientApproval
  const rejectionChartData = activeMetricsClient
    ? [{ label: activeMetricsClient.name, value: rejectionRate }]
    : clientRejection
  const feedbacksTotalPages = Math.max(1, Math.ceil(feedbacks.length / feedbacksPageSize))
  const currentFeedbacksPage = Math.min(feedbacksPage, feedbacksTotalPages)
  const paginatedFeedbacks = feedbacks.slice(
    (currentFeedbacksPage - 1) * feedbacksPageSize,
    currentFeedbacksPage * feedbacksPageSize
  )
  const clientById = new Map(clients.map(client => [client.id, client]))

  const monthLabel = m => new Date(m + '-01').toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
  const periodLabel = PERIODS.find(item => item.key === period)?.label || period
  const selectedPeriodLabel = formatPeriodOption(period, periodValue)

  function handleExportMetrics() {
    const clientLabel = activeMetricsClient?.name || 'Todos os clientes'
    const feedbackRows = rejectionFeedbackItems.map(item => [
      item.client?.name || '',
      item.post.title || '',
      item.file.name || item.file.original_name || item.file.originalName || '',
      (item.feedback.tags || []).join(', '),
      item.feedback.comment || '',
    ])

    const postRows = metricsPosts.map(post => {
      const client = clientById.get(getPostClientId(post))
      return [
        post.title || '',
        client?.name || '',
        getStatus(post),
        (post.channels || []).join(', '),
        getPostDate(post)?.toLocaleDateString('pt-BR') || '',
      ]
    })

    downloadCSV(
      `insights-${getSafeFilenamePart(periodLabel)}-${getSafeFilenamePart(selectedPeriodLabel)}-${getSafeFilenamePart(clientLabel)}.csv`,
      [
        {
          title: 'Resumo',
          headers: ['Indicador', 'Valor'],
          rows: [
            ['Periodo', periodLabel],
            ['Recorte', selectedPeriodLabel],
            ['Cliente', clientLabel],
            ['Total de posts', total],
            ['Aprovados', approved],
            ['Recusados atualmente', currentRejected],
            ['Recusados na primeira analise', initiallyRejected],
            ['Aprovados sem revisao', initiallyApproved],
            ['Pendentes ou em andamento', pending],
            ['Concluidos com revisao', concludedWithRevision],
            ['Concluidos sem revisao', concludedWithoutRevision],
            ['Arquivos analisados', totalFiles],
            ['Arquivos aprovados inicialmente', approvedFiles],
            ['Arquivos recusados inicialmente', rejectedFiles],
            ['Taxa de aprovacao inicial por item', `${fileApprovalRate}%`],
            ['Taxa de recusa inicial por item', `${fileRejectionRate}%`],
            ['Taxa de aprovação', `${approvalRate}%`],
            ['Taxa de reprovação', `${rejectionRate}%`],
            ['Tempo médio de análise', formatAverageDuration(averageDecisionHours)],
          ],
        },
        {
          title: 'Atividade',
          headers: ['Periodo', 'Quantidade'],
          rows: actData.map(item => [item.label, item.value]),
        },
        {
          title: 'Motivos de reprovação',
          headers: ['Motivo', 'Percentual', 'Postagens'],
          rows: rejTagsData.map(item => [item.label, `${item.value}%`, item.count]),
        },
        {
          title: 'Posts por canal',
          headers: ['Canal', 'Quantidade'],
          rows: chanData.map(item => [item.label, item.value]),
        },
        {
          title: 'Posts do recorte',
          headers: ['Título', 'Cliente', 'Status', 'Canais', 'Data'],
          rows: postRows,
        },
        {
          title: 'Feedbacks de reprovação',
          headers: ['Cliente', 'Post', 'Arquivo', 'Tags', 'Comentario'],
          rows: feedbackRows,
        },
      ]
    )
    addDashboardActivity({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'insights_exported',
      title: 'Exportação realizada',
      description: `Insights exportados · ${clientLabel} · ${selectedPeriodLabel}`,
      date: new Date().toISOString(),
      tone: 'teal',
      clientId: activeMetricsClient?.id || '',
    })
    toast.success('Insights exportados em CSV.')
  }

  return (
    <div>
      <PageHeader icon={BarChart2} title="Insights & Feedbacks" />

      <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden w-fit mb-6">
        {[{ key:'metrics', label:'📊 Métricas' }, { key:'feedbacks', label:'💬 Feedbacks' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold transition-all ${tab === t.key ? 'bg-mag-500 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden w-fit">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => { setPeriod(p.key); setPeriodValue(getDefaultPeriodValue(p.key)) }}
                  className={`px-4 py-2 text-sm font-semibold transition-all ${period === p.key ? 'bg-mag-500 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <Select value={periodValue} onChange={e => setPeriodValue(e.target.value)} className="w-56">
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Select value={metricsClientFilter} onChange={e => setMetricsClientFilter(e.target.value)} className="w-56">
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <button
              type="button"
              onClick={handleExportMetrics}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-neutral-400">Carregando métricas...</div>
          ) : (
            <>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Visao: {activeMetricsClient?.name || 'Todos os clientes'}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
                <MetricCard label="Total de Posts"     value={total}              color="text-neutral-900 dark:text-white" sub="no período" />
                <MetricCard label="Taxa de Aprovação"  value={`${approvalRate}%`} color="text-green-600"  sub="dos conteúdos" />
                <MetricCard label="Taxa de Reprovação" value={`${rejectionRate}%`}color="text-red-600"    sub="precisam ajuste" />
                <MetricCard label="Concluídos"         value={approved}           color="text-teal-600"   sub="aprovados" />
                <MetricCard label="Tempo médio"         value={formatAverageDuration(averageDecisionHours)} color="text-blue-600" sub="aprovar/reprovar" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Aprovacao inicial" value={`${approvalRate}%`} color="text-green-600" sub="sem revisao" />
                <MetricCard label="Recusa inicial" value={`${rejectionRate}%`} color="text-red-600" sub="teve apontamento" />
                <MetricCard label="Concluidos com revisao" value={concludedWithRevision} color="text-amber-600" sub="corrigidos e aprovados" />
                <MetricCard label="Concluidos sem revisao" value={concludedWithoutRevision} color="text-teal-600" sub="aprovados direto" />
              </div>

              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Visao por item / arquivo
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Arquivos analisados" value={totalFiles} color="text-neutral-900 dark:text-white" sub="itens no periodo" />
                <MetricCard label="Aprovacao inicial por item" value={`${fileApprovalRate}%`} color="text-green-600" sub={`${approvedFiles} sem ajuste`} />
                <MetricCard label="Recusa inicial por item" value={`${fileRejectionRate}%`} color="text-red-600" sub={`${rejectedFiles} com apontamento`} />
                <MetricCard label="Itens com ajuste" value={rejectedFiles} color="text-amber-600" sub="condicao inicial" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Análise de tags de reprovação</h3>
                  <VerticalBarChart
                    data={rejTagsData}
                    colorFn={i => COLORS[i % COLORS.length]}
                  />
                  {rejTagsData.length ? (
                    <div className="mt-4 space-y-2">
                      {rejTagsData.map(item => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-800">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">{item.label}</span>
                          <span className="font-bold text-mag-600">{item.value}% das postagens com feedback</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Posts por canal</h3>
                  <VerticalBarChart
                    data={chanData}
                    colorFn={i => COLORS[(i + 2) % COLORS.length]}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Taxa de aprovação</h3>
                  <HorizontalBarChart
                    data={approvalChartData}
                    color={v => v >= 60 ? '#16a34a' : v >= 30 ? '#d97706' : '#dc2626'}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Atividade</h3>
                  <VerticalBarChart data={actData} colorFn={() => '#3087A6'} />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Taxa de reprovação</h3>
                  <HorizontalBarChart
                    data={rejectionChartData}
                    color={v => v > 40 ? '#dc2626' : v > 20 ? '#d97706' : '#16a34a'}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Projetos concluídos</h3>
                  <DonutChart concluded={approved} total={total} pending={pending} />
                </Card>

              </div>

              <Card className="p-5 mb-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-bold text-sm">Feedbacks de reprovação (por arquivo)</h3>
                  <Select value={metricsClientFilter || fbClientFilter} onChange={e => setFbClientFilter(e.target.value)} disabled={Boolean(metricsClientFilter)} className="w-52">
                    <option value="">Todos os clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <PaginatedFeedbacksCard posts={metricsPosts} clients={clients} clientFilter={metricsClientFilter || fbClientFilter} historicalFeedbacks={historicalFeedbacks} />
              </Card>

              <AIInsightsPanel posts={metricsPosts} clients={activeMetricsClient ? [activeMetricsClient] : clients} period={period} />
            </>
          )}
        </>
      )}

      {tab === 'feedbacks' && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <Select value={fbFilter} onChange={e => setFbFilter(e.target.value)} className="w-56">
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={fbMonth} onChange={e => setFbMonth(e.target.value)} className="w-48">
              <option value="">Todos os meses</option>
              {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Total"     value={feedbacks.length}                           color="text-neutral-900 dark:text-white" sub="feedbacks" />
            <MetricCard label="Positivos" value={feedbacks.filter(f => f.rating >= 4).length} color="text-green-600"  sub="4-5 estrelas" />
            <MetricCard label="Negativos" value={feedbacks.filter(f => f.rating < 4).length}  color="text-red-600"    sub="1-3 estrelas" />
          </div>

          {feedbacks.length === 0 ? (
            <Card className="p-12 text-center text-neutral-400">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum feedback encontrado.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginatedFeedbacks.map(fb => {
                const isPos = fb.rating >= 4
                const stars = Array.from({ length:5 }, (_,i) => i < fb.rating ? '⭐' : '☆').join('')
                return (
                  <Card key={fb.id} className={`p-4 border-l-4 ${isPos ? 'border-green-400' : 'border-red-400'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fb.client?.name || 'Cliente'}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPos ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                          {isPos ? 'Positivo' : 'Negativo'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400">{new Date(fb.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-base mb-2">{stars}</div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 leading-relaxed">{fb.text}</p>
                  </Card>
                )
              })}
              <Card className="p-4">
                <PaginationControls
                  page={currentFeedbacksPage}
                  pageSize={feedbacksPageSize}
                  totalItems={feedbacks.length}
                  onPageChange={setFeedbacksPage}
                  onPageSizeChange={setFeedbacksPageSize}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
