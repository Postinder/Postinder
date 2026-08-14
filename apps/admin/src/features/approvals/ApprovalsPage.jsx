import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, RotateCcw, AlertTriangle, UploadCloud, FileCheck2, Eye, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPosts, computePostStatus, resubmitPost, replacePostFile } from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import { StatusBadge } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Textarea, Select } from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import PageHeader from '../../components/ui/PageHeader'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { validateUploadFile } from '../../utils/uploadValidation'
import MediaPreview, { getMediaKind } from '../../components/media/MediaPreview'
import {
  getPostEditingAction,
  getPostMutationErrorMessage,
  getRawPostStatus,
  isPostReopenRequiredError,
  POST_REOPEN_REQUIRED_MESSAGE,
} from '../posts/postBulkSelection'
import toast from 'react-hot-toast'

const FILE_LABELS = {
  IMAGE: 'Imagem',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  PDF: 'PDF',
  DOC: 'Doc',
  SHEET: 'Planilha',
  PPTX: 'Slides',
}

function getClientId(post) {
  return post.client_id || post.clientId
}

function getFileUrl(file) {
  return resolveMediaUrl(file?.storage_url || file?.url)
}

function getFileStatus(file) {
  const status = String(file?.status || 'pending').toLowerCase()
  if (status === 'sent' || status === 'pending_approval') return 'pending'
  return status
}

function isPendingFile(file) {
  return getFileStatus(file) === 'pending'
}

function isRejectedFile(file) {
  return getFileStatus(file) === 'rejected'
}

function isReviewPost(post) {
  return ['sent', 'pending_approval', 'rejected'].includes(getRawPostStatus(post))
}

function FilePreview({ file }) {
  const ft = (file?.file_type || '').toUpperCase()
  const label = FILE_LABELS[ft] || 'Arquivo'
  const url = getFileUrl(file)

  if (['IMAGE', 'VIDEO'].includes(ft) && url) {
    return <MediaPreview file={file} src={url} className="h-full w-full" mediaClassName="h-full w-full object-cover" controls={false} compact />
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
      <span className="text-[11px] font-bold">{label}</span>
      <span className="line-clamp-2 px-2 text-center text-[10px] text-neutral-400">{file.name}</span>
    </div>
  )
}

function FileStatusPill({ status }) {
  const normalizedStatus = getFileStatus({ status })
  const styles = {
    approved: 'bg-green-500 text-white',
    rejected: 'bg-red-500 text-white',
    pending: 'bg-amber-400 text-white',
  }
  const labels = {
    approved: 'Aprovado',
    rejected: 'Recusado',
    pending: 'Pendente',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[normalizedStatus] || 'bg-neutral-300 text-neutral-700'}`}>
      {labels[normalizedStatus] || status}
    </span>
  )
}

export default function ApprovalsPage() {
  const [searchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [clients, setClients] = useState([])
  const [filter, setFilter] = useState(searchParams.get('client') || '')
  const [loading, setLoading] = useState(true)
  const [resubmitModal, setResubmitModal] = useState({ open: false, post: null })
  const [fileViewer, setFileViewer] = useState({ open: false, file: null, post: null })
  const [justificativa, setJustificativa] = useState('')
  const [replacementFiles, setReplacementFiles] = useState({})
  const [resubmitting, setResubmitting] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([fetchPosts({ limit: 200 }), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const actionable = posts.filter(post => {
    return isReviewPost(post) &&
      (!filter || getClientId(post) === filter)
  })

  async function sendApprovalNotification(clientId) {
    try {
      await notifyClient(clientId)
      toast.success('Mensagem via WhatsApp foi enviada.')
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Não foi possível enviar o WhatsApp.')
    }
  }

  function openResubmitModal(post) {
    setResubmitModal({ open: true, post })
    setJustificativa('')
    setReplacementFiles({})
  }

  function closeResubmitModal() {
    setResubmitModal({ open: false, post: null })
    setJustificativa('')
    setReplacementFiles({})
  }

  async function handleResubmit() {
    const post = resubmitModal.post
    const rejectedFiles = (post?.files || []).filter(isRejectedFile)

    if (getPostEditingAction(post) !== 'resubmit') {
      toast.error(getPostEditingAction(post) === 'reopen'
        ? POST_REOPEN_REQUIRED_MESSAGE
        : 'Esta postagem não está mais disponível para correção.')
      closeResubmitModal()
      load()
      return
    }

    if (!rejectedFiles.length) {
      toast.error('Nenhum arquivo reprovado para corrigir.')
      return
    }
    if (rejectedFiles.some(file => !replacementFiles[file.id])) {
      toast.error('Anexe um novo arquivo para cada item reprovado.')
      return
    }
    if (!justificativa.trim() || justificativa.trim().length < 10) {
      toast.error('Justificativa deve ter ao menos 10 caracteres.')
      return
    }

    setResubmitting(true)
    try {
      await Promise.all(rejectedFiles.map(file => replacePostFile(post.id, file.id, replacementFiles[file.id])))
      await resubmitPost(post.id, { title: post.title, justificativa })

      setPosts(current => current.map(item => item.id === post.id
        ? {
            ...item,
            status: 'pending_approval',
            files: (item.files || []).map(file => isRejectedFile(file)
              ? {
                  ...file,
                  status: 'pending',
                  name: replacementFiles[file.id]?.name || file.name,
                  rejection_reason: null,
                  rejection_tags: [],
                }
              : file),
          }
        : item))

      closeResubmitModal()
      toast.success('Arquivos corrigidos e reenviados para aprovação!')
      await sendApprovalNotification(getClientId(post))
    } catch (e) {
      toast.error(getPostMutationErrorMessage(e))
      if (isPostReopenRequiredError(e)) {
        closeResubmitModal()
        load()
      }
    } finally {
      setResubmitting(false)
    }
  }

  function renderPostCard(post) {
    const status = computePostStatus(post)
    const client = clients.find(item => item.id === getClientId(post)) || {}
    const files = post.files || []
    const rejectedFiles = files.filter(isRejectedFile)
    const pendingFiles = files.filter(isPendingFile)
    const isRejected = getPostEditingAction(post) === 'resubmit'

    return (
      <Card key={post.id} className="mb-4 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
          <div className="border-b border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 gap-2">
              {files.slice(0, 4).map(file => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setFileViewer({ open: true, file, post, index: files.findIndex(item => item.id === file.id) })}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition-all hover:border-mag-500 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                  title="Ver arquivo e feedback"
                >
                  <FilePreview file={file} />
                  <div className="absolute left-1.5 top-1.5">
                    <FileStatusPill status={file.status} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-800">
                      <Eye size={12} /> Ver
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {files.length > 4 && <div className="mt-2 text-xs font-medium text-neutral-400">+{files.length - 4} arquivo(s)</div>}
          </div>

          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs font-medium text-neutral-400">{client.name || 'Cliente nao informado'}</span>
                </div>
                <h3 className="line-clamp-1 text-base font-bold text-neutral-900 dark:text-white">{post.title || '(sem título)'}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{post.description || 'Sem descrição cadastrada.'}</p>
              </div>
              <div className="rounded-xl bg-neutral-100 px-3 py-2 text-right text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                <div className="font-bold text-neutral-900 dark:text-white">{files.length}</div>
                arquivo{files.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              {pendingFiles.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">{pendingFiles.length} pendente(s)</span>}
              {rejectedFiles.length > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">{rejectedFiles.length} reprovado(s)</span>}
            </div>

            {rejectedFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {rejectedFiles.map(file => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setFileViewer({ open: true, file, post, index: files.findIndex(item => item.id === file.id) })}
                    className="block w-full rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-left transition-colors hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <AlertTriangle size={13} className="shrink-0 text-red-500" />
                        <span className="line-clamp-1 text-xs font-bold text-red-700 dark:text-red-300">{file.name}</span>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-red-500">
                        <Eye size={12} /> Ver motivo
                      </span>
                    </div>
                    {file.rejection_reason && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{file.rejection_reason}</p>}
                    {file.rejection_tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {file.rejection_tags.map(tag => (
                          <span key={tag} className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {isRejected ? (
              <Button variant="teal" size="sm" icon={<RotateCcw size={12} />} onClick={() => openResubmitModal(post)}>
                Corrigir arquivos
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => sendApprovalNotification(getClientId(post))}>
                Reenviar aviso ao cliente
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  const modalPost = resubmitModal.post
  const modalRejectedFiles = (modalPost?.files || []).filter(isRejectedFile)
  const viewerFiles = fileViewer.post?.files || []
  const viewerIndexFromFile = viewerFiles.findIndex(file => file.id === fileViewer.file?.id)
  const viewerIndex = viewerIndexFromFile >= 0 ? viewerIndexFromFile : Math.max(0, fileViewer.index || 0)
  const viewerCount = viewerFiles.length
  const viewerStatus = getFileStatus(fileViewer.file)

  function moveFileViewer(delta) {
    if (!viewerCount) return
    const nextIndex = (viewerIndex + delta + viewerCount) % viewerCount
    setFileViewer({
      open: true,
      post: fileViewer.post,
      file: viewerFiles[nextIndex],
      index: nextIndex,
    })
  }

  return (
    <div>
      <PageHeader
        icon={CheckCircle}
        title="Acompanhamento de aprovações"
        subtitle="A empresa acompanha o status e corrige reprovações, mas a aprovação final é sempre do cliente."
        actions={
          <div className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {actionable.length} em acompanhamento
          </div>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-mag-500" />
            Você está visualizando como <strong className="text-neutral-900 dark:text-white">administrador</strong>
          </div>
          <div className="w-full sm:w-80">
            <Select value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="">Todos os clientes</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <Skeleton className="h-32 w-40 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-3 py-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-40" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : actionable.length === 0 ? (
        <Card className="p-12 text-center">
          <FileCheck2 size={38} className="mx-auto mb-3 text-green-500" />
          <h3 className="mb-2 text-lg font-bold">Tudo em dia</h3>
          <p className="text-sm text-neutral-400">Nenhuma postagem em acompanhamento{filter ? ' para este cliente' : ''}.</p>
        </Card>
      ) : (
        <div>
          <p className="mb-4 text-sm text-neutral-400">{actionable.length} post{actionable.length !== 1 ? 's' : ''} em acompanhamento</p>
          {actionable.map(post => renderPostCard(post))}
        </div>
      )}

      <Modal
        open={resubmitModal.open}
        onClose={closeResubmitModal}
        title="Corrigir arquivos reprovados"
        subtitle="Substitua cada arquivo reprovado por uma nova versão antes de reenviar ao cliente."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Cada item reprovado precisa de um novo arquivo. Os arquivos aprovados permanecem como estao.
          </div>

          <div className="space-y-3">
            {modalRejectedFiles.map(file => (
              <div key={file.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="mb-3 flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setFileViewer({ open: true, file, post: modalPost, index: (modalPost?.files || []).findIndex(item => item.id === file.id) })}
                      className="group relative h-full w-full"
                      title="Ver arquivo reprovado"
                    >
                      <FilePreview file={file} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                        <Eye size={15} className="text-white" />
                      </div>
                    </button>
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
            ))}
          </div>

          <Textarea
            label="O que foi corrigido? *"
            value={justificativa}
            onChange={event => setJustificativa(event.target.value)}
            placeholder="Ex: Substitui os arquivos com o texto corrigido e ajustei o visual conforme o feedback."
          />

          <div className="flex gap-3">
            <Button variant="secondary" onClick={closeResubmitModal} className="flex-1 justify-center">Cancelar</Button>
            <Button variant="teal" loading={resubmitting} onClick={handleResubmit} className="flex-1 justify-center">
              Reenviar para cliente
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={fileViewer.open}
        onClose={() => setFileViewer({ open: false, file: null, post: null, index: 0 })}
        title={viewerStatus === 'rejected' ? 'Arquivo recusado' : 'Arquivo da postagem'}
        subtitle={viewerCount > 1 ? 'Navegue pelos arquivos desta postagem e confira o status individual.' : 'Confira o arquivo e as informacoes da postagem.'}
        size="xl"
      >
        {fileViewer.file && (
          <>
            {viewerCount > 1 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                <Button variant="secondary" size="sm" icon={<ChevronLeft size={15} />} onClick={() => moveFileViewer(-1)}>
                  Anterior
                </Button>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-300">
                  Arquivo {viewerIndex + 1} de {viewerCount}
                </span>
                <Button variant="secondary" size="sm" icon={<ChevronRight size={15} />} onClick={() => moveFileViewer(1)}>
                  Proximo
                </Button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
                {getMediaKind(fileViewer.file) === 'video' && getFileUrl(fileViewer.file) ? (
                  <MediaPreview file={fileViewer.file} src={getFileUrl(fileViewer.file)} className="h-[60vh] w-full" mediaClassName="h-full w-full object-contain" />
                ) : (fileViewer.file.file_type || '').toUpperCase() === 'IMAGE' && getFileUrl(fileViewer.file) ? (
                  <img src={getFileUrl(fileViewer.file)} alt={fileViewer.file.name} className="max-h-[60vh] w-full object-contain" />
                ) : getFileUrl(fileViewer.file) ? (
                  <iframe title={fileViewer.file.name} src={getFileUrl(fileViewer.file)} className="h-[60vh] w-full bg-white" />
                ) : (
                  <div className="flex h-80 items-center justify-center text-sm text-neutral-400">Arquivo indisponivel para visualizacao.</div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <FileStatusPill status={fileViewer.file.status} />
                    <span className="text-xs font-medium text-neutral-400">{FILE_LABELS[(fileViewer.file.file_type || '').toUpperCase()] || 'Arquivo'}</span>
                    {viewerCount > 1 && <span className="text-xs font-semibold text-neutral-400">{viewerIndex + 1}/{viewerCount}</span>}
                  </div>
                  <h3 className="break-words text-sm font-bold text-neutral-900 dark:text-white">{fileViewer.file.name}</h3>
                  <p className="mt-1 text-xs text-neutral-400">{fileViewer.post?.title || 'Post sem titulo'}</p>
                </div>

                {viewerStatus === 'rejected' || fileViewer.file.rejection_reason || fileViewer.file.rejection_tags?.length > 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
                      <AlertTriangle size={15} />
                      Motivo da recusa
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {fileViewer.file.rejection_reason || 'O cliente nao informou um comentario detalhado.'}
                    </p>
                    {fileViewer.file.rejection_tags?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {fileViewer.file.rejection_tags.map(tag => (
                          <span key={tag} className="rounded bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-200">
                      <FileCheck2 size={15} />
                      Status do arquivo
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Este arquivo esta {viewerStatus === 'approved' ? 'aprovado pelo cliente' : 'aguardando avaliacao do cliente'}.
                    </p>
                  </div>
                )}

                {getFileUrl(fileViewer.file) && (
                  <a
                    href={getFileUrl(fileViewer.file)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <ExternalLink size={15} />
                    Abrir em nova aba
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
