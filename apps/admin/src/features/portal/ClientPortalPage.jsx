import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  MessageSquare,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  approvePortalFile,
  approvePortalPost,
  fetchPortal,
  rejectPortalFile,
  rejectPortalPost,
  resetPortalFile,
  sendPortalFeedback,
  updatePortalFileFeedback,
} from '../../services/portal.service'
import {
  approveAuthenticatedPortalFile,
  approveAuthenticatedPortalPost,
  fetchAuthenticatedPortal,
  rejectAuthenticatedPortalFile,
  rejectAuthenticatedPortalPost,
  resetAuthenticatedPortalFile,
  sendAuthenticatedPortalFeedback,
  updateAuthenticatedPortalFileFeedback,
} from '../../services/clientPortal.service'
import { useAuthStore } from '../../store/authStore'
import { REJECTION_TAGS } from '../../utils/constants'
import { resolveMediaUrl } from '../../utils/mediaUrl'

const tabs = [
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'rejected', label: 'Recusados', icon: XCircle },
  { id: 'history', label: 'Historico', icon: History },
  { id: 'files', label: 'Arquivos', icon: FolderOpen },
  { id: 'feedbacks', label: 'Feedbacks', icon: MessageSquare },
]

function formatDate(value, fallback = 'Sem data') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatMonthKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7)
  return date.toISOString().slice(0, 7)
}

function getPostDate(post) {
  return post.scheduledDate || post.scheduled_date || post.submittedAt || post.createdAt || post.created_at
}

function getStatus(post) {
  const status = String(post.status || '').toLowerCase()
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'sent') return 'sent'
  if (status === 'published' || status === 'done' || status === 'completed') return 'done'
  const files = post.files || []
  if (files.length && files.every(file => file.status === 'approved')) return 'approved'
  if (files.some(file => file.status === 'rejected')) return 'rejected'
  return status || 'sent'
}

function isPendingFile(file) {
  const status = String(file?.status || 'pending').toLowerCase()
  return ['pending', 'pending_approval', 'sent'].includes(status)
}

function isCorrectionPost(post) {
  return String(post?.status || '').toLowerCase() === 'pending_approval'
}

function statusMeta(status) {
  const map = {
    approved: { label: 'Aprovado', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' },
    rejected: { label: 'Ajustes', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' },
    done: { label: 'Concluido', className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' },
    sent: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
    pending_approval: { label: 'Correção', className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' },
    pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
    draft: { label: 'Rascunho', className: 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700' },
  }
  return map[status] || map.pending_approval
}

function StatusPill({ status }) {
  const meta = statusMeta(status)
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function MetricCard({ icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-mag-50 text-mag-600 dark:bg-mag-500/10 dark:text-mag-300">
        {icon}
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-950 dark:text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{sub}</div>}
    </div>
  )
}

function FilePreview({ file }) {
  const url = resolveMediaUrl(file.storage_url || file.url)
  const name = file.name || 'Arquivo'
  const type = String(file.file_type || '').toUpperCase()
  const isImage = type === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg)$/i.test(name)

  if (isImage && url) {
    return <img src={url} alt={name} className="h-40 w-full rounded-lg bg-neutral-100 object-contain dark:bg-neutral-800" />
  }

  return (
    <div className="flex h-40 w-full flex-col items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
      <FileText size={34} />
      <span className="mt-2 max-w-full truncate px-3 text-xs">{type || 'ARQUIVO'}</span>
    </div>
  )
}

function PostCard({ post, onApprove, onReject, busy }) {
  const [comment, setComment] = useState('')
  const [showReject, setShowReject] = useState(false)
  const status = getStatus(post)

  function submitReject() {
    if (!comment.trim()) {
      toast.error('Escreva um comentario para solicitar ajustes.')
      return
    }
    onReject(post.id, comment.trim()).then(() => {
      setComment('')
      setShowReject(false)
    })
  }

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold text-neutral-950 dark:text-white">{post.title || 'Post sem titulo'}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatDate(getPostDate(post))}</span>
            {(post.channels || []).map(channel => (
              <span key={channel} className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-800">{channel}</span>
            ))}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {post.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-300">{post.description}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(post.files || []).map((file, index) => (
          <a
            key={file.id}
            href={resolveMediaUrl(file.storage_url || file.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-neutral-200 p-2 transition hover:border-mag-300 dark:border-neutral-800"
          >
            <div className="relative">
              <FilePreview file={file} />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white">
                {index + 1}/{(post.files || []).length}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-semibold text-neutral-700 dark:text-neutral-200">{file.name || 'Arquivo'}</span>
              <Download size={14} className="shrink-0 text-neutral-400 group-hover:text-mag-500" />
            </div>
          </a>
        ))}
      </div>

      {status === 'sent' || status === 'pending_approval' || status === 'pending' ? (
        <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          {showReject ? (
            <div className="space-y-3">
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Descreva o que precisa ser ajustado..."
                className="h-24 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-mag-400 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button className="rounded-lg px-4 py-2 text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setShowReject(false)} type="button">
                  Cancelar
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60" onClick={submitReject} disabled={busy} type="button">
                  <Send size={15} /> Enviar ajustes
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" onClick={() => setShowReject(true)} disabled={busy} type="button">
                <XCircle size={16} /> Solicitar ajustes
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60" onClick={() => onApprove(post.id)} disabled={busy} type="button">
                <CheckCircle size={16} /> Aprovar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

function SwipeReviewCard({ post, file, fileIndex, totalFiles, onApprove, onReject, busy }) {
  const [dragX, setDragX] = useState(0)
  const [startX, setStartX] = useState(null)
  const mediaUrl = resolveMediaUrl(file?.storage_url || file?.url)
  const fileType = String(file?.file_type || '').toUpperCase()
  const fileName = file?.name || 'Arquivo'
  const isImage = fileType === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg)$/i.test(fileName)
  const correction = isCorrectionPost(post)

  function handlePointerDown(event) {
    if (busy) return
    setStartX(event.clientX)
  }

  function handlePointerMove(event) {
    if (startX === null || busy) return
    setDragX(Math.max(-120, Math.min(120, event.clientX - startX)))
  }

  function handlePointerUp() {
    if (startX === null || busy) return
    const finalX = dragX
    setStartX(null)
    setDragX(0)
    if (finalX > 80) onApprove()
    if (finalX < -80) onReject()
  }

  return (
    <div className="mx-auto max-w-xl">
      <div
        className="relative select-none overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-6">
          <span className={`rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white transition-opacity ${dragX < -35 ? 'opacity-100' : 'opacity-0'}`}>
            AJUSTAR
          </span>
          <span className={`rounded-full bg-green-600 px-4 py-2 text-sm font-black text-white transition-opacity ${dragX > 35 ? 'opacity-100' : 'opacity-0'}`}>
            APROVAR
          </span>
        </div>

        <div className="relative bg-neutral-100 dark:bg-neutral-950">
          {isImage && mediaUrl ? (
            <img src={mediaUrl} alt={fileName} className="h-[min(420px,55vh)] w-full object-contain" />
          ) : mediaUrl ? (
            <div className="flex h-[min(420px,55vh)] flex-col items-center justify-center gap-4 text-neutral-500">
              <FileText size={52} />
              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-mag-600 px-4 py-2 text-sm font-bold text-white">
                Abrir arquivo
              </a>
            </div>
          ) : (
            <div className="flex h-[min(420px,55vh)] items-center justify-center text-neutral-400">Arquivo indisponivel</div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-black text-white">
            {fileIndex + 1}/{totalFiles}
          </span>
        </div>

        <div className="p-4">
          {correction ? (
            <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
              Correção enviada pela 20Cinco: esta é uma nova versão após ajustes solicitados.
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-neutral-950 dark:text-white">{post.title || 'Projeto sem titulo'}</h3>
              <p className="mt-1 truncate text-sm font-semibold text-neutral-500">{fileName}</p>
            </div>
            <StatusPill status={file.status || 'pending'} />
          </div>
          {post.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{post.description}</p> : null}
        </div>
      </div>

      <div className="sticky bottom-3 z-20 mt-5 flex items-center justify-center gap-5 rounded-full bg-neutral-100/90 py-2 backdrop-blur dark:bg-neutral-950/90 sm:static sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400 bg-white text-red-500 shadow-lg transition hover:scale-105 disabled:opacity-50 dark:bg-neutral-900"
          title="Solicitar ajustes"
        >
          <XCircle size={30} />
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-white text-green-600 shadow-lg transition hover:scale-105 disabled:opacity-50 dark:bg-neutral-900"
          title="Aprovar"
        >
          <CheckCircle size={30} />
        </button>
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-neutral-400">Arraste para direita para aprovar ou para esquerda para solicitar ajuste.</p>
    </div>
  )
}

function ProjectReviewPanel({ projects, selectedProjectId, onSelectProject, onApproveFile, onRejectFile, onUndo, canUndoLastAction, busy }) {
  const selectedProject = projects.find(post => post.id === selectedProjectId) || projects[0]
  const pendingFiles = selectedProject ? (selectedProject.files || []).filter(isPendingFile) : []
  const currentFile = pendingFiles[0]
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

  useEffect(() => {
    if (!selectedProject && projects[0]) onSelectProject(projects[0].id)
  }, [selectedProject, projects, onSelectProject])

  function submitReject() {
    if (!comment.trim()) {
      toast.error('Escreva o ajuste solicitado para este item.')
      return
    }
    onRejectFile(selectedProject.id, currentFile.id, comment.trim(), selectedTags).then(() => {
      setComment('')
      setSelectedTags([])
      setRejectOpen(false)
    })
  }

  if (!projects.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <EmptyPanel title="Nenhum projeto pendente" description="Quando houver projetos enviados para revisao, eles aparecerao aqui." />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndoLastAction || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 transition hover:border-mag-300 hover:text-mag-600 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <RotateCcw size={16} /> Voltar último item
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <aside className="mx-auto max-w-5xl">
        <div className="mb-3 text-center text-xs font-black uppercase tracking-wider text-neutral-400">Projetos para aprovar</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map(project => {
          const pendingCount = (project.files || []).filter(isPendingFile).length
          const rejectedCount = (project.files || []).filter(file => file.status === 'rejected').length
          const active = selectedProject?.id === project.id
          const correction = isCorrectionPost(project)
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-mag-500 bg-mag-50 dark:bg-mag-500/10' : 'border-neutral-200 bg-white hover:border-mag-300 dark:border-neutral-800 dark:bg-neutral-900'}`}
            >
              <div className="line-clamp-1 font-extrabold text-neutral-950 dark:text-white">{project.title || 'Projeto sem titulo'}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {correction ? <span className="rounded-full bg-teal-100 px-2 py-1 font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">Correção</span> : null}
                <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">{pendingCount} pendente(s)</span>
                {rejectedCount ? <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{rejectedCount} ajuste(s)</span> : null}
              </div>
              <div className="mt-2 text-xs text-neutral-500">{formatDate(getPostDate(project))}</div>
            </button>
          )
        })}
        </div>
      </aside>

      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-neutral-400">Projeto selecionado</div>
            <h2 className="mt-1 truncate text-xl font-black text-neutral-950 dark:text-white">{selectedProject?.title || 'Projeto'}</h2>
            {isCorrectionPost(selectedProject) ? (
              <p className="mt-1 text-xs font-semibold text-teal-600 dark:text-teal-300">Correção enviada pela 20Cinco para nova análise.</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndoLastAction || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 transition hover:border-mag-300 hover:text-mag-600 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <RotateCcw size={16} /> Voltar último item
          </button>
        </div>

        {currentFile ? (
          <SwipeReviewCard
            post={selectedProject}
            file={currentFile}
            fileIndex={(selectedProject.files || []).findIndex(file => file.id === currentFile.id)}
            totalFiles={(selectedProject.files || []).length}
            busy={busy}
            onApprove={() => onApproveFile(selectedProject.id, currentFile.id)}
            onReject={() => setRejectOpen(true)}
          />
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30">
            <CheckCircle size={38} className="mx-auto text-green-600" />
            <h3 className="mt-3 text-lg font-black text-green-800 dark:text-green-200">Projeto revisado</h3>
            <p className="mt-1 text-sm text-green-700/80 dark:text-green-300/80">Todos os itens deste projeto foram analisados.</p>
          </div>
        )}

        {rejectOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
              <h3 className="text-lg font-black">Solicitar ajuste</h3>
              <p className="mt-1 text-sm text-neutral-500">Selecione as tags e descreva o que precisa mudar neste item.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {REJECTION_TAGS.map(tag => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTags(current => active ? current.filter(item => item !== tag) : [...current, tag])}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-red-500 bg-red-500 text-white' : 'border-neutral-200 text-neutral-600 hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300'}`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <textarea
                value={comment}
                onChange={event => setComment(event.target.value)}
                className="mt-4 h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-mag-400 dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Ex: trocar imagem, ajustar texto, revisar cor..."
              />
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => { setRejectOpen(false); setSelectedTags([]); setComment('') }} className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  Cancelar
                </button>
                <button type="button" onClick={submitReject} disabled={busy} className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  Enviar ajuste
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function EmptyPanel({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <LayoutGrid size={32} className="mx-auto text-neutral-300" />
      <h3 className="mt-3 text-sm font-extrabold text-neutral-700 dark:text-neutral-200">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </div>
  )
}

export default function ClientPortalPage({ mode = 'token' }) {
  const { token } = useParams()
  const { logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('calendar')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [lastAction, setLastAction] = useState(null)
  const [editingFeedback, setEditingFeedback] = useState(null)

  const isAuthenticatedMode = mode === 'auth'
  const reload = () => (isAuthenticatedMode ? fetchAuthenticatedPortal() : fetchPortal(token)).then(setPayload)

  useEffect(() => {
    setLoading(true)
    reload()
      .catch(error => toast.error(error.response?.data?.error || error.message || 'Link invalido ou expirado.'))
      .finally(() => setLoading(false))
  }, [token, isAuthenticatedMode])

  const posts = payload?.posts || []
  const client = payload?.client
  const lastActionKey = useMemo(
    () => `postinder.portal.lastAction.${isAuthenticatedMode ? client?.id || 'auth' : token || 'token'}`,
    [client?.id, isAuthenticatedMode, token],
  )

  const pendingProjects = useMemo(
    () => posts.filter(post => (post.files || []).some(isPendingFile)),
    [posts],
  )

  const pendingItemsCount = useMemo(
    () => pendingProjects.reduce((total, post) => total + (post.files || []).filter(isPendingFile).length, 0),
    [pendingProjects],
  )

  useEffect(() => {
    if (!pendingProjects.length) {
      setSelectedProjectId('')
      return
    }

    if (!selectedProjectId || !pendingProjects.some(post => post.id === selectedProjectId)) {
      setSelectedProjectId(pendingProjects[0].id)
    }
  }, [pendingProjects, selectedProjectId])

  const historyPosts = useMemo(
    () => posts.filter(post => ['approved', 'rejected', 'done'].includes(getStatus(post))),
    [posts],
  )

  const filteredHistory = useMemo(
    () => statusFilter === 'all' ? historyPosts : historyPosts.filter(post => getStatus(post) === statusFilter),
    [historyPosts, statusFilter],
  )

  const monthApproved = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    return posts.filter(post => getStatus(post) === 'approved' && formatMonthKey(post.approvedAt || post.updatedAt) === currentMonth).length
  }, [posts])

  const rejectedCount = posts.filter(post => getStatus(post) === 'rejected').length
  const nextPost = [...posts]
    .filter(post => getStatus(post) !== 'approved' && getPostDate(post))
    .sort((a, b) => new Date(getPostDate(a)) - new Date(getPostDate(b)))[0]

  const calendarGroups = useMemo(() => {
    const groups = new Map()
    posts.forEach(post => {
      const key = formatDate(getPostDate(post), 'Sem data planejada')
      groups.set(key, [...(groups.get(key) || []), post])
    })
    return [...groups.entries()]
  }, [posts])

  const files = useMemo(
    () => posts.flatMap(post => (post.files || []).map(file => ({ ...file, post }))),
    [posts],
  )

  const rejectedFiles = useMemo(
    () => files.filter(file => String(file.status || '').toLowerCase() === 'rejected'),
    [files],
  )

  const canUndoLastAction = useMemo(() => {
    if (!lastAction) return false
    const project = posts.find(post => post.id === lastAction.projectId)
    if (!project) return false
    return !['approved', 'done', 'executed'].includes(getStatus(project))
  }, [lastAction, posts])

  const feedbackItems = useMemo(() => {
    const fileFeedbacks = files
      .filter(file => file.rejection_reason || file.rejection_tags?.length)
      .map(file => ({
        id: `file-${file.id}`,
        post_title: file.post?.title || 'Post sem titulo',
        text: file.rejection_reason || 'Ajuste solicitado sem comentario detalhado.',
        tags: file.rejection_tags || [],
        created_at: file.updated_at || file.created_at,
      }))

    const generalFeedbacks = (payload?.feedbacks || []).map(item => ({
      ...item,
      tags: item.tags || [],
    }))

    return [...fileFeedbacks, ...generalFeedbacks].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [files, payload?.feedbacks])

  useEffect(() => {
    if (!payload) return
    try {
      const saved = localStorage.getItem(lastActionKey)
      setLastAction(saved ? JSON.parse(saved) : null)
    } catch {
      setLastAction(null)
    }
  }, [lastActionKey, payload])

  useEffect(() => {
    if (!lastAction) return
    const project = posts.find(post => post.id === lastAction.projectId)
    if (project && ['approved', 'done', 'executed'].includes(getStatus(project))) {
      setLastAction(null)
      localStorage.removeItem(lastActionKey)
    }
  }, [lastAction, lastActionKey, posts])

  async function handleApprove(postId) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await approveAuthenticatedPortalPost(postId)
      else await approvePortalPost(token, postId)
      await reload()
      toast.success('Conteudo aprovado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleReject(postId, comment) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await rejectAuthenticatedPortalPost(postId, comment)
      else await rejectPortalPost(token, postId, comment)
      await reload()
      toast.success('Ajustes enviados.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleApproveFile(projectId, fileId) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await approveAuthenticatedPortalFile(fileId)
      else await approvePortalFile(token, fileId)
      const action = { projectId, fileId, type: 'approved' }
      setLastAction(action)
      localStorage.setItem(lastActionKey, JSON.stringify(action))
      await reload()
      toast.success('Item aprovado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRejectFile(projectId, fileId, comment, tags = []) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await rejectAuthenticatedPortalFile(fileId, comment, tags)
      else await rejectPortalFile(token, fileId, comment, tags)
      const action = { projectId, fileId, type: 'rejected' }
      setLastAction(action)
      localStorage.setItem(lastActionKey, JSON.stringify(action))
      await reload()
      toast.success('Ajuste enviado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUndoLastAction() {
    if (!lastAction || !canUndoLastAction) return
    setBusy(true)
    try {
      if (isAuthenticatedMode) await resetAuthenticatedPortalFile(lastAction.fileId)
      else await resetPortalFile(token, lastAction.fileId)
      setSelectedProjectId(lastAction.projectId)
      setLastAction(null)
      localStorage.removeItem(lastActionKey)
      await reload()
      toast.success('Última ação desfeita.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateRejectedFeedback() {
    const comment = String(editingFeedback?.comment || '').trim()
    if (!editingFeedback?.file?.id) return
    if (!comment) {
      toast.error('Escreva um comentario antes de salvar.')
      return
    }

    setBusy(true)
    try {
      if (isAuthenticatedMode) await updateAuthenticatedPortalFileFeedback(editingFeedback.file.id, comment, editingFeedback.tags || [])
      else await updatePortalFileFeedback(token, editingFeedback.file.id, comment, editingFeedback.tags || [])
      setEditingFeedback(null)
      await reload()
      toast.success('Feedback atualizado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGeneralFeedback() {
    if (!generalFeedback.trim()) {
      toast.error('Escreva um comentario antes de enviar.')
      return
    }
    setBusy(true)
    try {
      const payload = { text: generalFeedback.trim(), month: new Date().toISOString().slice(0, 7) }
      if (isAuthenticatedMode) await sendAuthenticatedPortalFeedback(payload)
      else await sendPortalFeedback(token, payload)
      setGeneralFeedback('')
      await reload()
      toast.success('Feedback enviado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-500 dark:bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-mag-500" />
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
        <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <XCircle size={38} className="mx-auto text-red-500" />
          <h1 className="mt-4 text-xl font-extrabold">Link indisponivel</h1>
          <p className="mt-2 text-sm text-neutral-500">Este link pode ter expirado ou ter sido substituido por um novo link do portal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-mag-600">Postinder</div>
            <h1 className="mt-1 text-2xl font-black">Portal de Revisao</h1>
          </div>
          <div className="flex items-center gap-2">
            {payload.expiresAt ? (
              <div className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500 dark:border-neutral-700">
                Link valido ate {formatDate(payload.expiresAt)}
              </div>
            ) : null}
            {isAuthenticatedMode ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-red-500 dark:border-neutral-700"
              >
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        <section className="space-y-5">
          <div className="text-center">
            <p className="text-sm font-semibold text-neutral-500">Ola, {client?.name}</p>
            <h2 className="mt-1 text-3xl font-black text-neutral-950 dark:text-white">Revise seus conteudos</h2>
          </div>

          <ProjectReviewPanel
            projects={pendingProjects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onApproveFile={handleApproveFile}
            onRejectFile={handleRejectFile}
            onUndo={handleUndoLastAction}
            canUndoLastAction={canUndoLastAction}
            busy={busy}
          />
        </section>

        <section className="space-y-5 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-neutral-400">Informacoes complementares</div>
              <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">Acompanhamento do conteudo</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Clock size={20} />} label="Aguardando aprovacao" value={pendingProjects.length} sub={`${pendingItemsCount} itens pendentes`} />
            <MetricCard icon={<CheckCircle size={20} />} label="Aprovados no mes" value={monthApproved} sub="conteudos liberados" />
            <MetricCard icon={<XCircle size={20} />} label="Com ajustes" value={rejectedCount} sub="comentarios enviados" />
            <MetricCard icon={<CalendarDays size={20} />} label="Proxima publicacao" value={nextPost ? formatDate(getPostDate(nextPost)) : 'Sem previsao'} sub={nextPost?.title || 'nenhum post planejado'} />
          </div>

          <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-800">
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${active ? 'bg-mag-600 text-white' : 'bg-white text-neutral-600 hover:text-mag-600 dark:bg-neutral-900 dark:text-neutral-300'}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
          </nav>

        {activeTab === 'calendar' && (
          <section className="space-y-4">
            {calendarGroups.length ? calendarGroups.map(([date, items]) => (
              <div key={date} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-3 text-sm font-extrabold text-neutral-500">{date}</h3>
                <div className="space-y-2">
                  {items.map(post => (
                    <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-3 dark:bg-neutral-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{post.title || 'Post sem titulo'}</div>
                        <div className="mt-1 text-xs text-neutral-500">{(post.channels || []).join(', ') || 'Sem canais definidos'}</div>
                      </div>
                      <StatusPill status={getStatus(post)} />
                    </div>
                  ))}
                </div>
              </div>
            )) : <EmptyPanel title="Sem calendario" description="Nao existem posts com data para exibir." />}
          </section>
        )}

        {activeTab === 'rejected' && (
          <section className="space-y-4">
            {rejectedFiles.length ? rejectedFiles.map(file => (
              <article key={file.id} className="grid gap-4 rounded-lg border border-red-200 bg-white p-4 shadow-sm dark:border-red-900 dark:bg-neutral-900 lg:grid-cols-[220px_minmax(0,1fr)]">
                <a href={resolveMediaUrl(file.storage_url || file.url)} target="_blank" rel="noopener noreferrer" className="block">
                  <FilePreview file={file} />
                </a>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-wider text-red-500">Item recusado</div>
                      <h3 className="mt-1 truncate text-lg font-black text-neutral-950 dark:text-white">{file.post?.title || 'Post sem titulo'}</h3>
                      <p className="mt-1 truncate text-sm font-semibold text-neutral-500">{file.name || 'Arquivo'}</p>
                    </div>
                    <StatusPill status="rejected" />
                  </div>

                  {file.rejection_tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {file.rejection_tags.map(tag => (
                        <span key={tag} className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{tag}</span>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {file.rejection_reason || 'Sem comentario detalhado.'}
                  </p>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingFeedback({ file, comment: file.rejection_reason || '', tags: file.rejection_tags || [] })}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-600 transition hover:border-mag-300 hover:text-mag-600 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      Editar feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveFile(file.post?.id, file.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
                    >
                      <CheckCircle size={16} /> Aprovar este item
                    </button>
                  </div>
                </div>
              </article>
            )) : <EmptyPanel title="Nenhum item recusado" description="Itens recusados ficarao aqui caso voce queira revisar e aprovar depois." />}
          </section>
        )}

        {activeTab === 'history' && (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Todos'],
                ['approved', 'Aprovados'],
                ['rejected', 'Com ajustes'],
                ['done', 'Concluidos'],
              ].map(([value, label]) => (
                <button key={value} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter === value ? 'bg-mag-600 text-white' : 'bg-white text-neutral-500 dark:bg-neutral-900'}`} onClick={() => setStatusFilter(value)} type="button">
                  {label}
                </button>
              ))}
            </div>
            {filteredHistory.length ? filteredHistory.map(post => (
              <div key={post.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">{post.title || 'Post sem titulo'}</h3>
                    <p className="mt-1 text-sm text-neutral-500">{formatDate(getPostDate(post))}</p>
                  </div>
                  <StatusPill status={getStatus(post)} />
                </div>
                {post.description && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{post.description}</p>}
              </div>
            )) : <EmptyPanel title="Sem historico" description="Posts aprovados, recusados ou concluidos aparecerao aqui." />}
          </section>
        )}

        {activeTab === 'files' && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {files.length ? files.map(file => (
              <a key={file.id} href={resolveMediaUrl(file.storage_url || file.url)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-mag-300 dark:border-neutral-800 dark:bg-neutral-900">
                <FilePreview file={file} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{file.name || 'Arquivo'}</div>
                    <div className="mt-1 truncate text-xs text-neutral-500">{file.post?.title || 'Post sem titulo'}</div>
                  </div>
                  <StatusPill status={file.status || getStatus(file.post)} />
                </div>
              </a>
            )) : <div className="md:col-span-2 xl:col-span-3"><EmptyPanel title="Sem arquivos" description="Arquivos anexados aos posts aparecerao aqui." /></div>}
          </section>
        )}

        {activeTab === 'feedbacks' && (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="font-extrabold">Enviar feedback geral</h3>
              <p className="mt-1 text-sm text-neutral-500">Use este campo para comentarios sobre a rotina de conteudo.</p>
              <textarea value={generalFeedback} onChange={event => setGeneralFeedback(event.target.value)} className="mt-4 h-32 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-mag-400 dark:border-neutral-700 dark:bg-neutral-950" placeholder="Escreva seu comentario..." />
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-mag-600 px-4 py-2 text-sm font-bold text-white hover:bg-mag-700 disabled:opacity-60" onClick={handleGeneralFeedback} disabled={busy} type="button">
                <Send size={15} /> Enviar feedback
              </button>
            </div>
            <div className="space-y-3">
              {feedbackItems.length ? feedbackItems.map(item => (
                <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-bold">{item.post_title || 'Feedback geral'}</div>
                    <div className="text-xs text-neutral-400">{formatDate(item.created_at)}</div>
                  </div>
                  {item.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{item.text}</p>
                  {item.rating ? <div className="mt-2 text-xs font-bold text-amber-600">Nota {item.rating}/5</div> : null}
                </div>
              )) : <EmptyPanel title="Sem feedbacks" description="Comentarios e motivos de ajuste aparecerao aqui." />}
            </div>
          </section>
        )}
        </section>

        {editingFeedback ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
              <h3 className="text-lg font-black">Editar feedback</h3>
              <p className="mt-1 text-sm text-neutral-500">Atualize as tags e o comentário do item recusado.</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {REJECTION_TAGS.map(tag => {
                  const active = (editingFeedback.tags || []).includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditingFeedback(current => ({
                        ...current,
                        tags: active
                          ? (current.tags || []).filter(item => item !== tag)
                          : [...(current.tags || []), tag],
                      }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-red-500 bg-red-500 text-white' : 'border-neutral-200 text-neutral-600 hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300'}`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={editingFeedback.comment}
                onChange={event => setEditingFeedback(current => ({ ...current, comment: event.target.value }))}
                className="mt-4 h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-mag-400 dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Descreva o que precisa ser ajustado..."
              />

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFeedback(null)}
                  className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdateRejectedFeedback}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-mag-600 px-4 py-2 text-sm font-bold text-white hover:bg-mag-700 disabled:opacity-60"
                >
                  Salvar feedback
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
