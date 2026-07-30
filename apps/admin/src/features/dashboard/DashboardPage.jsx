import { useState, useEffect, useCallback, useReducer } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Trash2, Edit3, RotateCcw, Plus, Search, Eye,
  Building2, SlidersHorizontal, X, ArrowUpDown, CalendarDays, Paperclip, UploadCloud,
  Activity, CheckCircle, MessageSquare, UserPlus, ChevronDown
} from 'lucide-react'
import { fetchPosts, softDeletePost, computePostStatus, updatePost, resubmitPost, replacePostFile } from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import { fetchActivities } from '../../services/activities.service'
import { useAuthStore } from '../../store/authStore'
import { StatusBadge, Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea, Select } from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import PageHeader from '../../components/ui/PageHeader'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { validateUploadFile } from '../../utils/uploadValidation'
import DeletePostModal, { canDeletePost } from '../../components/posts/DeletePostModal'
import MediaPreview from '../../components/media/MediaPreview'
import { DASHBOARD_PANELS_INITIAL_STATE, toggleDashboardPanel } from '../../utils/collapsiblePanels'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending_approval', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Recusados' },
  { key: 'draft', label: 'Rascunhos' },
]

const DASHBOARD_SCOPE_OPTIONS = [
  { key: 'active', label: 'Clientes ativos' },
  { key: 'all', label: 'Geral' },
]

const FILE_LABELS = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  PDF: 'PDF',
  DOC: 'Doc',
  SHEET: 'Planilha',
  PPTX: 'Slides',
}

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function isClientActive(client) {
  return client?.is_active !== false && client?.isActive !== false
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

  if (!current && !previous) return { tone: 'neutral', text: 'Nenhum movimento nesta semana' }
  if (percent === null) return { tone: 'positive', text: `+${current} esta semana` }
  if (diff === 0) return { tone: 'neutral', text: 'Estável vs semana anterior' }

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

function buildRecentActivities(posts, clients, clientFilter, backendActivities = [], limit = 50) {
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
    .slice(0, limit)
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
  const [replacementFiles, setReplacementFiles] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (post) {
      setTitle(post.title || '')
      setCaption(post.description || '')
      setJust('')
      setReplacementFiles({})
    }
  }, [post])

  const isRej = post?.status === 'rejected'
  const rejectedFiles = (post?.files || []).filter(file => file.status === 'rejected')

  async function handleSave() {
    setSaving(true)
    try {
      if (isRej) {
        if (!rejectedFiles.length) {
          toast.error('Nenhum arquivo reprovado para corrigir.')
          setSaving(false)
          return
        }
        if (rejectedFiles.some(file => !replacementFiles[file.id])) {
          toast.error('Anexe um novo arquivo para cada item reprovado.')
          setSaving(false)
          return
        }
        if (!just.trim() || just.trim().length < 10) {
          toast.error('Justificativa deve ter ao menos 10 caracteres.')
          setSaving(false)
          return
        }
        await Promise.all(rejectedFiles.map(file => replacePostFile(post.id, file.id, replacementFiles[file.id])))
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
      title={isRej ? 'Corrigir arquivos reprovados' : 'Editar Postagem'}
      subtitle={isRej ? 'Substitua cada arquivo reprovado por uma nova versão antes de reenviar ao cliente.' : 'Edite os dados da postagem.'}
    >
      <div className="space-y-4">
        {isRej ? (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Cada item reprovado precisa de um novo arquivo. Os arquivos aprovados permanecem como estao.
            </div>

            <div className="space-y-3">
              {rejectedFiles.map(file => {
                const previewUrl = resolveMediaUrl(file.storage_url || file.url)
                return (
                  <div key={file.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
                        <MediaPreview file={file} src={previewUrl} className="h-full w-full" mediaClassName="h-full w-full object-cover" controls={false} compact />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-bold text-neutral-900 dark:text-white">{file.name}</div>
                        {file.rejection_reason && <p className="mt-1 text-xs text-red-500">{file.rejection_reason}</p>}
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm transition-colors hover:border-mag-500 hover:bg-mag-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-mag-500/10">
                      <div className="flex min-w-0 items-center gap-2">
                        <UploadCloud size={17} className="shrink-0 text-mag-500" />
                        <span className="truncate font-semibold text-neutral-700 dark:text-neutral-200">
                          {replacementFiles[file.id]?.name || 'Anexar novo arquivo'}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-mag-500">Escolher</span>
                      <input
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                        className="hidden"
                        onChange={event => {
                          const nextFile = event.target.files?.[0]
                          const validationError = nextFile ? validateUploadFile(nextFile) : null
                          if (validationError) toast.error(validationError)
                          else if (nextFile) setReplacementFiles(current => ({ ...current, [file.id]: nextFile }))
                          event.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <Input label="Título" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea label="Legenda / Descrição" value={caption} onChange={e => setCaption(e.target.value)} />
          </>
        )}

        {isRej && (
          <Textarea
            label="O que foi corrigido? *"
            value={just}
            onChange={e => setJust(e.target.value)}
            placeholder="Ex: Substitui os arquivos com o texto corrigido e ajustei o visual conforme o feedback."
          />
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 justify-center" variant={isRej ? 'teal' : 'primary'}>
            {isRej ? 'Reenviar para cliente' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setSF] = useState('all')
  const [dashboardScope, setDashboardScope] = useState('active')
  const [sortBy, setSortBy] = useState('updated')
  const [activityLimit, setActivityLimit] = useState(5)
  const [activityPage, setActivityPage] = useState(1)
  const [dashboardPanels, dispatchDashboardPanel] = useReducer(toggleDashboardPanel, DASHBOARD_PANELS_INITIAL_STATE)
  const { activity: isActivityExpanded, posts: isPostsExpanded } = dashboardPanels
  const [editPost, setEditPost] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const clientFilter = searchParams.get('client') || ''
  const isReadOnly = String(user?.role || '').trim().toLowerCase() === 'viewer'

  function setClientFilter(id) {
    if (id) setSearchParams({ client: id })
    else setSearchParams({})
  }

  const load = useCallback(() => {
    Promise.all([fetchPosts(), fetchClients({ includeInactive: true }), fetchActivities({ limit: 50 })])
      .then(([p, c, a]) => { setPosts(p); setClients(c); setActivities(a) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!postToDelete) return
    setDeleteLoading(true)
    try {
      await softDeletePost(postToDelete.id)
      setPosts(posts => posts.filter(post => post.id !== postToDelete.id))
      setPostToDelete(null)
      toast.success('Postagem excluida.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  async function sendApprovalNotification(clientId) {
    try {
      await notifyClient(clientId)
      toast.success('Mensagem via WhatsApp foi enviada.')
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Não foi possível enviar o WhatsApp.')
    }
  }

  const activeClientIds = new Set(clients.filter(isClientActive).map(client => client.id))
  const scopedClients = dashboardScope === 'active'
    ? clients.filter(client => activeClientIds.has(client.id))
    : clients
  const scopedPosts = dashboardScope === 'active'
    ? posts.filter(post => activeClientIds.has(getPostClientId(post)))
    : posts
  const scopedActivities = dashboardScope === 'active'
    ? activities.filter(item => {
      const clientId = item.clientId || item.client_id
      return !clientId || activeClientIds.has(clientId)
    })
    : activities
  const activeClient = clients.find(c => c.id === clientFilter)

  function getPostClient(post) {
    return clients.find(c => c.id === getPostClientId(post)) || {}
  }

  const filtered = scopedPosts.filter(p => {
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
    all: scopedPosts.filter(isCurrentClient).length,
    pending_approval: scopedPosts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'pending_approval').length,
    approved: scopedPosts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'approved').length,
    rejected: scopedPosts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'rejected').length,
    draft: scopedPosts.filter(p => isCurrentClient(p) && computePostStatus(p) === 'draft').length,
  }
  const metricCards = [
    { label: 'Total de Posts', value: counts.all, color: 'text-neutral-900 dark:text-white', key: 'all', description: 'Postagens no contexto atual' },
    { label: 'Pendentes', value: counts.pending_approval, color: 'text-amber-600', key: 'pending_approval', description: 'Aguardando aprovação' },
    { label: 'Aprovados', value: counts.approved, color: 'text-green-600', key: 'approved', description: 'Conteúdos liberados' },
    { label: 'Recusados', value: counts.rejected, color: 'text-red-600', key: 'rejected', description: 'Precisam de correção' },
  ].map(metric => ({
    ...metric,
    trend: getWeeklyTrend(scopedPosts, metric.key, clientFilter),
  }))
  useEffect(() => {
    setActivityPage(1)
  }, [clientFilter, activityLimit, dashboardScope])

  const recentActivities = buildRecentActivities(scopedPosts, scopedClients, clientFilter, scopedActivities, 50)
  const activityTotalPages = Math.max(1, Math.ceil(recentActivities.length / activityLimit))
  const currentActivityPage = Math.min(activityPage, activityTotalPages)
  const visibleActivities = recentActivities.slice((currentActivityPage - 1) * activityLimit, currentActivityPage * activityLimit)

  const activeStatus = STATUS_OPTIONS.find(s => s.key === statusFilter)?.label || 'Todos'
  const activeScope = DASHBOARD_SCOPE_OPTIONS.find(option => option.key === dashboardScope)?.label || 'Clientes ativos'
  const selectedInactiveClient = activeClient && !isClientActive(activeClient)

  function openPostsFromMetric(statusKey) {
    const params = new URLSearchParams()
    if (clientFilter) params.set('client', clientFilter)

    if (statusKey === 'approved') {
      params.set('view', 'completed')
    } else if (statusKey !== 'all') {
      params.set('status', statusKey)
    }

    const query = params.toString()
    navigate(`/admin/posts${query ? `?${query}` : ''}`)
  }

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title={
          activeClient ? (
            <>
              <button onClick={() => setClientFilter('')} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-base font-normal">Dashboard</button>
              <span className="text-neutral-300 dark:text-neutral-600 mx-2">/</span>
              {activeClient.name}
            </>
          ) : 'Dashboard'
        }
        actions={!isReadOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="secondary" onClick={() => navigate('/admin/posts')}>
              Gerenciar postagens
            </Button>
            <Button size="md" icon={<Plus size={16} />} onClick={() => navigate('/admin/posts/new')} className="px-5 shadow-sm shadow-mag-500/20">
              Nova Postagem
            </Button>
          </div>
        ) : null}
      />

      <Card className="mb-4">
        <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mag-50 text-mag-500 dark:bg-mag-500/10">
                <Building2 size={17} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Empresa em foco</div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {activeClient?.name || (dashboardScope === 'active' ? 'Todas as empresas ativas' : 'Todas as empresas')}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="rounded-full bg-white px-3 py-1.5 font-medium dark:bg-neutral-800">
                Visao: <strong className="text-neutral-800 dark:text-neutral-100">{activeScope}</strong>
              </span>
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
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(240px,1.05fr)_220px_minmax(240px,1fr)_200px]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Buscar</span>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, descrição ou cliente..."
                className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-mag-500 dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Visao</span>
            <Select value={dashboardScope} onChange={e => setDashboardScope(e.target.value)}>
              {DASHBOARD_SCOPE_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Empresa</span>
            <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
              <option value="">Todas as empresas</option>
              {selectedInactiveClient && dashboardScope === 'active' ? (
                <option value={activeClient.id}>{activeClient.name} (desativado)</option>
              ) : null}
              {scopedClients.map(c => <option key={c.id} value={c.id}>{c.name}{!isClientActive(c) ? ' (desativado)' : ''}</option>)}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {metricCards.map(m => (
          <button
            key={m.key}
            onClick={() => openPostsFromMetric(m.key)}
            className="group text-left p-5 rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-mag-300 hover:shadow-lg hover:shadow-neutral-900/5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-mag-500/60 dark:hover:shadow-black/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{m.label}</div>
                <div className={`text-4xl font-extrabold ${m.color}`}>{m.value}</div>
              </div>
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-neutral-200 transition-colors group-hover:bg-mag-500 dark:bg-neutral-700" />
            </div>
            <div className="mt-3 text-xs text-neutral-400">{m.description}</div>
            <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${getTrendClass(m.trend.tone)}`}>
              {m.trend.text}
            </div>
          </button>
        ))}
      </div>

      <Card className="mb-4 overflow-hidden">
        <div className={`flex flex-wrap items-center justify-between gap-3 bg-neutral-50/80 p-4 dark:bg-neutral-900 ${isActivityExpanded ? 'border-b border-neutral-200 dark:border-neutral-800' : ''}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
              <Activity size={17} />
            </div>
            <div className="min-w-0">
              <h2 id="dashboard-activity-title" className="text-sm font-bold text-neutral-900 dark:text-white">Atividade recente</h2>
              <div className="mt-0.5 truncate text-xs text-neutral-400">
                {activeClient ? `Últimos eventos de ${activeClient.name}` : 'Últimos eventos do sistema'}
              </div>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
              {recentActivities.length} evento{recentActivities.length !== 1 ? 's' : ''}
            </span>
            {isActivityExpanded ? (
              <Select value={activityLimit} onChange={event => setActivityLimit(Number(event.target.value))} className="w-28">
                <option value={5}>5 itens</option>
                <option value={10}>10 itens</option>
              </Select>
            ) : null}
            <button
              type="button"
              onClick={() => dispatchDashboardPanel('activity')}
              aria-expanded={isActivityExpanded}
              aria-controls="dashboard-activity-content"
              aria-label={`${isActivityExpanded ? 'Recolher' : 'Expandir'} Atividade recente`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-mag-300 hover:text-mag-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mag-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-mag-500 dark:hover:text-mag-300 dark:focus-visible:ring-offset-neutral-900"
            >
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`transition-transform duration-200 motion-reduce:transition-none ${isActivityExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
        <div
          id="dashboard-activity-content"
          role="region"
          aria-labelledby="dashboard-activity-title"
          hidden={!isActivityExpanded}
        >
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/80">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400">Evento</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400">Detalhe</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {visibleActivities.map(item => {
                    const Icon = item.icon
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getActivityToneClass(item.tone)}`}>
                              <Icon size={15} />
                            </div>
                            <span className="font-semibold text-neutral-900 dark:text-white">{item.title}</span>
                          </div>
                        </td>
                        <td className="max-w-[340px] px-4 py-3">
                          <div className="truncate text-neutral-500 dark:text-neutral-400">{item.description}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-neutral-400">{formatActivityTime(item.date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <span>
                  Página {currentActivityPage} de {activityTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivityPage(page => Math.max(1, page - 1))}
                    disabled={currentActivityPage <= 1}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 transition-colors hover:border-mag-500 hover:text-mag-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityPage(page => Math.min(activityTotalPages, page + 1))}
                    disabled={currentActivityPage >= activityTotalPages}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 transition-colors hover:border-mag-500 hover:text-mag-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-neutral-400">
              Nenhuma atividade recente encontrada para este filtro.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className={`flex flex-wrap items-center justify-between gap-3 p-4 ${isPostsExpanded ? 'border-b border-neutral-200 dark:border-neutral-800' : ''}`}>
          <div className="min-w-0 flex-1">
            <h2 id="dashboard-posts-title" className="text-sm font-semibold text-neutral-900 dark:text-white">
              Postagens <span className="text-neutral-400 font-normal">({sortedPosts.length})</span>
            </h2>
            <div className="mt-1 truncate text-xs text-neutral-400">{activeClient?.name || activeScope} - {activeStatus}</div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {isPostsExpanded ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                <ArrowUpDown size={14} />
                Ordenar
                <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-40">
                  <option value="updated">Mais recentes</option>
                  <option value="client">Cliente</option>
                  <option value="status">Status</option>
                  <option value="title">Título</option>
                </Select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => dispatchDashboardPanel('posts')}
              aria-expanded={isPostsExpanded}
              aria-controls="dashboard-posts-content"
              aria-label={`${isPostsExpanded ? 'Recolher' : 'Expandir'} Postagens`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-mag-300 hover:text-mag-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mag-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-mag-500 dark:hover:text-mag-300 dark:focus-visible:ring-offset-neutral-900"
            >
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`transition-transform duration-200 motion-reduce:transition-none ${isPostsExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
        <div
          id="dashboard-posts-content"
          role="region"
          aria-labelledby="dashboard-posts-title"
          hidden={!isPostsExpanded}
        >
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
            <>
            <div className="space-y-3 p-3 md:hidden">
              {sortedPosts.map(post => {
                const st = computePostStatus(post)
                const client = getPostClient(post)
                const files = post.files || []
                const isRej = st === 'rejected'
                const canDelete = canDeletePost(st, user?.role)
                const firstFile = files[0]
                const updatedAt = post.updatedAt || post.updated_at || post.createdAt || post.created_at
                return (
                  <article key={post.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={client.name} color={client.color} size="md" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-neutral-900 dark:text-white">{client.name || '--'}</div>
                          <div className="text-xs text-neutral-400">{formatDate(updatedAt)}</div>
                        </div>
                      </div>
                      <StatusBadge status={st} />
                    </div>
                    <div className="mt-3 flex gap-3">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
                        {firstFile
                          ? <MediaPreview file={firstFile} className="h-full w-full" mediaClassName="h-full w-full object-cover" controls={false} compact />
                          : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-neutral-500 dark:text-neutral-300">Sem midia</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-extrabold text-neutral-950 dark:text-white">{post.title || '(sem titulo)'}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{post.description || 'Sem descricao cadastrada.'}</p>
                        <div className="mt-2 text-xs font-semibold text-neutral-400">{files.length} arquivo(s)</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button onClick={() => navigate(`/admin/feed?client=${getPostClientId(post)}&post=${post.id}`)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                        <Eye size={13} /> Feed
                      </button>
                      {!isReadOnly && (
                        <>
                          {isRej ? (
                            <button onClick={() => setEditPost(post)} className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"><RotateCcw size={13} /> Corrigir</button>
                          ) : st !== 'executed' ? (
                            <button onClick={() => setEditPost(post)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"><Edit3 size={13} /> Editar</button>
                          ) : null}
                          {canDelete ? <button onClick={() => setPostToDelete(post)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/30"><Trash2 size={13} /> Excluir</button> : null}
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Conteúdo</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Arquivos</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Status</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Atualizado</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map(post => {
                  const st = computePostStatus(post)
                  const client = getPostClient(post)
                  const files = post.files || []
                  const isRej = st === 'rejected'
                  const canDelete = canDeletePost(st, user?.role)
                  const firstFile = files[0]
                  const updatedAt = post.updatedAt || post.updated_at || post.createdAt || post.created_at

                  return (
                    <tr key={post.id} className="h-[82px] border-b border-neutral-100 dark:border-neutral-800/70 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/35">
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
                            {firstFile
                              ? <MediaPreview file={firstFile} className="h-full w-full" mediaClassName="h-full w-full object-cover" controls={false} compact />
                              : <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-neutral-500 dark:text-neutral-300">Sem mídia</div>}
                          </div>
                          <div className="min-w-0">
                            <div className="line-clamp-1 font-semibold text-neutral-900 dark:text-white">{post.title || '(sem título)'}</div>
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
                          {isReadOnly ? (
                            <span className="text-xs font-semibold text-neutral-400">Somente leitura</span>
                          ) : (
                            <>
                              {isRej ? (
                                <button onClick={() => setEditPost(post)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold">
                                  <RotateCcw size={11} /> Corrigir
                                </button>
                              ) : st !== 'executed' ? (
                                <button onClick={() => setEditPost(post)}
                                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500" title="Editar">
                                  <Edit3 size={14} />
                                </button>
                              ) : null}
                              {canDelete ? <button onClick={() => setPostToDelete(post)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500" title="Excluir">
                                <Trash2 size={14} />
                              </button> : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>
      </Card>

      <EditPostModal post={editPost} open={!!editPost} onClose={() => setEditPost(null)} onSave={async () => {
        if (editPost?.status === 'rejected') {
          await sendApprovalNotification(getPostClientId(editPost))
        }
        load()
      }} />
      <DeletePostModal
        post={postToDelete}
        status={postToDelete ? computePostStatus(postToDelete) : ''}
        open={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
