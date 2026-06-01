import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CalendarDays, CheckCircle2, Circle, Clock, Grid, ImageIcon, Building2, Filter, MessageSquare, RotateCcw, Tag } from 'lucide-react'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import Card from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { STATUS_LEGEND, StatusBadge, StatusDot, getStatusDotClass } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

function getPostDate(post) {
  const value = post.updatedAt || post.updated_at || post.createdAt || post.created_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value || 0)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildPostHistory(post) {
  const events = []
  const createdAt = post.createdAt || post.created_at
  const submittedAt = post.submittedAt || post.submitted_at
  const approvedAt = post.approvedAt || post.approved_at
  const updatedAt = post.updatedAt || post.updated_at
  const status = computePostStatus(post)

  if (createdAt) events.push({ label: 'Criado', description: 'Postagem cadastrada no sistema.', date: createdAt })
  if (submittedAt) events.push({ label: 'Enviado para aprovação', description: 'Conteúdo enviado para revisão do cliente.', date: submittedAt })
  if (status === 'approved') events.push({ label: 'Aprovado', description: 'Postagem aprovada.', date: approvedAt || updatedAt })
  if (status === 'rejected') events.push({ label: 'Recusado', description: 'Cliente solicitou ajustes.', date: updatedAt })

  ;(post.files || []).forEach(file => {
    if (file.rejection_reason || file.rejection_tags?.length) {
      events.push({
        label: 'Feedback enviado',
        description: `${file.name || 'Arquivo'}: ${file.rejection_reason || file.rejection_tags.join(', ')}`,
        date: file.updated_at || updatedAt,
      })
    }
  })

  return events
    .filter(event => event.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function buildPostTimeline(post) {
  const status = computePostStatus(post)
  const createdAt = post.createdAt || post.created_at
  const submittedAt = post.submittedAt || post.submitted_at
  const approvedAt = post.approvedAt || post.approved_at
  const updatedAt = post.updatedAt || post.updated_at
  const hasRejection = status === 'rejected' || (post.files || []).some(file =>
    file.status === 'rejected' || file.rejection_reason || file.rejection_tags?.length
  )
  const hasCorrection = status === 'pending_approval' && (post.files || []).some(file => file.status === 'pending')

  const steps = [
    {
      key: 'created',
      label: 'Criado',
      description: 'Postagem cadastrada no sistema.',
      date: createdAt,
      done: Boolean(createdAt),
      active: status === 'draft',
      icon: CheckCircle2,
    },
    {
      key: 'analysis',
      label: 'Em análise',
      description: 'Conteúdo enviado para revisão do cliente.',
      date: submittedAt,
      done: Boolean(submittedAt) || ['pending_approval', 'approved', 'rejected'].includes(status),
      active: status === 'pending_approval' && !hasCorrection,
      icon: Clock,
    },
    {
      key: 'rejected',
      label: 'Recusado',
      description: hasRejection ? 'Cliente solicitou ajustes.' : 'Sem recusa registrada.',
      date: hasRejection ? updatedAt : null,
      done: hasRejection,
      active: status === 'rejected',
      icon: AlertCircle,
    },
    {
      key: 'corrected',
      label: 'Corrigido',
      description: hasCorrection ? 'Arquivos corrigidos e reenviados.' : 'Aguardando correção quando houver recusa.',
      date: hasCorrection ? updatedAt : null,
      done: hasCorrection || status === 'approved',
      active: hasCorrection,
      icon: RotateCcw,
    },
    {
      key: 'approved',
      label: 'Aprovado',
      description: status === 'approved' ? 'Postagem aprovada.' : 'Aguardando aprovação final.',
      date: approvedAt || (status === 'approved' ? updatedAt : null),
      done: status === 'approved',
      active: status === 'approved',
      icon: CheckCircle2,
    },
  ]

  return steps.map((step, index) => ({
    ...step,
    state: step.done ? 'done' : step.active ? 'active' : 'future',
    isLast: index === steps.length - 1,
  }))
}

function getFileUrl(file) {
  return file?.storage_url || file?.url || ''
}

export default function FeedPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('recent')
  const [detailPost, setDetailPost] = useState(null)

  const filter = searchParams.get('client') || ''
  const selectedPostId = searchParams.get('post') || ''

  function setFilter(id) {
    if (id) setSearchParams({ client: id })
    else setSearchParams({})
  }

  useEffect(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = (filter ? posts.filter(p => p.client_id === filter || p.clientId === filter) : posts)
    .sort((a, b) => {
      if (selectedPostId && a.id === selectedPostId) return -1
      if (selectedPostId && b.id === selectedPostId) return 1
      if (sortBy === 'oldest') return (getPostDate(a)?.getTime() || 0) - (getPostDate(b)?.getTime() || 0)
      if (sortBy === 'status') return computePostStatus(a).localeCompare(computePostStatus(b))
      if (sortBy === 'client') {
        const ca = clients.find(c => c.id === (a.client_id || a.clientId))?.name || ''
        const cb = clients.find(c => c.id === (b.client_id || b.clientId))?.name || ''
        return ca.localeCompare(cb)
      }
      return (getPostDate(b)?.getTime() || 0) - (getPostDate(a)?.getTime() || 0)
    })
  const activeClient = clients.find(c => c.id === filter)
  const detailClient = detailPost ? clients.find(c => c.id === (detailPost.client_id || detailPost.clientId)) : null
  const detailHistory = detailPost ? buildPostHistory(detailPost) : []
  const detailTimeline = detailPost ? buildPostTimeline(detailPost) : []

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mag-50 text-mag-500 dark:bg-mag-500/10">
            <Grid size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Prévia do Feed</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Visualize os posts por cliente no formato de grade.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <ImageIcon size={14} />
          {filtered.length} post{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-mag-500 dark:bg-neutral-800">
              <Building2 size={17} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cliente selecionado</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">{activeClient?.name || 'Todos os clientes'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <Filter size={14} />
            Filtro do feed
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:max-w-xl">
          <label>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cliente</span>
            <Select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
          <label>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Ordenar</span>
            <Select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="status">Por status</option>
              <option value="client">Por cliente</option>
            </Select>
          </label>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={32} />}
          title="Nenhuma postagem encontrada"
          description={filter ? 'Não existem posts para o cliente selecionado.' : 'Crie uma nova postagem para visualizar a grade do feed.'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map(p => {
              const st = computePostStatus(p)
              const url = p.files?.[0]?.url || p.files?.[0]?.storage_url
              return (
                <div
                  key={p.id}
                  title={p.title}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailPost(p)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') setDetailPost(p)
                  }}
                  className={`group aspect-square relative bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-200 hover:z-10 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-900/15 focus:outline-none focus:ring-2 focus:ring-mag-500 ${selectedPostId === p.id ? 'ring-2 ring-inset ring-mag-500' : ''}`}
                >
                  {url
                    ? <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    : <div className="flex flex-col items-center gap-2 text-neutral-400"><ImageIcon size={28} /><span className="text-xs font-semibold">Sem mídia</span></div>
                  }
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white shadow ${getStatusDotClass(st)}`} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="line-clamp-1 text-xs font-semibold text-white">{p.title || 'Sem titulo'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 flex-wrap border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {STATUS_LEGEND.map(item => (
              <span key={item.status} className="flex items-center gap-1.5">
                <StatusDot status={item.status} />{item.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={!!detailPost}
        onClose={() => setDetailPost(null)}
        title={detailPost?.title || 'Detalhes do post'}
        subtitle="Resumo completo da postagem, feedbacks e historico."
        size="xl"
      >
        {detailPost && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Cliente</div>
                <div className="mt-1 text-sm font-semibold">{detailClient?.name || 'Não informado'}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Status</div>
                <div className="mt-1"><StatusBadge status={computePostStatus(detailPost)} /></div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Data</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><CalendarDays size={14} />{formatDate(getPostDate(detailPost))}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Canais</div>
                <div className="mt-1 text-sm font-semibold">{detailPost.channels?.length ? detailPost.channels.join(', ') : 'Não informado'}</div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold">Descricao</h3>
              <p className="rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                {detailPost.description || detailPost.caption || 'Sem descrição cadastrada.'}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold">Arquivos e feedbacks</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(detailPost.files || []).map(file => (
                  <div key={file.id || file.name} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{file.name || file.original_name || 'Arquivo'}</div>
                        <div className="text-xs text-neutral-400">{file.file_type || 'Tipo nao informado'}</div>
                      </div>
                      <StatusBadge status={file.status || 'draft'} />
                    </div>
                    {getFileUrl(file) && (
                      <a href={getFileUrl(file)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-mag-500 hover:text-mag-600">
                        Abrir arquivo
                      </a>
                    )}
                    {(file.rejection_reason || file.rejection_tags?.length) && (
                      <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        <div className="mb-1 flex items-center gap-1.5 font-bold"><MessageSquare size={13} />Feedback</div>
                        {file.rejection_reason && <p>{file.rejection_reason}</p>}
                        {file.rejection_tags?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {file.rejection_tags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-semibold dark:bg-red-900">
                                <Tag size={10} />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!(detailPost.files || []).length && (
                  <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400 dark:border-neutral-800">
                    Nenhum arquivo anexado.
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold">Timeline do post</h3>
              <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="space-y-0">
                  {detailTimeline.map(step => {
                    const Icon = step.icon || Circle
                    const isDone = step.state === 'done'
                    const isActive = step.state === 'active'
                    const circleClass = isDone
                      ? 'bg-green-500 text-white ring-green-100 dark:ring-green-950'
                      : isActive
                        ? 'bg-mag-500 text-white ring-mag-100 dark:ring-mag-950'
                        : 'bg-neutral-100 text-neutral-400 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-800'
                    const lineClass = isDone
                      ? 'bg-green-200 dark:bg-green-900'
                      : 'bg-neutral-200 dark:bg-neutral-800'

                    return (
                      <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                        {!step.isLast && (
                          <div className={`absolute left-4 top-8 h-[calc(100%-2rem)] w-0.5 ${lineClass}`} />
                        )}
                        <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ${circleClass}`}>
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-bold text-neutral-900 dark:text-white">{step.label}</div>
                            {isActive && (
                              <span className="rounded-full bg-mag-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mag-600 dark:bg-mag-950 dark:text-mag-300">
                                Atual
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{step.description}</div>
                          <div className="mt-1 text-[11px] font-medium text-neutral-400">
                            {step.date ? formatDate(step.date) : 'Ainda não ocorreu'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {detailHistory.length > 0 && (
                <details className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Ver eventos registrados
                  </summary>
                  <div className="mt-3 space-y-3">
                    {detailHistory.map((event, index) => (
                      <div key={`${event.label}-${index}`} className="flex gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500 dark:bg-neutral-800">
                          <Clock size={13} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{event.label}</div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">{event.description}</div>
                          <div className="mt-0.5 text-[11px] font-medium text-neutral-400">{formatDate(event.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
