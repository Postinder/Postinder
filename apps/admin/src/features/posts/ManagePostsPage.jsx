import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FilePlus,
  ImageIcon,
  Filter,
  FolderKanban,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Avatar, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { CHANNELS, FUNNEL_TAGS } from '../../utils/constants'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import {
  computePostStatus,
  duplicatePost,
  fetchPosts,
  softDeletePost,
  submitPost,
  submitPostsBatch,
  updatePost,
  updatePostStatus,
  uploadPostFiles,
  reorderPostFiles,
  removePostFile,
  markPostExecuted,
} from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import SortableAttachments, { moveAttachment } from '../../components/posts/SortableAttachments'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'ready', label: 'Pronto' },
  { value: 'sent', label: 'Enviado' },
  { value: 'pending_approval', label: 'Aguardando' },
  { value: 'rejected', label: 'Recusado' },
  { value: 'archived', label: 'Arquivado interno' },
]

const SENDABLE_STATUSES = ['draft', 'ready', 'rejected']

const EXECUTION_RETENTION_OPTIONS = [
  { value: 'never', label: 'Manter arquivos', description: 'Os anexos continuam disponiveis para consulta.' },
  { value: 'immediate', label: 'Excluir agora', description: 'Remove os arquivos assim que marcar como executado.' },
  { value: '1d', label: 'Excluir em 1 dia', description: 'Mantem os anexos por 24 horas apos a execucao.' },
  { value: '7d', label: 'Excluir em 1 semana', description: 'Mantem os anexos por 7 dias apos a execucao.' },
]

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function getScheduledDate(post) {
  return post.scheduledDate || post.scheduled_date
}

function getUpdatedDate(post) {
  return post.updatedAt || post.updated_at || post.createdAt || post.created_at
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function getPostChannels(post) {
  return post.channels || []
}

function getAttachmentName(file) {
  return file?.name || file?.original_name || file?.originalName || file?.file?.name || 'Arquivo'
}

function getAttachmentType(file) {
  return file?.file_type || file?.fileType || file?.type || file?.file?.type || ''
}

function isImageAttachment(file) {
  const type = String(getAttachmentType(file)).toLowerCase()
  const name = getAttachmentName(file)
  return type.startsWith('image/') || type === 'image' || /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)
}

function getAttachmentPreviewUrl(file) {
  if (file?.file instanceof File) return URL.createObjectURL(file.file)
  return resolveMediaUrl(file?.storage_url || file?.url)
}

function CompactFeedPreview({ channels, files }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeChannels = Object.keys(channels)
  const totalFiles = files.length
  const safeIndex = totalFiles ? Math.min(activeIndex, totalFiles - 1) : 0
  const activeFile = files[safeIndex]
  const previewUrl = getAttachmentPreviewUrl(activeFile)
  const image = activeFile && isImageAttachment(activeFile)

  useEffect(() => {
    if (activeIndex > Math.max(totalFiles - 1, 0)) setActiveIndex(Math.max(totalFiles - 1, 0))
  }, [activeIndex, totalFiles])

  function goToPrevious() {
    if (!totalFiles) return
    setActiveIndex(current => (current - 1 + totalFiles) % totalFiles)
  }

  function goToNext() {
    if (!totalFiles) return
    setActiveIndex(current => (current + 1) % totalFiles)
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-base font-extrabold text-neutral-900 dark:text-white">
          <ImageIcon size={18} className="text-mag-500" />
          Previa rapida
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
          {totalFiles || 0} arquivo(s)
        </span>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="relative flex aspect-[4/3] max-h-[420px] min-h-[260px] items-center justify-center">
            {image && previewUrl ? (
              <img src={previewUrl} alt={getAttachmentName(activeFile)} className="h-full w-full object-contain" />
            ) : activeFile ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
                <FilePlus size={34} />
                <span className="max-w-[80%] truncate text-sm font-bold">{getAttachmentName(activeFile)}</span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
                <ImageIcon size={34} />
                <span className="text-sm font-bold">Sem arquivo</span>
              </div>
            )}
            {totalFiles > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition hover:bg-black/85"
                  aria-label="Arquivo anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition hover:bg-black/85"
                  aria-label="Proximo arquivo"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-black text-white">
                  {safeIndex + 1}/{totalFiles}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-bold text-neutral-700 dark:text-neutral-200">
            {activeFile ? getAttachmentName(activeFile) : 'Nenhum arquivo selecionado'}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {activeChannels.length ? activeChannels.map(channel => (
              <span key={channel} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                {CHANNELS[channel]?.icon} {channel}
              </span>
            )) : (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-400 dark:bg-neutral-800">
                Sem canais
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditPostModal({ post, clients, open, onClose, onSaved }) {
  const [form, setForm] = useState({ clientId: '', title: '', caption: '', scheduledDate: '', funnelTag: '' })
  const [channels, setChannels] = useState({})
  const [existingFiles, setExistingFiles] = useState([])
  const [removedExistingFiles, setRemovedExistingFiles] = useState([])
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!post) return
    const nextChannels = {}
    ;(post.channels || []).forEach(channel => { nextChannels[channel] = true })
    setChannels(nextChannels)
    setExistingFiles([...(post.files || [])].sort((a, b) =>
      (a.sort_order ?? a.sortOrder ?? 999999) - (b.sort_order ?? b.sortOrder ?? 999999)
    ))
    setRemovedExistingFiles([])
    setFiles([])
    setForm({
      clientId: getPostClientId(post) || '',
      title: post.title || '',
      caption: post.description || '',
      scheduledDate: toDateInput(getScheduledDate(post)),
      funnelTag: post.funnelTag || post.funnel_tag || '',
    })
  }, [post])

  if (!post) return null

  const status = computePostStatus(post)
  const isApproved = status === 'approved'
  const isSent = ['sent', 'pending_approval'].includes(status)
  const previewFiles = [...existingFiles, ...files]

  async function handleSave() {
    if (isApproved && !confirm('Este post ja foi aprovado. Deseja alterar mesmo assim?')) return
    if (isSent && !confirm('Este post ja foi enviado ao cliente. Alterar pode afetar uma aprovacao em andamento. Continuar?')) return

    setSaving(true)
    try {
      await updatePost(post.id, {
        clientId: form.clientId,
        title: form.title,
        description: form.caption,
        scheduledDate: form.scheduledDate || null,
        funnelTag: form.funnelTag || null,
        channels: Object.keys(channels),
      })
      if (removedExistingFiles.length) {
        await Promise.all(removedExistingFiles.map(file => removePostFile(post.id, file.id)))
      }
      if (existingFiles.length) {
        await reorderPostFiles(post.id, existingFiles.map((file, index) => ({ id: file.id, sort_order: index + 1 })))
      }
      if (files.length) {
        await uploadPostFiles(post.id, files.map((item, index) => ({
          ...item,
          sortOrder: existingFiles.length + index + 1,
        })))
      }
      toast.success('Postagem atualizada.')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(channel) {
    setChannels(current => {
      const next = { ...current }
      if (next[channel]) delete next[channel]
      else next[channel] = true
      return next
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar postagem" subtitle="Ajuste o conteudo antes de enviar ou reenviar ao cliente.">
      <div className="space-y-4">
        {isApproved || isSent ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {isApproved ? 'Post aprovado: edite apenas se realmente precisar.' : 'Post enviado: alteracoes podem afetar a revisao em andamento.'}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Cliente" value={form.clientId} onChange={event => setForm(current => ({ ...current, clientId: event.target.value }))}>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
            <Input label="Data planejada" type="date" value={form.scheduledDate} onChange={event => setForm(current => ({ ...current, scheduledDate: event.target.value }))} />
          </div>

          <Input label="Titulo" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />
          <CompactFeedPreview channels={channels} files={previewFiles} />
          <Textarea label="Legenda / texto" value={form.caption} onChange={event => setForm(current => ({ ...current, caption: event.target.value }))} />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Tag de funil</label>
          <div className="flex flex-wrap gap-2">
            {FUNNEL_TAGS.map(tag => (
              <button
                key={tag.value}
                type="button"
                onClick={() => setForm(current => ({ ...current, funnelTag: current.funnelTag === tag.value ? '' : tag.value }))}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${form.funnelTag === tag.value ? `${tag.color} border-current` : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Canais</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CHANNELS).map(([channel, data]) => (
              <button
                key={channel}
                type="button"
                onClick={() => toggleChannel(channel)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold ${channels[channel] ? 'border-mag-500 bg-mag-50 text-mag-600 dark:bg-mag-950 dark:text-mag-300' : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'}`}
              >
                {data.icon} {channel}
              </button>
            ))}
          </div>
        </div>

        {existingFiles.length ? (
          <SortableAttachments
            items={existingFiles}
            title="Arquivos atuais"
            description="Reorganize ou remova arquivos. Remoções serão aplicadas ao salvar."
            onMove={(from, to) => setExistingFiles(current => moveAttachment(current, from, to))}
            onRemove={(index, file) => {
              if (!confirm(`Remover "${file.name || file.original_name || 'arquivo'}" desta postagem ao salvar?`)) return
              setExistingFiles(current => current.filter((_, fileIndex) => fileIndex !== index))
              setRemovedExistingFiles(current => current.some(item => item.id === file.id) ? current : [...current, file])
            }}
          />
        ) : null}

        {removedExistingFiles.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {removedExistingFiles.length} arquivo(s) atual(is) marcado(s) para remoção ao salvar.
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-neutral-600 dark:text-neutral-200">
            <FilePlus size={16} className="text-mag-500" />
            {files.length ? `${files.length} novo(s) arquivo(s)` : 'Adicionar arquivos anexados'}
          </span>
          <span className="text-xs font-bold text-mag-500">Escolher</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={event => setFiles(Array.from(event.target.files || []).map(file => ({
              localId: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random()}`,
              file,
              name: file.name,
              type: file.type,
              size: file.size,
            })))}
          />
        </label>

        {files.length ? (
          <SortableAttachments
            items={files}
            title="Novos arquivos"
            description="Novos anexos serao adicionados apos os arquivos atuais, nesta ordem."
            onMove={(from, to) => setFiles(current => moveAttachment(current, from, to))}
            onRemove={index => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
          />
        ) : null}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 justify-center" onClick={handleSave} loading={saving}>Salvar alteracoes</Button>
        </div>
      </div>
    </Modal>
  )
}

function BatchSendModal({ posts, clientsById, open, onClose, onConfirm, loading }) {
  const grouped = posts.reduce((acc, post) => {
    const clientId = getPostClientId(post)
    acc[clientId] = acc[clientId] || []
    acc[clientId].push(post)
    return acc
  }, {})

  return (
    <Modal open={open} onClose={onClose} title="Enviar selecionados para aprovacao" subtitle="Confira o lote antes de liberar para o cliente.">
      <div className="space-y-4">
        {Object.entries(grouped).map(([clientId, items]) => {
          const client = clientsById.get(clientId) || {}
          return (
            <div key={clientId} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-bold">{client.name || 'Cliente'}</div>
                <span className="rounded-full bg-mag-50 px-3 py-1 text-xs font-bold text-mag-600 dark:bg-mag-500/10 dark:text-mag-300">{items.length} post(s)</span>
              </div>
              <div className="space-y-2">
                {items.map(post => (
                  <div key={post.id} className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                    <div className="font-semibold">{post.title || 'Post sem titulo'}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {formatDate(getScheduledDate(post))} - {(post.channels || []).join(', ') || 'Sem canais'} - {(post.files || []).length} arquivo(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 justify-center" onClick={onConfirm} loading={loading} icon={<Send size={16} />}>Enviar selecionados</Button>
        </div>
      </div>
    </Modal>
  )
}

function ExecutePostModal({ post, client, open, onClose, onConfirm, loading }) {
  const [retention, setRetention] = useState('never')

  useEffect(() => {
    if (open) setRetention('never')
  }, [open])

  if (!post) return null

  return (
    <Modal open={open} onClose={onClose} title="Marcar como executado" subtitle="Confirme que a postagem ja foi executada pela equipe.">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="font-extrabold text-neutral-950 dark:text-white">{post.title || 'Post sem titulo'}</div>
          <div className="mt-1 text-xs text-neutral-500">{client?.name || 'Cliente'} - {(post.files || []).length} arquivo(s)</div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Limpeza dos arquivos</div>
          <div className="space-y-2">
            {EXECUTION_RETENTION_OPTIONS.map(option => (
              <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${retention === option.value ? 'border-mag-500 bg-mag-50 dark:bg-mag-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}>
                <input
                  type="radio"
                  name="execution-retention"
                  value={option.value}
                  checked={retention === option.value}
                  onChange={event => setRetention(event.target.value)}
                  className="mt-1 accent-mag-600"
                />
                <span>
                  <span className="block text-sm font-bold text-neutral-900 dark:text-white">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Depois de executado, o projeto sai da lista de concluidos e entra em executados. O cliente nao podera alterar a aprovacao.
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 justify-center" onClick={() => onConfirm(retention)} loading={loading} icon={<CheckCircle size={16} />}>Confirmar execucao</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function ManagePostsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [view, setView] = useState(['completed', 'executed'].includes(searchParams.get('view')) ? searchParams.get('view') : 'active')
  const [selected, setSelected] = useState([])
  const [editPost, setEditPost] = useState(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [executePost, setExecutePost] = useState(null)
  const [executeLoading, setExecuteLoading] = useState(false)

  const clientsById = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients])

  function load() {
    setLoading(true)
    Promise.all([fetchPosts({ limit: 500, includeArchived: true }), fetchClients()])
      .then(([loadedPosts, loadedClients]) => {
        setPosts(loadedPosts)
        setClients(loadedClients)
      })
      .catch(error => toast.error(error.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (view !== 'active' && statusFilter !== 'all') setStatusFilter('all')
    setSelected([])
  }, [view, statusFilter])

  const filtered = useMemo(() => {
    return posts
      .filter(post => {
        const status = computePostStatus(post)
        const client = clientsById.get(getPostClientId(post))
        if (!client) return false
        if (view === 'completed') {
          if (status !== 'approved') return false
        } else if (view === 'executed') {
          if (status !== 'executed') return false
        } else {
          if (['approved', 'executed'].includes(status)) return false
          if (status !== 'archived' && statusFilter === 'archived') return false
          if (status === 'archived' && statusFilter !== 'archived') return false
        }
        const haystack = `${post.title || ''} ${post.description || ''} ${client.name || ''}`.toLowerCase()
        if (search && !haystack.includes(search.toLowerCase())) return false
        if (clientFilter && getPostClientId(post) !== clientFilter) return false
        if (view === 'active' && statusFilter !== 'all' && status !== statusFilter) return false
        if (channelFilter !== 'all' && !getPostChannels(post).includes(channelFilter)) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'scheduled') return new Date(getScheduledDate(a) || 0) - new Date(getScheduledDate(b) || 0)
        if (sortBy === 'created') return new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
        return new Date(getUpdatedDate(b) || 0) - new Date(getUpdatedDate(a) || 0)
      })
  }, [posts, clientsById, search, clientFilter, statusFilter, channelFilter, sortBy, view])

  const activeCount = posts.filter(post => {
    if (!clientsById.has(getPostClientId(post))) return false
    const status = computePostStatus(post)
    return !['approved', 'executed', 'archived'].includes(status)
  }).length
  const completedCount = posts.filter(post => clientsById.has(getPostClientId(post)) && computePostStatus(post) === 'approved').length
  const executedCount = posts.filter(post => clientsById.has(getPostClientId(post)) && computePostStatus(post) === 'executed').length

  const selectedPosts = filtered.filter(post => selected.includes(post.id))
  const sendableSelected = selectedPosts.filter(post => SENDABLE_STATUSES.includes(computePostStatus(post)))

  function toggleSelected(postId) {
    setSelected(current => current.includes(postId) ? current.filter(id => id !== postId) : [...current, postId])
  }

  async function runAction(action, successMessage) {
    try {
      await action()
      toast.success(successMessage)
      load()
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    }
  }

  async function handleSend(post) {
    await runAction(async () => {
      await submitPost(post.id)
      await notifyClient(getPostClientId(post)).catch(() => {})
    }, 'Post enviado para aprovacao.')
  }

  async function handleBatchSend() {
    setBatchLoading(true)
    try {
      await submitPostsBatch(sendableSelected.map(post => post.id))
      const clientIds = [...new Set(sendableSelected.map(getPostClientId))]
      await Promise.all(clientIds.map(clientId => notifyClient(clientId).catch(() => {})))
      toast.success('Selecionados enviados para aprovacao.')
      setSelected([])
      setBatchOpen(false)
      load()
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleMarkExecuted(retention) {
    if (!executePost) return
    setExecuteLoading(true)
    try {
      await markPostExecuted(executePost.id, retention)
      toast.success('Postagem marcada como executada.')
      setExecutePost(null)
      load()
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setExecuteLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FolderKanban}
        title="Gerenciar Postagens"
        subtitle="Revise rascunhos, marque conteudos como prontos e envie lotes para aprovacao do cliente."
        actions={<Button icon={<Plus size={16} />} onClick={() => navigate('/admin/posts/new')}>Nova Postagem</Button>}
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: 'active', label: 'Projetos em andamento', count: activeCount },
            { key: 'completed', label: 'Concluidos', count: completedCount },
            { key: 'executed', label: 'Executados', count: executedCount },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                view === item.key
                  ? 'bg-mag-600 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {item.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${view === item.key ? 'bg-white/20 text-white' : 'bg-white text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300'}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className={`grid gap-3 ${view === 'active' ? 'lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]' : 'lg:grid-cols-[1.4fr_1fr_1fr_1fr]'}`}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por titulo, legenda ou cliente" className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-mag-500 dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
          <Select value={clientFilter} onChange={event => setClientFilter(event.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </Select>
          {view === 'active' && (
            <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          )}
          <Select value={channelFilter} onChange={event => setChannelFilter(event.target.value)}>
            <option value="all">Todos os canais</option>
            {Object.keys(CHANNELS).map(channel => <option key={channel} value={channel}>{channel}</option>)}
          </Select>
          <Select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="updated">Ultima atualizacao</option>
            <option value="created">Criacao</option>
            <option value="scheduled">Data planejada</option>
          </Select>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Filter size={16} />
            {filtered.length} postagem(ns) {view === 'executed' ? 'executada(s)' : view === 'completed' ? 'concluida(s)' : 'em andamento'} encontrada(s)
            {view === 'active' && selected.length ? <span className="font-bold text-mag-600">- {selected.length} selecionada(s)</span> : null}
          </div>
          {view === 'active' ? (
            <Button disabled={!sendableSelected.length} onClick={() => setBatchOpen(true)} icon={<Send size={16} />}>
              Enviar lote para aprovacao
            </Button>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(item => <Skeleton key={item} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => {
            const client = clientsById.get(getPostClientId(post)) || {}
            const status = computePostStatus(post)
            const canSend = SENDABLE_STATUSES.includes(status)
            const canExecute = status === 'approved'
            const canArchive = !['archived'].includes(status)
            return (
              <Card key={post.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[32px_1.1fr_1.6fr_1fr_auto] lg:items-center">
                  {view === 'active' ? (
                    <input type="checkbox" checked={selected.includes(post.id)} onChange={() => toggleSelected(post.id)} disabled={!canSend} className="h-4 w-4 accent-mag-600" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <div className="flex items-center gap-3">
                    <Avatar name={client.name} color={client.color} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-neutral-900 dark:text-white">{client.name || 'Cliente'}</div>
                      <div className="text-xs text-neutral-400">{formatDate(getScheduledDate(post))}</div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-extrabold text-neutral-950 dark:text-white">{post.title || 'Post sem titulo'}</div>
                    <div className="mt-1 line-clamp-1 text-sm text-neutral-500">{post.description || 'Sem legenda cadastrada.'}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {getPostChannels(post).map(channel => <span key={channel} className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-500 dark:bg-neutral-800">{channel}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-center">
                    <StatusBadge status={status} />
                    <span className="text-xs font-semibold text-neutral-400">{(post.files || []).length} arquivo(s)</span>
                    <span className="text-xs text-neutral-400">Atualizado {formatDate(getUpdatedDate(post))}</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button title="Previa" onClick={() => navigate(`/admin/feed?client=${getPostClientId(post)}&post=${post.id}`)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-mag-600 dark:hover:bg-neutral-800"><Eye size={16} /></button>
                    {status !== 'executed' && <button title="Editar" onClick={() => setEditPost(post)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-teal-600 dark:hover:bg-neutral-800"><Edit3 size={16} /></button>}
                    <button title="Duplicar" onClick={() => runAction(() => duplicatePost(post.id), 'Postagem duplicada.')} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-blue-600 dark:hover:bg-neutral-800"><Copy size={16} /></button>
                    {status === 'draft' && <button title="Marcar pronto" onClick={() => runAction(() => updatePostStatus(post.id, 'ready'), 'Postagem marcada como pronta.')} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-green-600 dark:hover:bg-neutral-800"><CheckCircle size={16} /></button>}
                    {status === 'ready' && <button title="Voltar para rascunho" onClick={() => runAction(() => updatePostStatus(post.id, 'draft'), 'Postagem voltou para rascunho.')} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-amber-600 dark:hover:bg-neutral-800"><RotateCcw size={16} /></button>}
                    {canSend && <button title="Enviar para aprovacao" onClick={() => handleSend(post)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-mag-600 dark:hover:bg-neutral-800"><Send size={16} /></button>}
                    {canExecute && <button title="Marcar como executado" onClick={() => setExecutePost(post)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-teal-600 dark:hover:bg-neutral-800"><CheckCircle size={16} /></button>}
                    {canArchive && status !== 'executed' && <button title="Arquivar" onClick={() => {
                      const needsConfirm = ['sent', 'pending_approval', 'approved'].includes(status)
                      if (!needsConfirm || confirm('Esta postagem ja foi enviada/aprovada. Arquivar mesmo assim?')) {
                        runAction(() => softDeletePost(post.id), 'Postagem arquivada.')
                      }
                    }} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">{status === 'draft' ? <Trash2 size={16} /> : <Archive size={16} />}</button>}
                  </div>
                </div>
              </Card>
            )
          })}
          {!filtered.length && (
            <Card className="p-10 text-center">
              <div className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Nenhuma postagem encontrada</div>
              <p className="mt-1 text-sm text-neutral-500">{view === 'executed' ? 'Nenhum projeto executado com estes filtros.' : view === 'completed' ? 'Nenhum projeto concluido com estes filtros.' : 'Crie rascunhos ou ajuste os filtros para continuar.'}</p>
              <Button className="mt-4" icon={<Plus size={16} />} onClick={() => navigate('/admin/posts/new')}>Nova Postagem</Button>
            </Card>
          )}
        </div>
      )}

      <EditPostModal post={editPost} clients={clients} open={!!editPost} onClose={() => setEditPost(null)} onSaved={load} />
      <BatchSendModal
        posts={sendableSelected}
        clientsById={clientsById}
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onConfirm={handleBatchSend}
        loading={batchLoading}
      />
      <ExecutePostModal
        post={executePost}
        client={executePost ? clientsById.get(getPostClientId(executePost)) : null}
        open={!!executePost}
        onClose={() => setExecutePost(null)}
        onConfirm={handleMarkExecuted}
        loading={executeLoading}
      />
    </div>
  )
}
