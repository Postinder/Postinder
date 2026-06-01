import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Trash2, Edit3, RotateCcw, Plus, Search,
  Building2, SlidersHorizontal, X, ArrowUpDown, CalendarDays, Paperclip, Activity, CheckCircle, MessageSquare, UserPlus
} from 'lucide-react'
import { fetchPosts, softDeletePost, computePostStatus, updatePost, resubmitPost } from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import { fetchActivities } from '../../services/activities.service'
import { StatusBadge, Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea, Select } from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending_approval', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Recusados' },
  { key: 'draft', label: 'Rascunhos' },
]

const FILE_LABELS = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  PDF: 'PDF',
  DOC: 'Doc',
  SHEET: 'Planilha',
  PPTX: 'Slides',
}
const DASHBOARD_ACTIVITY_KEY = 'postinder-dashboard-activities'

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function getPostDate(post) {
  const value = post.updatedAt || post.updated_at || post.createdAt || post.created_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

function startOfWeek(date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + diff)
  return start
}

function getWeeklyTrend(posts, statusKey, clientFilter) {
  const now = new Date()
  const currentStart = startOfWeek(now)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 7)

  const inScope = post => {
    const date = getPostDate(post)
    const status = computePostStatus(post)
    const matchesClient = !clientFilter || getPostClientId(post) === clientFilter
    const matchesStatus = statusKey === 'all' || status === statusKey
    return matchesClient && matchesStatus && date.getTime() > 0
  }

  const current = posts.filter(post => {
    const date = getPostDate(post)
    return inScope(post) && date >= currentStart && date <= now
  }).length

  const previous = posts.filter(post => {
    const date = getPostDate(post)
    return inScope(post) && date >= previousStart && date < currentStart
  }).length

  const diff = current - previous
  const percent = previous ? Math.round((diff / previous) * 100) : null

  if (!current && !previous) {
    return { tone: 'neutral', text: 'Nenhum movimento nesta semana' }
  }

  if (percent === null) {
    return { tone: 'positive', text: `+${current} esta semana` }
  }

  if (diff === 0) {
    return { tone: 'neutral', text: 'Estavel vs semana anterior' }
  }

  return {
    tone: diff > 0 ? 'positive' : 'negative',
    text: `${diff > 0 ? '+' : ''}${diff} esta semana (${diff > 0 ? '+' : ''}${percent}%)`,
  }
}

function getTrendClass(tone) {
  if (tone === 'positive') return 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
  if (tone === 'negative') return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
  return 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
}

function formatActivityTime(value) {
  const date = value instanceof Date ? value : new Date(value || 0)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getActivityIcon(type) {
  if (['post_approved', 'file_approved'].includes(type)) return CheckCircle
  if (['feedback_sent', 'monthly_feedback_sent', 'post_rejected'].includes(type)) return MessageSquare
  if (['client_created', 'client_updated', 'approval_notification_sent'].includes(type)) return UserPlus
  return Activity
}

function getActivityTone(type, fallback = 'neutral') {
  if (['post_approved', 'file_approved'].includes(type)) return 'green'
  if (['feedback_sent', 'monthly_feedback_sent', 'post_rejected'].includes(type)) return 'red'
  if (['client_created', 'client_updated', 'approval_notification_sent', 'insights_exported'].includes(type)) return 'teal'
  return fallback
}

function buildRecentActivities(posts, clients, clientFilter, backendActivities = []) {
  const activities = []
  const clientById = new Map(clients.map(client => [client.id, client]))
  const isCurrentClient = id => !clientFilter || id === clientFilter
  const seen = new Set()

  function addActivity(item) {
    const key = `${item.type || 'activity'}-${item.postId || item.post_id || ''}-${item.clientId || item.client_id || ''}`
    if (key !== 'activity--' && seen.has(key)) return
    seen.add(key)
    activities.push(item)
  }

  backendActivities.forEach(item => {
    const clientId = item.clientId || item.client_id
    if (clientFilter && clientId !== clientFilter) return
    addActivity({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description || 'Atividade registrada no sistema.',
      date: item.createdAt || item.created_at,
      icon: getActivityIcon(item.type),
      tone: getActivityTone(item.type),
      clientId,
      postId: item.postId || item.post_id,
    })
  })

  try {
    const storedActivities = JSON.parse(localStorage.getItem(DASHBOARD_ACTIVITY_KEY) || '[]')
    storedActivities.forEach(item => {
      if (clientFilter && item.clientId !== clientFilter) return
      addActivity({
        ...item,
        id: `stored-${item.id}`,
        icon: Activity,
        tone: item.tone || 'teal',
      })
    })
  } catch {
    // If the local activity log is corrupted, ignore it and keep the dashboard usable.
  }

  clients.forEach(client => {
    const date = client.createdAt || client.created_at
    if (!date || !isCurrentClient(client.id)) return
    addActivity({
      id: `client-${client.id}`,
      type: 'client_created',
      title: 'Cliente criado',
      description: client.name,
      date,
      icon: UserPlus,
      tone: 'teal',
      clientId: client.id,
    })
  })

  posts.forEach(post => {
    const clientId = getPostClientId(post)
    if (!isCurrentClient(clientId)) return

    const client = clientById.get(clientId)
    const status = computePostStatus(post)
    const updatedAt = post.updatedAt || post.updated_at || post.createdAt || post.created_at

    if (post.createdAt || post.created_at) {
      addActivity({
        id: `post-created-${post.id}`,
        type: 'post_created',
        title: 'Post criado',
        description: `${post.title || 'Post sem título'}${client?.name ? ` · ${client.name}` : ''}`,
        date: post.createdAt || post.created_at,
        icon: Plus,
        tone: 'neutral',
        clientId,
        postId: post.id,
      })
    }

    if (status === 'approved') {
      addActivity({
        id: `post-approved-${post.id}`,
        type: 'post_approved',
        title: 'Post aprovado',
        description: `${post.title || 'Post sem título'}${client?.name ? ` · ${client.name}` : ''}`,
        date: post.approvedAt || post.approved_at || updatedAt,
        icon: CheckCircle,
        tone: 'green',
        clientId,
        postId: post.id,
      })
    }

    ;(post.files || []).forEach(file => {
      if (!file.rejection_reason && !file.rejection_tags?.length) return
      addActivity({
        id: `feedback-${file.id || file.name}-${post.id}`,
        type: 'feedback_sent',
        title: 'Feedback enviado',
        description: `${post.title || 'Post sem título'}${client?.name ? ` · ${client.name}` : ''}`,
        date: file.updated_at || updatedAt,
        icon: MessageSquare,
        tone: 'red',
        clientId,
        postId: post.id,
      })
    })
  })

  return activities
    .filter(item => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)
}

function getActivityToneClass(tone) {
  if (tone === 'green') return 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300'
  if (tone === 'red') return 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
  if (tone === 'teal') return 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300'
  return 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'
}

function EditPostModal({ post, open, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [just, setJust] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (post) {
      setTitle(post.title || '')
      setCaption(post.description || '')
      setJust('')
    }
  }, [post])

  const isRej = post?.status === 'rejected'

  async function handleSave() {
    setSaving(true)
    try {
      if (isRej) {
        if (!just.trim() || just.trim().length < 10) {
          toast.error('Justificativa deve ter ao menos 10 caracteres.')
          setSaving(false)
          return
        }
        await resubmitPost(post.id, { title, caption, justificativa: just })
        toast.success('Reenviado para aprovação!')
      } else {
        await updatePost(post.id, { title, description: caption })
        toast.success('Postagem atualizada!')
      }
      onSave()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!post) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isRej ? 'Corrigir e Reenviar' : 'Editar Postagem'}
      subtitle={isRej ? 'Corrija e reenvie para nova aprovação do cliente.' : 'Edite os dados da postagem.'}
    >
      <div className="space-y-4">
        {isRej && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Arquivos reprovados pelo cliente</p>
            {(post.files || []).filter(f => f.status === 'rejected').map(f => (
              <div key={f.id} className="text-xs text-red-500">- {f.name}</div>
            ))}
          </div>
        )}
        <Input label="Titulo" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea label="Legenda / Descricao" value={caption} onChange={e => setCaption(e.target.value)} />
        {isRej && (
          <Textarea
            label="O que foi corrigido? *"
            value={just}
            onChange={e => setJust(e.target.value)}
            placeholder="Explique o que foi ajustado..."
          />
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 justify-center" variant={isRej ? 'teal' : 'primary'}>
            {isRej ? 'Reenviar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setSF] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [editPost, setEditPost] = useState(null)

  const clientFilter = searchParams.get('client') || ''

  function setClientFilter(id) {
    if (id) setSearchParams({ client: id })
    else setSearchParams({})
  }

  const load = useCallback(() => {
    Promise.all([fetchPosts(), fetchClients(), fetchActivities({ limit: 30 })])
      .then(([p, c, a]) => { setPosts(p); setClients(c); setActivities(a) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Excluir esta postagem?')) return
    await softDeletePost(id)
    setPosts(p => p.filter(x => x.id !== id))
    toast.success('Postagem excluida.')
  }

  async function sendApprovalNotification(clientId) {
    try {
      await notifyClient(clientId)
      toast.success('Mensagem via WhatsApp foi enviada.')
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Não foi possível enviar o WhatsApp.')
    }
  }

  const activeClient = clients.find(c => c.id === clientFilter)

  function getPostClient(post) {
    return clients.find(c => c.id === getPostClientId(post)) || {}
  }

  const filtered = posts.filter(p => {
    const st = computePostStatus(p)
    const client = getPostClient(p)
    const haystack = `${p.title || ''} ${p.description || ''} ${client.name || ''}`.toLowerCase()
    if (search && !haystack.includes(search.toLowerCase())) return false
    if (clientFilter && getPostClientId(p) !== clientFilter) return false
    if (statusFilter !== 'all' && st !== statusFilter) return false
    return true
  })

  const sortedPosts = [...filtered].sort((a, b) => {
    if (sortBy === 'client') return (getPostClient(a).name || '').localeCompare(getPostClient(b).name || '')
    if (sortBy === 'status') return computePostStatus(a).localeCompare(computePostStatus(b))
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '')
    return getPostDate(b).getTime() - getPostDate(a).getTime()
  })

  const isCurrentClient = p => !clientFilter || getPostClientId(p) === clientFilter
  const counts = {
    all: posts.filter(isCurrentClient).length,
    pending_approval: posts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'pending_approval').length,
    approved: posts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'approved').length,
    rejected: posts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'rejected').length,
    draft: posts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'draft').length,
  }
  const metricCards = [
    { label: 'Total de Posts', value: counts.all, color: 'text-neutral-900 dark:text-white', key: 'all', description: 'Postagens no contexto atual' },
    { label: 'Pendentes', value: counts.pending_approval, color: 'text-amber-600', key: 'pending_approval', description: 'Aguardando aprovação' },
    { label: 'Aprovados', value: counts.approved, color: 'text-green-600', key: 'approved', description: 'Conteudos liberados' },
    { label: 'Recusados', value: counts.rejected, color: 'text-red-600', key: 'rejected', description: 'Precisam de correção' },
  ].map(metric => ({
    ...metric,
    trend: getWeeklyTrend(posts, metric.key, clientFilter),
  }))

  const recentActivities = buildRecentActivities(posts, clients, clientFilter, activities)
  const activeStatus = STATUS_OPTIONS.find(s => s.key === statusFilter)?.label || 'Todos'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-mag-500" />
          <h1 className="text-xl font-bold">
            {activeClient ? (
              <>
                <button onClick={() => setClientFilter('')} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-base font-normal">Dashboard</button>
                <span className="text-neutral-300 dark:text-neutral-600 mx-2">/</span>
                {activeClient.name}
              </>
            ) : 'Dashboard'}
          </h1>
        </div>
        <Button size="md" icon={<Plus size={16} />} onClick={() => navigate('/admin/posts/new')} className="px-5 shadow-sm shadow-mag-500/20">
          Nova Postagem
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {metricCards.map(m => (
          <button
            key={m.key}
            onClick={() => setSF(statusFilter === m.key ? 'all' : m.key)}
            className={`group text-left p-5 rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-900/5 dark:bg-neutral-900 dark:hover:shadow-black/20 ${statusFilter === m.key ? 'border-mag-500 shadow-[inset_0_0_0_1px_#A7014B]' : 'border-neutral-200 dark:border-neutral-800 hover:border-mag-300 dark:hover:border-mag-500/60'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{m.label}</div>
                <div className={`text-4xl font-extrabold ${m.color}`}>{m.value}</div>
              </div>
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusFilter === m.key ? 'bg-mag-500' : 'bg-neutral-200 dark:bg-neutral-700 group-hover:bg-neutral-300 dark:group-hover:bg-neutral-600'}`} />
            </div>
            <div className="mt-3 text-xs text-neutral-400">{m.description}</div>
            <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${getTrendClass(m.trend.tone)}`}>
              {m.trend.text}
            </div>
          </button>
        ))}
      </div>

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
              <Activity size={17} />
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-900 dark:text-white">Atividade recente</div>
              <div className="mt-0.5 text-xs text-neutral-400">
                {activeClient ? `Últimos eventos de ${activeClient.name}` : 'Últimos eventos do sistema'}
              </div>
            </div>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
            {recentActivities.length} evento{recentActivities.length !== 1 ? 's' : ''}
          </span>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-64" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : recentActivities.length ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentActivities.map(item => {
              const Icon = item.icon
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/70">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getActivityToneClass(item.tone)}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white">{item.title}</div>
                    <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{item.description}</div>
                  </div>
                  <div className="shrink-0 text-[11px] font-medium text-neutral-400">{formatActivityTime(item.date)}</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-neutral-400">
            Nenhuma atividade recente encontrada para este filtro.
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mag-50 text-mag-500 dark:bg-mag-500/10">
                <Building2 size={17} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Empresa em foco</div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">{activeClient?.name || 'Todas as empresas'}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="rounded-full bg-white px-3 py-1.5 font-medium dark:bg-neutral-800">
                Status: <strong className="text-neutral-800 dark:text-neutral-100">{activeStatus}</strong>
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 font-medium dark:bg-neutral-800">
                {sortedPosts.length} resultado{sortedPosts.length !== 1 ? 's' : ''}
              </span>
              {(clientFilter || statusFilter !== 'all' || search) && (
                <button onClick={() => { setClientFilter(''); setSF('all'); setSearch('') }}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold text-mag-500 hover:bg-mag-50 dark:hover:bg-mag-500/10">
                  <X size={13} /> Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1.15fr)_minmax(260px,1fr)_220px]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Buscar</span>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, descrição ou cliente..."
                className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-mag-500 dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Empresa</span>
            <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
              <option value="">Todas as empresas</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              <SlidersHorizontal size={13} /> Status
            </span>
            <Select value={statusFilter} onChange={e => setSF(e.target.value)}>
              {STATUS_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white">
              Postagens <span className="text-neutral-400 font-normal">({sortedPosts.length})</span>
            </div>
            <div className="mt-1 text-xs text-neutral-400">{activeClient?.name || 'Todas as empresas'} - {activeStatus}</div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <ArrowUpDown size={14} />
            Ordenar
            <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-40">
              <option value="updated">Mais recentes</option>
              <option value="client">Cliente</option>
              <option value="status">Status</option>
              <option value="title">Titulo</option>
            </Select>
          </label>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="grid grid-cols-[1.2fr_2fr_1fr_1fr_1fr_1fr] gap-4 items-center py-2">
                  <Skeleton className="h-9 w-36" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <div className="p-10 text-center text-neutral-400">
              <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Nenhuma postagem encontrada</div>
              <p className="mt-1 text-sm">Ajuste os filtros ou crie uma nova postagem para este cliente.</p>
              <button onClick={() => navigate('/admin/posts/new')} className="mt-3 text-mag-500 hover:text-mag-600 text-sm font-semibold">
                + Criar primeira postagem
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[1040px] table-fixed text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[34%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/80">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Conteudo</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Arquivos</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Status</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Atualizado</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map(post => {
                  const st = computePostStatus(post)
                  const client = getPostClient(post)
                  const files = post.files || []
                  const isRej = st === 'rejected'
                  const firstFile = files[0]
                  const updatedAt = post.updatedAt || post.updated_at || post.createdAt || post.created_at

                  return (
                    <tr key={post.id} className="h-[82px] border-b border-neutral-100 transition-colors dark:border-neutral-800/70 hover:bg-mag-50/40 dark:hover:bg-mag-500/10">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.name} color={client.color} size="md" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{client.name || '--'}</div>
                            <div className="text-xs text-neutral-400">Cliente</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
                            {firstFile?.file_type === 'IMAGE' && firstFile?.storage_url
                              ? <img src={firstFile.storage_url} alt="" className="h-full w-full object-cover" onError={e => e.target.style.display = 'none'} />
                              : <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-neutral-500 dark:text-neutral-300">{firstFile ? FILE_LABELS[firstFile.file_type] || 'Arquivo' : 'Sem mídia'}</div>
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="line-clamp-1 font-semibold text-neutral-900 dark:text-white">{post.title || '(sem titulo)'}</div>
                            <div className="mt-1 line-clamp-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                              {post.description || 'Sem descrição cadastrada.'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/feed?client=${getPostClientId(post)}&post=${post.id}`)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-mag-50 hover:text-mag-500 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-mag-500/10 dark:hover:text-mag-300"
                            title="Ver postagem no feed"
                          >
                            <Paperclip size={12} /> {files.length}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <StatusBadge status={st} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          <CalendarDays size={13} />
                          {formatDate(updatedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-1 items-center">
                          {isRej ? (
                            <button onClick={() => setEditPost(post)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold">
                              <RotateCcw size={11} /> Corrigir
                            </button>
                          ) : (
                            <button onClick={() => setEditPost(post)}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500" title="Editar">
                              <Edit3 size={14} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(post.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <EditPostModal post={editPost} open={!!editPost} onClose={() => setEditPost(null)} onSave={async () => {
        if (editPost?.status === 'rejected') {
          await sendApprovalNotification(getPostClientId(editPost))
        }
        load()
      }} />
    </div>
  )
}
