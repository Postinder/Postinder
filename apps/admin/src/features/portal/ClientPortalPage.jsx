import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  approvePortalFile,
  fetchPortal,
  rejectPortalFile,
  resetPortalFile,
  sendPortalFeedback,
  updatePortalFileFeedback,
  approvePortalSoundtrack,
  adjustPortalSoundtrack,
  resetPortalSoundtrack,
} from '../../services/portal.service'
import {
  approveAuthenticatedPortalFile,
  fetchAuthenticatedPortal,
  rejectAuthenticatedPortalFile,
  resetAuthenticatedPortalFile,
  sendAuthenticatedPortalFeedback,
  updateAuthenticatedPortalFileFeedback,
  approveAuthenticatedPortalSoundtrack,
  adjustAuthenticatedPortalSoundtrack,
  resetAuthenticatedPortalSoundtrack,
} from '../../services/clientPortal.service'
import { useAuthStore } from '../../store/authStore'
import { REJECTION_TAGS } from '../../utils/constants'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import MediaPreview, { getMediaKind } from '../../components/media/MediaPreview'
import { PORTAL_OVERVIEW_INITIAL_STATE, togglePortalOverview } from '../../utils/collapsiblePanels'
import PortalDialog from './PortalDialog'
import PortalContentSelector from './PortalContentSelector'
import PortalHeader from './PortalHeader'
import PortalMetricsBar from './PortalMetricsBar'
import PortalReviewActions from './PortalReviewActions'
import PortalReviewHeader from './PortalReviewHeader'
import PortalStatusBadge from './PortalStatusBadge'
import SoundtrackReviewCard from './SoundtrackReviewCard'
import {
  formatDate,
  getPostDate,
  getPostStatus,
  isPendingFile,
} from './portalStatus'
import {
  countApprovedInMonth,
  countContentsWithAdjustments,
  findNextScheduledPost,
} from './portalMetrics'
import {
  PORTAL_SWIPE_INTENT_THRESHOLD,
  clampPortalSwipeOffset,
  getPortalSwipeAction,
  getPortalSwipeIntent,
  isVideoControlsArea,
} from './portalSwipe'
import './portalBrand.css'

const tabs = [
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'rejected', label: 'Recusados', icon: XCircle },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'files', label: 'Arquivos', icon: FolderOpen },
  { id: 'feedbacks', label: 'Feedbacks', icon: MessageSquare },
]

function FilePreview({ file }) {
  const url = resolveMediaUrl(file.storage_url || file.url)
  return <MediaPreview file={file} src={url} className="h-40 w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800" mediaClassName="h-full w-full object-contain" />
}

function SwipeReviewCard({ post, file, onApprove, onReject, busy }) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const cardRef = useRef(null)
  const pointerIdRef = useRef(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const dragXRef = useRef(0)
  const gestureIntentRef = useRef(null)
  const suppressClickUntilRef = useRef(0)
  const mediaUrl = resolveMediaUrl(file?.storage_url || file?.url)
  const fileType = String(file?.file_type || '').toUpperCase()
  const fileName = file?.name || 'Arquivo'
  const isImage = fileType === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg)$/i.test(fileName)
  const isVideo = getMediaKind(file) === 'video'
  const description = String(post?.description || '')
  const canExpandDescription = description.length > 110 || description.split('\n').length > 1

  useEffect(() => {
    setDescriptionExpanded(false)
    pointerIdRef.current = null
    dragXRef.current = 0
    gestureIntentRef.current = null
    suppressClickUntilRef.current = 0
    setDragging(false)
    setDragX(0)
  }, [file?.id])

  function isPortalVideoFullscreen() {
    if (!isVideo || typeof document === 'undefined') return false
    const video = cardRef.current?.querySelector('video')
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
    return Boolean(
      (fullscreenElement && video && (fullscreenElement === video || fullscreenElement.contains?.(video) || video.contains?.(fullscreenElement)))
      || video?.webkitDisplayingFullscreen,
    )
  }

  function isInteractiveGestureTarget(event) {
    const target = event.target
    if (target?.closest?.('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) return true

    const video = isVideo ? target?.closest?.('video') : null
    if (!video) return false
    const bounds = video.getBoundingClientRect()
    return isVideoControlsArea(event.clientY, bounds.top, bounds.height)
  }

  function resetPointer(event) {
    const pointerId = pointerIdRef.current
    const captureTarget = event?.currentTarget || cardRef.current
    pointerIdRef.current = null
    dragXRef.current = 0
    gestureIntentRef.current = null
    if (pointerId !== null && captureTarget?.hasPointerCapture?.(pointerId)) {
      captureTarget.releasePointerCapture(pointerId)
    }
    setDragging(false)
    setDragX(0)
  }

  function handlePointerDown(event) {
    if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (isPortalVideoFullscreen() || isInteractiveGestureTarget(event)) return
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    dragXRef.current = 0
    gestureIntentRef.current = isVideo ? 'pending' : 'horizontal'
    setDragX(0)
    setDragging(!isVideo)
    if (!isVideo) event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    if (pointerIdRef.current !== event.pointerId) return
    if (busy || isPortalVideoFullscreen()) {
      resetPointer(event)
      return
    }

    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current
    if (gestureIntentRef.current === 'pending') {
      const intent = getPortalSwipeIntent(deltaX, deltaY)
      if (intent === 'pending') return
      if (intent === 'vertical') {
        resetPointer(event)
        return
      }

      gestureIntentRef.current = 'horizontal'
      setDragging(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    if (gestureIntentRef.current !== 'horizontal') return
    const nextDragX = clampPortalSwipeOffset(deltaX)
    dragXRef.current = nextDragX
    setDragX(nextDragX)
    if (Math.abs(nextDragX) > 6) event.preventDefault()
  }

  function finishPointer(event) {
    if (pointerIdRef.current !== event.pointerId) return
    const finalX = dragXRef.current
    const wasHorizontalGesture = gestureIntentRef.current === 'horizontal'
    const fullscreen = isPortalVideoFullscreen()
    if (isVideo && wasHorizontalGesture && Math.abs(finalX) >= PORTAL_SWIPE_INTENT_THRESHOLD) {
      suppressClickUntilRef.current = Date.now() + 400
    }
    resetPointer(event)
    if (busy || fullscreen || !wasHorizontalGesture) return

    const action = getPortalSwipeAction(finalX)
    if (action === 'approve') onApprove()
    if (action === 'reject') onReject()
  }

  function cancelPointer(event) {
    if (pointerIdRef.current !== event.pointerId) return
    if (isVideo && gestureIntentRef.current === 'horizontal') {
      suppressClickUntilRef.current = Date.now() + 400
    }
    resetPointer(event)
  }

  function handleClickCapture(event) {
    if (!isVideo || Date.now() > suppressClickUntilRef.current) return
    suppressClickUntilRef.current = 0
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className="mx-auto max-w-2xl xl:max-w-5xl">
      <div
        ref={cardRef}
        className={`relative select-none overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl touch-pan-y dark:border-neutral-800 dark:bg-neutral-900 ${dragging ? 'cursor-grabbing' : 'cursor-grab transition-transform duration-200 motion-reduce:transition-none'}`}
        style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)` }}
        onPointerDown={isVideo ? undefined : handlePointerDown}
        onPointerMove={isVideo ? undefined : handlePointerMove}
        onPointerUp={isVideo ? undefined : finishPointer}
        onPointerCancel={isVideo ? undefined : cancelPointer}
        onPointerDownCapture={isVideo ? handlePointerDown : undefined}
        onPointerMoveCapture={isVideo ? handlePointerMove : undefined}
        onPointerUpCapture={isVideo ? finishPointer : undefined}
        onPointerCancelCapture={isVideo ? cancelPointer : undefined}
        onLostPointerCapture={cancelPointer}
        onClickCapture={isVideo ? handleClickCapture : undefined}
        onDragStart={event => event.preventDefault()}
      >
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-6">
          <span className={`rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white transition-opacity motion-reduce:transition-none ${dragX < -35 ? 'opacity-100' : 'opacity-0'}`}>
            AJUSTAR
          </span>
          <span className={`rounded-full bg-green-600 px-4 py-2 text-sm font-black text-white transition-opacity motion-reduce:transition-none ${dragX > 35 ? 'opacity-100' : 'opacity-0'}`}>
            APROVAR
          </span>
        </div>

        <div className="relative bg-neutral-100 dark:bg-neutral-950">
          {isVideo && mediaUrl ? (
            <MediaPreview
              file={file}
              src={mediaUrl}
              className="h-[min(500px,56vh)] w-full md:h-[min(480px,calc(100vh-24rem))] xl:h-[min(528px,calc(100vh-16.25rem))]"
              mediaClassName="h-full w-full object-contain"
            />
          ) : isImage && mediaUrl ? (
            <img
              src={mediaUrl}
              alt={fileName}
              draggable={false}
              className="pointer-events-none h-[min(500px,56vh)] w-full object-contain md:h-[min(480px,calc(100vh-24rem))] xl:h-[min(528px,calc(100vh-16.25rem))]"
            />
          ) : mediaUrl ? (
            <div className="flex h-[min(500px,56vh)] flex-col items-center justify-center gap-4 px-6 text-center text-neutral-500 dark:text-neutral-300 md:h-[min(480px,calc(100vh-24rem))] xl:h-[min(528px,calc(100vh-16.25rem))]">
              <FileText size={52} />
              <p className="max-w-full truncate text-sm font-semibold">{fileName}</p>
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={event => event.stopPropagation()}
                className="rounded-lg bg-[var(--portal-brand-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--portal-brand-primary-hover)] active:bg-[var(--portal-brand-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
              >
                Abrir arquivo
              </a>
            </div>
          ) : (
            <div className="flex h-[min(500px,56vh)] items-center justify-center text-neutral-400 dark:text-neutral-300/80 md:h-[min(480px,calc(100vh-24rem))] xl:h-[min(528px,calc(100vh-16.25rem))]">Arquivo indisponível</div>
          )}
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 md:max-w-[14rem] xl:max-w-xs">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-300/80">Arquivo</span>
              <h3 className="truncate text-sm font-black text-neutral-950 dark:text-white">{fileName}</h3>
            </div>
            <PortalStatusBadge status={file.status || 'pending'} />
            <p className="w-full text-center text-[11px] font-semibold text-neutral-400 dark:text-neutral-300/80 sm:ml-auto sm:w-auto sm:text-right">
              Arraste: esquerda para ajustar · direita para aprovar
            </p>
          </div>

          <div className="mt-2 flex min-w-0 items-start gap-3 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            {description ? (
              <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
                <span className="shrink-0 pt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-300/80">Legenda</span>
                <p lang="pt-BR" className={`min-w-0 flex-1 break-words hyphens-auto text-xs leading-5 text-neutral-600 dark:text-neutral-300 ${descriptionExpanded ? 'whitespace-pre-wrap' : canExpandDescription ? 'line-clamp-2 md:line-clamp-1' : 'whitespace-pre-wrap'}`}>
                  {description}
                </p>
                {canExpandDescription ? (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded(value => !value)}
                    onPointerDown={event => event.stopPropagation()}
                    aria-expanded={descriptionExpanded}
                    className="shrink-0 rounded-sm pt-0.5 text-[11px] font-bold text-[var(--portal-brand-foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)]"
                  >
                    {descriptionExpanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="min-w-0 flex-1 text-xs text-neutral-400 dark:text-neutral-300/80">Sem legenda informada.</p>
            )}
            <PortalReviewActions
              fileName={fileName}
              onReject={onReject}
              onApprove={onApprove}
              busy={busy}
              compact
              className="hidden shrink-0 self-start md:flex"
            />
          </div>
        </div>
      </div>

      <PortalReviewActions
        fileName={fileName}
        onReject={onReject}
        onApprove={onApprove}
        busy={busy}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(0,0,0,0.08)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:hidden"
      />
    </div>
  )
}

function ProjectReviewPanel({ projects, pendingItemsCount, selectedProjectId, onSelectProject, onApproveFile, onRejectFile, onApproveSoundtrack, onAdjustSoundtrack, onUndo, canUndoLastAction, busy }) {
  const selectedProject = projects.find(post => post.id === selectedProjectId) || projects[0]
  const pendingFiles = selectedProject ? (selectedProject.files || []).filter(isPendingFile) : []
  const currentFile = pendingFiles[0]
  const pendingSoundtrack = selectedProject?.soundtrack && (selectedProject.soundtrack.approvalStatus || selectedProject.soundtrack.approval_status) === 'pending'
    ? selectedProject.soundtrack
    : null
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const rejectTextareaRef = useRef(null)

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

  function closeRejectDialog() {
    setRejectOpen(false)
    setSelectedTags([])
    setComment('')
  }

  if (!projects.length) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-green-50 p-7 text-center shadow-sm dark:border-green-900 dark:bg-green-950/30 sm:p-10">
        <CheckCircle size={42} className="mx-auto text-green-600 dark:text-green-400" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-black text-green-900 dark:text-green-100">Tudo revisado por enquanto</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-green-800/80 dark:text-green-300/80">
          Não há conteúdos aguardando sua decisão. Novos itens aparecerão aqui quando forem enviados para aprovação.
        </p>
        {canUndoLastAction ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            aria-label="Desfazer a última decisão"
            className="mt-5 inline-flex items-center justify-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-bold text-green-800 transition hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:bg-neutral-900 dark:text-green-300 dark:hover:bg-green-950 dark:focus-visible:ring-offset-neutral-950"
          >
            Desfazer última decisão
          </button>
        ) : null}
      </div>
    )
  }

  const currentFileIndex = currentFile
    ? (selectedProject.files || []).findIndex(file => file.id === currentFile.id)
    : -1

  return (
    <div className="min-w-0 space-y-3 xl:flex xl:items-start xl:gap-4 xl:space-y-0">
      <PortalContentSelector
        contents={projects}
        totalPendingItems={pendingItemsCount}
        selectedContentId={selectedProject.id}
        onSelectContent={onSelectProject}
      />

      <section className="min-w-0 flex-1">
        <PortalReviewHeader
          content={selectedProject}
          currentPosition={currentFile ? Math.max(currentFileIndex + 1, 1) : (selectedProject.files || []).length + 1}
          totalFiles={(selectedProject.files || []).length + (selectedProject.soundtrack ? 1 : 0)}
          onUndo={onUndo}
          canUndo={canUndoLastAction}
          busy={busy}
        />

        {currentFile ? (
          <SwipeReviewCard
            post={selectedProject}
            file={currentFile}
            busy={busy}
            onApprove={() => onApproveFile(selectedProject.id, currentFile.id)}
            onReject={() => setRejectOpen(true)}
          />
        ) : !pendingSoundtrack ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30">
            <CheckCircle size={38} className="mx-auto text-green-600" />
            <h3 className="mt-3 text-lg font-black text-green-800 dark:text-green-200">Conteúdo revisado</h3>
            <p className="mt-1 text-sm text-green-700/80 dark:text-green-300/80">Todos os arquivos deste conteúdo foram analisados.</p>
          </div>
        ) : null}

        {pendingSoundtrack ? (
          <SoundtrackReviewCard
            post={selectedProject}
            soundtrack={pendingSoundtrack}
            busy={busy}
            onApprove={() => onApproveSoundtrack(selectedProject.id)}
            onAdjust={comment => onAdjustSoundtrack(selectedProject.id, comment)}
          />
        ) : null}

        {rejectOpen ? (
          <PortalDialog
            labelledBy="portal-reject-title"
            describedBy="portal-reject-description"
            onClose={closeRejectDialog}
            initialFocusRef={rejectTextareaRef}
          >
              <h3 id="portal-reject-title" className="text-lg font-black">Solicitar ajuste</h3>
              <p id="portal-reject-description" className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">Selecione as tags e descreva o que precisa mudar neste item.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {REJECTION_TAGS.map(tag => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTags(current => active ? current.filter(item => item !== tag) : [...current, tag])}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${active ? 'border-red-500 bg-red-500 text-white' : 'border-neutral-200 text-neutral-600 hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300'}`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <textarea
                ref={rejectTextareaRef}
                value={comment}
                onChange={event => setComment(event.target.value)}
                aria-label="Descrição do ajuste solicitado"
                className="mt-4 h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-[var(--portal-brand-border)] focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Ex: trocar imagem, ajustar texto, revisar cor..."
              />
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={closeRejectDialog} className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] dark:border-neutral-700 dark:text-neutral-300">
                  Cancelar
                </button>
                <button type="button" onClick={submitReject} disabled={busy} className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-neutral-900">
                  Enviar ajuste
                </button>
              </div>
          </PortalDialog>
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
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">{description}</p>
    </div>
  )
}

export default function ClientPortalPage({ mode = 'token' }) {
  const { token } = useParams()
  const { logout, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('calendar')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [isOverviewExpanded, dispatchPortalOverview] = useReducer(togglePortalOverview, PORTAL_OVERVIEW_INITIAL_STATE)
  const [lastAction, setLastAction] = useState(null)
  const [editingFeedback, setEditingFeedback] = useState(null)
  const feedbackTextareaRef = useRef(null)
  const tabRefs = useRef({})

  const isAuthenticatedMode = mode === 'auth'
  const reload = () => (isAuthenticatedMode ? fetchAuthenticatedPortal() : fetchPortal(token)).then(setPayload)

  async function loadPortal() {
    setLoading(true)
    setLoadError(null)
    try {
      await reload()
    } catch (error) {
      setPayload(null)
      setLoadError(error)
      toast.error(error.response?.data?.error || error.message || 'Não foi possível carregar o portal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPortal()
  }, [token, isAuthenticatedMode])

  const posts = payload?.posts || []
  const client = payload?.client
  const lastActionKey = useMemo(
    () => `postinder.portal.lastAction.${isAuthenticatedMode ? client?.id || 'auth' : token || 'token'}`,
    [client?.id, isAuthenticatedMode, token],
  )

  const pendingProjects = useMemo(
    () => posts.filter(post => (
      (post.files || []).some(isPendingFile)
      || (post.soundtrack && (post.soundtrack.approvalStatus || post.soundtrack.approval_status) === 'pending')
    )),
    [posts],
  )

  const pendingItemsCount = useMemo(
    () => pendingProjects.reduce((total, post) => total
      + (post.files || []).filter(isPendingFile).length
      + ((post.soundtrack?.approvalStatus || post.soundtrack?.approval_status) === 'pending' ? 1 : 0), 0),
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
    () => posts.filter(post => ['approved', 'rejected', 'executed'].includes(getPostStatus(post))),
    [posts],
  )

  const filteredHistory = useMemo(
    () => statusFilter === 'all' ? historyPosts : historyPosts.filter(post => getPostStatus(post) === statusFilter),
    [historyPosts, statusFilter],
  )

  const monthApproved = useMemo(() => countApprovedInMonth(posts), [posts])
  const rejectedCount = useMemo(() => countContentsWithAdjustments(posts), [posts])
  const nextPost = useMemo(() => findNextScheduledPost(posts), [posts])

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

  const rejectedSoundtracks = useMemo(
    () => posts.filter(post => (post.soundtrack?.approvalStatus || post.soundtrack?.approval_status) === 'adjustment_requested'),
    [posts],
  )

  const canUndoLastAction = useMemo(() => {
    if (!lastAction) return false
    const project = posts.find(post => post.id === lastAction.projectId)
    if (!project) return false
    return !['approved', 'executed'].includes(getPostStatus(project))
  }, [lastAction, posts])

  const feedbackItems = useMemo(() => {
    const fileFeedbacks = files
      .filter(file => file.rejection_reason || file.rejection_tags?.length)
      .map(file => ({
        id: `file-${file.id}`,
        post_title: file.post?.title || 'Conteúdo sem título',
        text: file.rejection_reason || 'Ajuste solicitado sem comentario detalhado.',
        tags: file.rejection_tags || [],
        created_at: file.updated_at || file.created_at,
      }))

    const soundtrackFeedbacks = rejectedSoundtracks.map(post => ({
      id: `soundtrack-${post.soundtrack.id}`,
      post_title: post.title || 'Conteudo sem titulo',
      text: post.soundtrack.adjustmentComment || post.soundtrack.adjustment_comment || 'Ajuste solicitado no fundo sonoro.',
      tags: ['Fundo sonoro'],
      created_at: post.soundtrack.adjustmentRequestedAt || post.soundtrack.adjustment_requested_at || post.soundtrack.updatedAt,
    }))

    const generalFeedbacks = (payload?.feedbacks || []).map(item => ({
      ...item,
      tags: item.tags || [],
    }))

    return [...fileFeedbacks, ...soundtrackFeedbacks, ...generalFeedbacks].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [files, payload?.feedbacks, rejectedSoundtracks])

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
    if (project && ['approved', 'executed'].includes(getPostStatus(project))) {
      setLastAction(null)
      localStorage.removeItem(lastActionKey)
    }
  }, [lastAction, lastActionKey, posts])

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

  async function handleApproveSoundtrack(projectId) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await approveAuthenticatedPortalSoundtrack(projectId)
      else await approvePortalSoundtrack(token, projectId)
      const action = { projectId, kind: 'soundtrack', type: 'approved' }
      setLastAction(action)
      localStorage.setItem(lastActionKey, JSON.stringify(action))
      await reload()
      toast.success('Fundo sonoro aprovado.')
    } catch (error) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdjustSoundtrack(projectId, comment) {
    setBusy(true)
    try {
      if (isAuthenticatedMode) await adjustAuthenticatedPortalSoundtrack(projectId, comment)
      else await adjustPortalSoundtrack(token, projectId, comment)
      const action = { projectId, kind: 'soundtrack', type: 'adjustment_requested' }
      setLastAction(action)
      localStorage.setItem(lastActionKey, JSON.stringify(action))
      await reload()
      toast.success('Ajuste do fundo sonoro enviado.')
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
      if (lastAction.kind === 'soundtrack') {
        if (isAuthenticatedMode) await resetAuthenticatedPortalSoundtrack(lastAction.projectId)
        else await resetPortalSoundtrack(token, lastAction.projectId)
      } else if (isAuthenticatedMode) await resetAuthenticatedPortalFile(lastAction.fileId)
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

  function handleTabKeyDown(event, currentIndex) {
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    setActiveTab(nextTab.id)
    requestAnimationFrame(() => tabRefs.current[nextTab.id]?.focus())
  }

  if (loading) {
    return (
      <div className="portal-brand flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-500 dark:bg-neutral-950">
        <Loader2 size={32} className="animate-spin text-[var(--portal-brand-foreground)]" aria-label="Carregando portal" />
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="portal-brand min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-white">
        <PortalHeader clientName={user?.name} isAuthenticated={isAuthenticatedMode} onLogout={logout} />
        <main className="mx-auto flex max-w-[1440px] justify-center px-4 py-16 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <XCircle size={38} className="mx-auto text-red-500" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-extrabold">
              {isAuthenticatedMode ? 'Não foi possível carregar o portal' : 'Link indisponível'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-300/80">
              {isAuthenticatedMode
                ? (loadError?.response?.data?.error || 'O portal está temporariamente indisponível. Tente novamente em instantes.')
                : 'Este link pode ter expirado ou ter sido substituído por um novo link do portal.'}
            </p>
            <button
              type="button"
              onClick={loadPortal}
              className="mt-5 rounded-lg bg-[var(--portal-brand-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--portal-brand-primary-hover)] active:bg-[var(--portal-brand-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="portal-brand min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <PortalHeader
        clientName={client?.name}
        expiresAt={payload.expiresAt}
        isAuthenticated={isAuthenticatedMode}
        onLogout={logout}
      />

      <main className="mx-auto max-w-[1440px] space-y-8 px-4 py-2 pb-32 sm:px-6 sm:py-3 md:pb-8">
        <section aria-label="Revisão de conteúdos">
          <ProjectReviewPanel
            projects={pendingProjects}
            pendingItemsCount={pendingItemsCount}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onApproveFile={handleApproveFile}
            onRejectFile={handleRejectFile}
            onApproveSoundtrack={handleApproveSoundtrack}
            onAdjustSoundtrack={handleAdjustSoundtrack}
            onUndo={handleUndoLastAction}
            canUndoLastAction={canUndoLastAction}
            busy={busy}
          />
        </section>

        <section className="space-y-5 border-t border-neutral-200 pt-6 dark:border-neutral-800" aria-labelledby="portal-overview-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-300/80">Visão geral</div>
              <h2 id="portal-overview-title" className="mt-1 text-lg font-black text-neutral-950 dark:text-white">Acompanhamento do conteúdo</h2>
              <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-300/80">
                Acesse calendário, histórico, arquivos e feedbacks.
              </p>
            </div>
            <button
              type="button"
              onClick={dispatchPortalOverview}
              aria-expanded={isOverviewExpanded}
              aria-controls="portal-overview-content"
              aria-label={`${isOverviewExpanded ? 'Recolher' : 'Expandir'} visão geral`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-[var(--portal-brand-border)] hover:bg-[var(--portal-brand-soft-hover)] hover:text-[var(--portal-brand-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:focus-visible:ring-offset-neutral-950"
            >
              <ChevronDown
                size={19}
                aria-hidden="true"
                className={`transition-transform duration-200 motion-reduce:transition-none ${isOverviewExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          <div
            id="portal-overview-content"
            role="region"
            aria-labelledby="portal-overview-title"
            hidden={!isOverviewExpanded}
            className="space-y-5"
          >
            <PortalMetricsBar items={[
              { id: 'pending', icon: <Clock size={16} />, label: 'Aguardando aprovação', value: pendingProjects.length, sub: `${pendingItemsCount} itens pendentes` },
              { id: 'approved', icon: <CheckCircle size={16} />, label: 'Aprovados no mês', value: monthApproved, sub: 'conteúdos liberados' },
              { id: 'adjustments', icon: <XCircle size={16} />, label: 'Com ajustes', value: rejectedCount, sub: 'conteúdos com ajustes solicitados' },
              { id: 'next', icon: <CalendarDays size={16} />, label: 'Próxima data prevista', value: nextPost ? formatDate(getPostDate(nextPost)) : 'Sem previsão', sub: nextPost?.title || 'nenhum conteúdo planejado' },
            ]} />

            <nav role="tablist" aria-label="Informações complementares do portal" className="flex gap-2 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  ref={element => { tabRefs.current[tab.id] = element }}
                  id={`portal-tab-${tab.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`portal-panel-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] ${active ? 'bg-[var(--portal-brand-primary)] text-white' : 'text-neutral-600 hover:bg-[var(--portal-brand-soft-hover)] hover:text-[var(--portal-brand-foreground)] dark:text-neutral-300'}`}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={event => handleTabKeyDown(event, index)}
                  type="button"
                >
                  <Icon size={16} /> {tab.label}
                </button>
              )
            })}
            </nav>

          {activeTab === 'calendar' && (
          <section id="portal-panel-calendar" role="tabpanel" aria-labelledby="portal-tab-calendar" tabIndex={0} className="space-y-4 focus:outline-none">
            {calendarGroups.length ? calendarGroups.map(([date, items]) => (
              <div key={date} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="mb-3 text-sm font-extrabold text-neutral-500 dark:text-neutral-300">{date}</h3>
                <div className="space-y-2">
                  {items.map(post => (
                    <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-3 dark:bg-neutral-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{post.title || 'Conteúdo sem título'}</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-300/80">{(post.channels || []).join(', ') || 'Sem canais definidos'}</div>
                      </div>
                      <PortalStatusBadge status={getPostStatus(post)} />
                    </div>
                  ))}
                </div>
              </div>
            )) : <EmptyPanel title="Sem calendário" description="Não existem conteúdos com data para exibir." />}
          </section>
          )}

          {activeTab === 'rejected' && (
          <section id="portal-panel-rejected" role="tabpanel" aria-labelledby="portal-tab-rejected" tabIndex={0} className="space-y-4 focus:outline-none">
            {rejectedFiles.length || rejectedSoundtracks.length ? rejectedFiles.map(file => (
              <article key={file.id} className="grid gap-4 rounded-lg border border-red-200 bg-white p-4 shadow-sm dark:border-red-900 dark:bg-neutral-900 lg:grid-cols-[220px_minmax(0,1fr)]">
                <a href={resolveMediaUrl(file.storage_url || file.url)} target="_blank" rel="noopener noreferrer" className="block">
                  <FilePreview file={file} />
                </a>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-wider text-red-500">Item recusado</div>
                      <h3 className="mt-1 truncate text-lg font-black text-neutral-950 dark:text-white">{file.post?.title || 'Conteúdo sem título'}</h3>
                      <p className="mt-1 truncate text-sm font-semibold text-neutral-500 dark:text-neutral-300">{file.name || 'Arquivo'}</p>
                    </div>
                    <PortalStatusBadge status="rejected" />
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
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-600 transition hover:border-[var(--portal-brand-border)] hover:text-[var(--portal-brand-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
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
            )) : <EmptyPanel title="Nenhum item recusado" description="Itens recusados ficarão aqui caso você queira revisar e aprovar depois." />}
            {rejectedSoundtracks.map(post => (
              <SoundtrackReviewCard
                key={`soundtrack-${post.id}`}
                post={post}
                soundtrack={post.soundtrack}
                busy={busy}
                onApprove={() => handleApproveSoundtrack(post.id)}
                onAdjust={comment => handleAdjustSoundtrack(post.id, comment)}
              />
            ))}
          </section>
          )}

          {activeTab === 'history' && (
          <section id="portal-panel-history" role="tabpanel" aria-labelledby="portal-tab-history" tabIndex={0} className="space-y-4 focus:outline-none">
            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Todos'],
                ['approved', 'Aprovados'],
                ['rejected', 'Com ajustes'],
                ['executed', 'Postados na rede'],
              ].map(([value, label]) => (
                <button key={value} className={`rounded-full px-3 py-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] ${statusFilter === value ? 'bg-[var(--portal-brand-primary)] text-white' : 'bg-white text-neutral-500 hover:bg-[var(--portal-brand-soft-hover)] hover:text-[var(--portal-brand-foreground)] dark:bg-neutral-900 dark:text-neutral-300'}`} onClick={() => setStatusFilter(value)} type="button">
                  {label}
                </button>
              ))}
            </div>
            {filteredHistory.length ? filteredHistory.map(post => (
              <div key={post.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">{post.title || 'Conteúdo sem título'}</h3>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">{formatDate(getPostDate(post))}</p>
                  </div>
                  <PortalStatusBadge status={getPostStatus(post)} />
                </div>
                {post.description && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{post.description}</p>}
                {post.soundtrack ? (
                  <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                    <strong>Fundo sonoro:</strong> {post.soundtrack.trackName || post.soundtrack.track_name || (post.soundtrack.mode === 'embedded' ? 'incluido no video' : post.soundtrack.mode === 'uploaded' ? 'arquivo enviado' : 'referencia externa')} · {post.soundtrack.approvalStatus || post.soundtrack.approval_status}
                  </div>
                ) : null}
              </div>
            )) : <EmptyPanel title="Sem histórico" description="Conteúdos aprovados, recusados ou concluídos aparecerão aqui." />}
          </section>
          )}

          {activeTab === 'files' && (
          <section id="portal-panel-files" role="tabpanel" aria-labelledby="portal-tab-files" tabIndex={0} className="grid gap-4 focus:outline-none md:grid-cols-2 xl:grid-cols-3">
            {files.length ? files.map(file => (
              <article key={file.id} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-[var(--portal-brand-border)] dark:border-neutral-800 dark:bg-neutral-900">
                <FilePreview file={file} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{file.name || 'Arquivo'}</div>
                    <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-300/80">{file.post?.title || 'Conteúdo sem título'}</div>
                  </div>
                  <PortalStatusBadge status={file.status || getPostStatus(file.post)} />
                </div>
                <a href={resolveMediaUrl(file.storage_url || file.url)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-xs font-bold text-[var(--portal-brand-foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)]">
                  <ExternalLink size={13} /> Abrir arquivo original
                </a>
              </article>
            )) : <div className="md:col-span-2 xl:col-span-3"><EmptyPanel title="Sem arquivos" description="Arquivos anexados aos conteúdos aparecerão aqui." /></div>}
          </section>
          )}

          {activeTab === 'feedbacks' && (
          <section id="portal-panel-feedbacks" role="tabpanel" aria-labelledby="portal-tab-feedbacks" tabIndex={0} className="grid gap-4 focus:outline-none lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="font-extrabold">Enviar feedback geral</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">Use este campo para comentários sobre a rotina de conteúdo.</p>
              <textarea value={generalFeedback} onChange={event => setGeneralFeedback(event.target.value)} className="mt-4 h-32 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-[var(--portal-brand-border)] focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] dark:border-neutral-700 dark:bg-neutral-950" placeholder="Escreva seu comentario..." />
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--portal-brand-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--portal-brand-primary-hover)] active:bg-[var(--portal-brand-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] disabled:opacity-60" onClick={handleGeneralFeedback} disabled={busy} type="button">
                <Send size={15} /> Enviar feedback
              </button>
            </div>
            <div className="space-y-3">
              {feedbackItems.length ? feedbackItems.map(item => (
                <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-bold">{item.post_title || 'Feedback geral'}</div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-300/80">{formatDate(item.created_at)}</div>
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
              )) : <EmptyPanel title="Sem feedbacks" description="Comentários e motivos de ajuste aparecerão aqui." />}
            </div>
          </section>
          )}
          </div>
        </section>

        {editingFeedback ? (
          <PortalDialog
            labelledBy="portal-feedback-title"
            describedBy="portal-feedback-description"
            onClose={() => setEditingFeedback(null)}
            initialFocusRef={feedbackTextareaRef}
          >
              <h3 id="portal-feedback-title" className="text-lg font-black">Editar feedback</h3>
              <p id="portal-feedback-description" className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">Atualize as tags e o comentário do item recusado.</p>

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
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${active ? 'border-red-500 bg-red-500 text-white' : 'border-neutral-200 text-neutral-600 hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300'}`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              <textarea
                ref={feedbackTextareaRef}
                value={editingFeedback.comment}
                onChange={event => setEditingFeedback(current => ({ ...current, comment: event.target.value }))}
                aria-label="Comentário do feedback"
                className="mt-4 h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-[var(--portal-brand-border)] focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Descreva o que precisa ser ajustado..."
              />

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFeedback(null)}
                  className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] dark:border-neutral-700 dark:text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdateRejectedFeedback}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-[var(--portal-brand-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--portal-brand-primary-hover)] active:bg-[var(--portal-brand-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-neutral-900"
                >
                  Salvar feedback
                </button>
              </div>
          </PortalDialog>
        ) : null}
      </main>
    </div>
  )
}
