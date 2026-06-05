import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Grid, ImageIcon, Building2, Filter, CalendarDays, CheckCircle, Circle, Clock, MessageSquare } from 'lucide-react'
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
  pending_approval: 'bg-amber-400',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
}

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function formatDate(value) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function buildPostTimeline(post) {
  const status = computePostStatus(post)
  const hasRejected = (post.files || []).some(file => file.status === 'rejected' || file.rejection_reason)
  const hasApproved = status === 'approved'
  const submittedAt = post.submittedAt || post.submitted_at || post.updatedAt || post.updated_at

  const steps = [
    { key: 'created', label: 'Criado', date: post.createdAt || post.created_at, done: true },
    { key: 'analysis', label: 'Em análise', date: submittedAt, done: ['pending_approval', 'approved', 'rejected'].includes(status) },
    { key: 'rejected', label: 'Recusado', date: post.updatedAt || post.updated_at, done: hasRejected },
    { key: 'corrected', label: 'Corrigido', date: post.updatedAt || post.updated_at, done: hasRejected && status === 'pending_approval' },
    { key: 'approved', label: 'Aprovado', date: post.approvedAt || post.approved_at || post.updatedAt || post.updated_at, done: hasApproved },
  ]

  const firstPendingIndex = steps.findIndex(step => !step.done)
  return steps.map((step, index) => ({
    ...step,
    current: firstPendingIndex === index || (firstPendingIndex === -1 && index === steps.length - 1),
  }))
}

function PostDetailsModal({ post, client, open, onClose }) {
  if (!post) return null

  const timeline = buildPostTimeline(post)
  const files = post.files || []
  const status = computePostStatus(post)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post.title || 'Detalhes do post'}
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
      return 0
    })
  const activeClient = clients.find(c => c.id === filter)
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
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">{activeClient?.name || 'Todos os clientes'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            <Filter size={14} />
            Filtro do feed
          </div>
        </div>
        <div className="p-4 sm:max-w-xs">
          <Select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              const st = computePostStatus(p)
              const url = resolveMediaUrl(p.files?.[0]?.url || p.files?.[0]?.storage_url)
              return (
                <button
                  type="button"
                  key={p.id}
                  title={p.title}
                  onClick={() => setSelectedPost(p)}
                  className={`group aspect-square relative bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center ${selectedPostId === p.id ? 'ring-2 ring-inset ring-mag-500' : ''}`}
                >
                  {url
                    ? <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    : <div className="flex flex-col items-center gap-2 text-neutral-400"><ImageIcon size={28} /><span className="text-xs font-semibold">Sem mídia</span></div>
                  }
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white shadow ${STATUS_DOT[st] || 'bg-neutral-400'}`} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="line-clamp-1 text-xs font-semibold text-white">{p.title || 'Sem título'}</div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-4 flex-wrap border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {[['bg-green-500', 'Aprovado'], ['bg-red-500', 'Recusado'], ['bg-amber-400', 'Aguardando'], ['bg-neutral-300', 'Rascunho']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${c}`} />{l}
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
