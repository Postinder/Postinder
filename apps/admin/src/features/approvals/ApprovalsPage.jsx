import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, RotateCcw, AlertTriangle, Eye } from 'lucide-react'
import { fetchPosts, computePostStatus, resubmitPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { approveAllFiles, rejectAllFiles } from '../../services/approvals.service'
import { StatusBadge } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'

function FilePreview({ file }) {
  const ft = (file?.file_type || '').toUpperCase()
  const icon = { VIDEO:'🎬', AUDIO:'🎵', PDF:'📄', DOC:'📝', SHEET:'📊', PPTX:'📋' }[ft] || '📎'

  if (ft === 'IMAGE' && file.storage_url) return (
    <img src={file.storage_url} alt={file.name} className="w-full h-full object-cover"
      onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
  )
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-neutral-100 dark:bg-neutral-800">
      <span className="text-2xl">{icon}</span>
      <span className="text-[9px] text-neutral-400 text-center px-1 line-clamp-2">{file.name}</span>
    </div>
  )
}

export default function ApprovalsPage() {
  const [searchParams] = useSearchParams()
  const [posts,    setPosts]   = useState([])
  const [clients,  setClients] = useState([])
  const [filter,   setFilter]  = useState(searchParams.get('client') || '')
  const [loading,  setLoading] = useState(true)
  const [resubmitModal, setResubmitModal] = useState({ open: false, post: null })
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const actionable = posts.filter(p => {
    const st = computePostStatus(p)
    return ['pending_approval', 'rejected'].includes(st) &&
      (!filter || p.client_id === filter || p.clientId === filter)
  })

  async function handleApproveAll(postId) {
    await approveAllFiles(postId)
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, status: 'approved', files: (p.files||[]).map(f => ({ ...f, status: 'approved' })) }
      : p))
    toast.success('Post aprovado!')
  }

  async function handleRejectAll(postId) {
    await rejectAllFiles(postId)
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, status: 'rejected', files: (p.files||[]).map(f => f.status !== 'approved' ? { ...f, status: 'rejected' } : f) }
      : p))
    toast('Post reprovado.')
  }

  async function handleResubmit() {
    if (!justificativa.trim() || justificativa.trim().length < 10) {
      toast.error('Justificativa deve ter ao menos 10 caracteres.')
      return
    }
    const post = resubmitModal.post
    try {
      await resubmitPost(post.id, { title: post.title, justificativa })
      setPosts(ps => ps.map(p => p.id === post.id
        ? { ...p, status: 'pending_approval', files: (p.files||[]).map(f => f.status !== 'approved' ? { ...f, status: 'pending' } : f) }
        : p))
      setResubmitModal({ open: false, post: null })
      setJustificativa('')
      toast.success('Reenviado para aprovação!')
    } catch (e) { toast.error(e.message) }
  }

  function renderPostCard(p) {
    const st = computePostStatus(p)
    const isRej = st === 'rejected'
    const client = clients.find(c => c.id === (p.client_id || p.clientId)) || {}
    const files = p.files || []
    const rejectedFiles = files.filter(f => f.status === 'rejected')
    const pendingFiles  = files.filter(f => f.status === 'pending')

    return (
      <Card key={p.id} className="mb-4">
        <div className="flex gap-0 overflow-hidden rounded-xl">
          {/* Files strip */}
          {files.length > 0 && (
            <div className={`flex-shrink-0 grid ${files.length === 1 ? 'w-32' : 'w-48'} gap-0.5`}
              style={{ gridTemplateColumns: files.length > 1 ? '1fr 1fr' : '1fr', maxHeight: 160 }}>
              {files.slice(0, 4).map((f, i) => (
                <div key={i} className="aspect-square relative overflow-hidden" style={{ maxHeight: files.length === 1 ? 160 : 78 }}>
                  <FilePreview file={f} />
                  {f.status === 'rejected' && (
                    <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                      <span className="text-white text-lg">✗</span>
                    </div>
                  )}
                  {f.status === 'approved' && (
                    <div className="absolute top-1 right-1">
                      <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <StatusBadge status={st} />
                  <span className="text-xs text-neutral-400">{client.name}</span>
                </div>
                <h3 className="font-bold text-sm line-clamp-1">{p.title || '(sem título)'}</h3>
                <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{p.description}</p>
              </div>
            </div>

            <div className="text-xs text-neutral-400 mb-3">
              {files.length} arquivo{files.length !== 1 ? 's' : ''} ·{' '}
              {pendingFiles.length > 0 && <span className="text-amber-500">{pendingFiles.length} pendente{pendingFiles.length !== 1 ? 's' : ''}</span>}
              {rejectedFiles.length > 0 && <span className="text-red-500 ml-1">{rejectedFiles.length} reprovado{rejectedFiles.length !== 1 ? 's' : ''}</span>}
            </div>

            {/* Rejection feedback */}
            {rejectedFiles.length > 0 && (
              <div className="mb-3 space-y-1">
                {rejectedFiles.slice(0, 2).map(f => (
                  <div key={f.id} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AlertTriangle size={10} className="text-red-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 line-clamp-1">{f.name}</span>
                    </div>
                    {f.rejection_reason && <p className="text-xs text-red-500 italic">"{f.rejection_reason}"</p>}
                    {f.rejection_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.rejection_tags.map(t => <span key={t} className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {isRej ? (
              <Button variant="teal" size="sm" icon={<RotateCcw size={12}/>}
                onClick={() => { setResubmitModal({ open: true, post: p }); setJustificativa('') }}>
                Corrigir e Reenviar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={() => handleRejectAll(p.id)}>Reprovar</Button>
                <Button variant="teal"   size="sm" onClick={() => handleApproveAll(p.id)}>Aprovar tudo</Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle size={20} className="text-mag-500" />
        <h1 className="text-xl font-bold">Aprovações</h1>
      </div>

      <div className="flex items-center gap-2 text-sm bg-white dark:bg-neutral-900 border border-mag-500 rounded-lg px-3 py-2 mb-4 shadow-[inset_0_0_0_1px_rgba(167,1,75,0.45)]">
        <span className="w-2 h-2 rounded-full bg-mag-500 flex-shrink-0" />
        <span className="text-neutral-600 dark:text-neutral-300">
          Você está visualizando como <strong className="text-neutral-900 dark:text-white mx-1">administrador</strong> — pode aprovar ou reprovar manualmente.
        </span>
      </div>

      <div className="mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none">
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <Skeleton className="w-32 h-32 rounded-lg flex-shrink-0" />
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
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-lg font-bold mb-2">Tudo em dia!</h3>
          <p className="text-neutral-400 text-sm">Nenhuma postagem aguardando ação{filter ? ' para este cliente' : ''}.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-neutral-400 mb-4">{actionable.length} post{actionable.length !== 1 ? 's' : ''} aguardando ação</p>
          {actionable.map(p => renderPostCard(p))}
        </>
      )}

      <Modal open={resubmitModal.open} onClose={() => setResubmitModal({ open: false, post: null })}
        title="↺ Corrigir e Reenviar"
        subtitle="Explique o que foi corrigido antes de reenviar ao cliente.">
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Arquivos não aprovados voltarão para revisão do cliente.
          </div>
          <Textarea label="O que foi corrigido? *" value={justificativa} onChange={e => setJustificativa(e.target.value)}
            placeholder="Ex: Corrigimos as cores conforme feedback e ajustamos o texto..." />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setResubmitModal({ open: false, post: null })} className="flex-1 justify-center">Cancelar</Button>
            <Button variant="teal" onClick={handleResubmit} className="flex-1 justify-center">↺ Reenviar para cliente</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
