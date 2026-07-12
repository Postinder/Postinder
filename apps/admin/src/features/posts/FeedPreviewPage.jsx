import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Grid, ImageIcon, Building2, Filter, CalendarDays, CheckCircle, Circle, Clock, MessageSquare, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Input'
import PageHeader from '../../components/ui/PageHeader'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import toast from 'react-hot-toast'

const STATUS_DOT = {
  draft: 'bg-neutral-300',
  sent: 'bg-amber-400',
  pending: 'bg-amber-400',
  pending_approval: 'bg-amber-400',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
}

const STATUS_FILTERS = [
  { value: '', label: 'Todos os estados' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Recusado' },
  { value: 'pending_approval', label: 'Aguardando' },
  { value: 'draft', label: 'Rascunho' },
]

const FEED_SCOPE_OPTIONS = [
  { value: 'active', label: 'Clientes ativos' },
  { value: 'all', label: 'Geral' },
]

function normalizeFeedStatus(status) {
  if (['sent', 'pending', 'pending_approval'].includes(status)) return 'pending_approval'
  return status || 'draft'
}

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function isClientActive(client) {
  return client?.is_active !== false && client?.isActive !== false
}

function formatDate(value) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

const RETENTION_LABELS = {
  immediate: 'Imediatamente',
  '1d': '1 dia',
  '7d': '7 dias',
  '30d': '30 dias',
  never: 'Nunca',
}

function isStorageDeleted(file) {
  return Boolean(file?.storage_deleted_at || file?.storageDeletedAt)
}

function buildPostTimeline(post) {
  const status = computePostStatus(post)
  const hasRejected = (post.files || []).some(file => file.status === 'rejected' || file.rejection_reason)
  const hasApproved = status === 'approved'
  const submittedAt = post.submittedAt || post.submitted_at || post.updatedAt || post.updated_at

  const steps = [
    { key: 'created', label: 'Criado', date: post.createdAt || post.created_at, done: true },
    { key: 'analysis', label: 'Em analise', date: submittedAt, done: ['sent', 'pending_approval', 'approved', 'rejected'].includes(status) },
  ]

  if (hasRejected) {
    steps.push(
      { key: 'rejected', label: 'Recusado', date: post.updatedAt || post.updated_at, done: true },
      { key: 'corrected', label: 'Corrigido', date: post.updatedAt || post.updated_at, done: ['pending_approval', 'approved'].includes(status) },
    )
  }

  steps.push({ key: 'approved', label: 'Aprovado', date: post.approvedAt || post.approved_at || post.updatedAt || post.updated_at, done: hasApproved })

  const firstPendingIndex = steps.findIndex(step => !step.done)
  return steps.map((step, index) => ({
    ...step,
    current: firstPendingIndex === index || (firstPendingIndex === -1 && index === steps.length - 1),
  }))
}
function PostDetailsModal({ post, client, open, onClose }) {
  const [activeFileIndex, setActiveFileIndex] = useState(0)

  useEffect(() => {
    setActiveFileIndex(0)
  }, [post?.id, open])

  if (!post) return null

  const timeline = buildPostTimeline(post)
  const files = post.files || []
  const status = computePostStatus(post)
  const activeFile = files[activeFileIndex] || files[0]
  const activeFileRemoved = isStorageDeleted(activeFile)
  const activeFileUrl = activeFileRemoved ? null : resolveMediaUrl(activeFile?.url || activeFile?.storage_url)
  const activeFileIsImage = (activeFile?.file_type || '').toUpperCase() === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg)$/i.test(activeFile?.name || '')
  const retentionPolicy = post.filesRetentionPolicy || post.files_retention_policy

  function moveFile(delta) {
    if (!files.length) return
    setActiveFileIndex(current => (current + delta + files.length) % files.length)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post.title || 'Detalhes do post'}
      size="xl"
      subtitle={client?.name || 'Cliente não identificado'}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Status</div>
            <div className="mt-2"><StatusBadge status={status} /></div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Arquivos</div>
            <div className="mt-2 text-sm font-bold text-neutral-900 dark:text-white">{files.length}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Atualizado</div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
              <CalendarDays size={14} /> {formatDate(post.updatedAt || post.updated_at)}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
            <Clock size={16} className="text-mag-500" />
            Timeline do post
          </div>
          <div className="space-y-3">
            {timeline.map((step, index) => {
              const Icon = step.done ? CheckCircle : Circle
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.done ? 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300' : step.current ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>
                      <Icon size={16} />
                    </div>
                    {index < timeline.length - 1 && <div className="mt-1 h-6 w-px bg-neutral-200 dark:bg-neutral-800" />}
                  </div>
                  <div className="min-w-0 pb-2">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white">{step.label}</div>
                    <div className="text-xs text-neutral-400">{step.done ? formatDate(step.date) : 'Aguardando andamento'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {files.some(file => file.rejection_reason || file.rejection_tags?.length) && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
              <MessageSquare size={15} /> Feedbacks de reprovação
            </div>
            <div className="space-y-2">
              {files.filter(file => file.rejection_reason || file.rejection_tags?.length).map(file => (
                <div key={file.id || file.name} className="text-xs text-red-700 dark:text-red-300">
                  <strong>{file.name || file.original_name || 'Arquivo'}:</strong> {file.rejection_reason || 'Sem comentário textual'}
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length ? (
          <div>
            <div className="mb-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
                  <ImageIcon size={16} className="text-mag-500" />
                  Previa dos arquivos
                </div>
                <div className="text-xs font-bold text-neutral-400">
                  {activeFileIndex + 1}/{files.length}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="relative flex min-h-80 items-center justify-center">
                  {activeFileRemoved ? (
                    <div className="max-w-sm px-6 text-center text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                      <ImageIcon size={28} className="mx-auto mb-3" />
                      <div>Arquivo removido automaticamente conforme politica de retencao.</div>
                      <div className="mt-2 text-xs font-medium">Removido em {formatDate(activeFile.storage_deleted_at || activeFile.storageDeletedAt)}{retentionPolicy ? ` · ${RETENTION_LABELS[retentionPolicy] || retentionPolicy}` : ''}</div>
                    </div>
                  ) : activeFileIsImage && activeFileUrl ? (
                    <img
                      src={activeFileUrl}
                      alt={activeFile?.name || activeFile?.original_name || 'Arquivo'}
                      className="max-h-[58vh] w-full object-contain"
                    />
                  ) : activeFileUrl ? (
                    <iframe
                      title={activeFile?.name || activeFile?.original_name || 'Arquivo'}
                      src={activeFileUrl}
                      className="h-[58vh] w-full bg-white"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-sm font-semibold text-neutral-400">
                      <ImageIcon size={28} />
                      Arquivo indisponivel para visualizacao.
                    </div>
                  )}

                  {files.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => moveFile(-1)}
                        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow transition hover:bg-white hover:text-mag-600 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:bg-neutral-900"
                        title="Arquivo anterior"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFile(1)}
                        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow transition hover:bg-white hover:text-mag-600 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:bg-neutral-900"
                        title="Proximo arquivo"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-neutral-700 dark:text-neutral-200">
                      {activeFile?.name || activeFile?.original_name || 'Arquivo'}
                    </div>
                    <div className="text-[11px] font-semibold text-neutral-400">
                      Arquivo {activeFileIndex + 1} de {files.length}
                    </div>
                  </div>
                  {activeFileUrl && (
                    <a
                      href={activeFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <ExternalLink size={13} />
                      Abrir
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
              <ImageIcon size={16} className="text-mag-500" />
              Arquivos na ordem da postagem
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {files.map((file, index) => {
                const storageDeleted = isStorageDeleted(file)
                const url = storageDeleted ? null : resolveMediaUrl(file.url || file.storage_url)
                const isImage = (file.file_type || '').toUpperCase() === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name || '')
                const content = <>
                  <div className="relative h-36 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    {storageDeleted ? (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-neutral-400">Arquivo removido conforme retencao</div>
                    ) : isImage && url ? (
                      <img src={url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-neutral-400">
                        {file.file_type || 'Arquivo'}
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white">
                      {index + 1}/{files.length}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-xs font-semibold text-neutral-600 group-hover:text-mag-600 dark:text-neutral-300">
                    {file.name || file.original_name || 'Arquivo'}
                  </div>
                  {storageDeleted && <div className="mt-1 text-[11px] font-medium text-neutral-400">{formatDate(file.storage_deleted_at || file.storageDeletedAt)}{retentionPolicy ? ` · ${RETENTION_LABELS[retentionPolicy] || retentionPolicy}` : ''}</div>}
                </>
                return (
                  storageDeleted ? (
                    <div key={file.id || `${file.name}-${index}`} className="rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">{content}</div>
                  ) : (
                    <a key={file.id || `${file.name}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-neutral-200 p-2 transition hover:border-mag-300 dark:border-neutral-800">{content}</a>
                  )
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export default function FeedPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [feedScope, setFeedScope] = useState('active')

  const filter = searchParams.get('client') || ''
  const selectedPostId = searchParams.get('post') || ''
  const statusFilter = searchParams.get('status') || ''

  function updateFilters(next) {
    const params = {}
    const client = next.client ?? filter
    const status = next.status ?? statusFilter
    if (client) params.client = client
    if (status) params.status = status
    if (selectedPostId) params.post = selectedPostId
    setSearchParams(params)
  }

  function setFilter(id) {
    updateFilters({ client: id })
  }

  function setStatusFilter(status) {
    updateFilters({ status })
  }

  useEffect(() => {
    Promise.all([fetchPosts(), fetchClients({ includeInactive: true })])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const activeClientIds = new Set(clients.filter(isClientActive).map(client => client.id))
  const scopedClients = feedScope === 'active'
    ? clients.filter(client => activeClientIds.has(client.id))
    : clients
  const scopedPosts = feedScope === 'active'
    ? posts.filter(post => activeClientIds.has(getPostClientId(post)))
    : posts

  const filtered = scopedPosts
    .filter(p => !filter || p.client_id === filter || p.clientId === filter)
    .filter(p => !statusFilter || normalizeFeedStatus(computePostStatus(p)) === statusFilter)
    .sort((a, b) => {
      if (selectedPostId && a.id === selectedPostId) return -1
      if (selectedPostId && b.id === selectedPostId) return 1
      return 0
    })
  const activeClient = clients.find(c => c.id === filter)
  const selectedInactiveClient = activeClient && !isClientActive(activeClient)
  const activeStatusLabel = STATUS_FILTERS.find(item => item.value === statusFilter)?.label || 'Todos os estados'
  const activeScopeLabel = FEED_SCOPE_OPTIONS.find(item => item.value === feedScope)?.label || 'Clientes ativos'
  const selectedClient = selectedPost ? clients.find(c => c.id === getPostClientId(selectedPost)) : null

  return (
    <div>
      <PageHeader
        icon={Grid}
        title="Prévia do Feed"
        subtitle="Visualize os posts por cliente no formato de grade."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <ImageIcon size={14} />
            {filtered.length} post{filtered.length !== 1 ? 's' : ''}
          </div>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-mag-500 dark:bg-neutral-800">
              <Building2 size={17} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cliente selecionado</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">{activeClient?.name || activeScopeLabel} · {activeStatusLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <Filter size={14} />
            Filtro do feed
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:max-w-4xl sm:grid-cols-3">
          <Select value={feedScope} onChange={e => setFeedScope(e.target.value)}>
            {FEED_SCOPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Todos os clientes</option>
            {selectedInactiveClient && feedScope === 'active' ? (
              <option value={activeClient.id}>{activeClient.name} (desativado)</option>
            ) : null}
            {scopedClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{!isClientActive(c) ? ' (desativado)' : ''}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-neutral-400">
          <ImageIcon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma postagem encontrada.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map(p => {
              const st = normalizeFeedStatus(computePostStatus(p))
              const firstFile = p.files?.[0]
              const firstFileRemoved = isStorageDeleted(firstFile)
              const url = firstFileRemoved ? null : resolveMediaUrl(firstFile?.url || firstFile?.storage_url)
              return (
                <button
                  type="button"
                  key={p.id}
                  title={p.title}
                  onClick={() => setSelectedPost(p)}
                  className={`group aspect-square relative bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center ${selectedPostId === p.id ? 'ring-2 ring-inset ring-mag-500' : ''}`}
                >
                  {firstFileRemoved
                    ? <div className="flex flex-col items-center gap-2 px-4 text-center text-neutral-400"><ImageIcon size={28} /><span className="text-xs font-semibold">Arquivo removido conforme retencao</span></div>
                    : url
                    ? <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    : <div className="flex flex-col items-center gap-2 text-neutral-400"><ImageIcon size={28} /><span className="text-xs font-semibold">Sem mídia</span></div>
                  }
                  <div className={`absolute top-2.5 right-2.5 h-4 w-4 rounded-full border-2 border-white shadow-md ring-1 ring-black/10 ${STATUS_DOT[st] || 'bg-neutral-400'}`} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-10 transition-colors group-hover:from-black/90">
                    <div className="line-clamp-2 text-left text-sm font-extrabold leading-tight text-white drop-shadow">{p.title || 'Sem título'}</div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-5 flex-wrap border-t border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            {[['bg-green-500', 'Aprovado'], ['bg-red-500', 'Recusado'], ['bg-amber-400', 'Aguardando'], ['bg-neutral-300', 'Rascunho']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-2">
                <span className={`h-3.5 w-3.5 rounded-full border border-white shadow-sm ring-1 ring-black/10 ${c}`} />{l}
              </span>
            ))}
          </div>
        </Card>
      )}
      <PostDetailsModal
        post={selectedPost}
        client={selectedClient}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
      />
    </div>
  )
}
