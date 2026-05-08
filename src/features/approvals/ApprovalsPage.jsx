import { useState, useEffect } from 'react'
import { CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react'
import { fetchPosts, computePostStatus, resubmitPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { approveAllFiles, rejectAllFiles } from '../../services/approvals.service'
import { StatusBadge, FunnelBadge } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Input'
import toast from 'react-hot-toast'

export default function ApprovalsPage() {
  const [posts, setPosts]     = useState([])
  const [clients, setClients] = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)
  const [resubmitModal, setResubmitModal] = useState({ open: false, post: null })
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const actionable = posts.filter(p => {
    const st = computePostStatus(p.files || [])
    return ['pending', 'rejected', 'updated'].includes(st) && (!filter || p.client_id === filter)
  })

  async function handleApproveAll(postId) {
    await approveAllFiles(postId)
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, files: (p.files || []).map(f => ({ ...f, status: 'APPROVED' })) } : p))
    toast.success('Post aprovado!')
  }

  async function handleRejectAll(postId) {
    await rejectAllFiles(postId)
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, files: (p.files || []).map(f => f.status !== 'APPROVED' ? { ...f, status: 'REJECTED' } : f) } : p))
    toast('Post reprovado.')
  }

  async function handleResubmit() {
    if (!justificativa.trim() || justificativa.trim().length < 10) {
      toast.error('Justificativa deve ter ao menos 10 caracteres.')
      return
    }
    const post = resubmitModal.post
    try {
      await resubmitPost(post.id, { title: post.title, caption: post.caption, justificativa })
      setPosts(ps => ps.map(p => p.id === post.id
        ? { ...p, files: (p.files || []).map(f => f.status !== 'APPROVED' ? { ...f, status: 'PENDING' } : f) }
        : p))
      setResubmitModal({ open: false, post: null })
      setJustificativa('')
      toast.success('Reenviado para aprovação!')
    } catch (e) { toast.error(e.message) }
  }

  function renderPostCard(p) {
    const st = computePostStatus(p.files || [])
    const isRej = st === 'rejected'
    const client = clients.find(c => c.id === p.client_id) || {}
    const files = p.files || []
    const rejectedFiles = files.filter(f => f.status === 'REJECTED')

    return (
      <Card key={p.id} className="overflow-hidden mb-4 max-w-lg">
        {/* Media preview */}
        <div className="h-48 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-4xl relative">
          {p.email_link
            ? '📧'
            : files[0]?.storage_url
              ? <img src={files[0].storage_url} alt="" className="h-full w-full object-contain" />
              : '🖼️'
          }
          {files.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              {files.length} arquivos
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={st} />
            <FunnelBadge tag={p.funnel_tag} />
            <span className="text-xs text-neutral-400">{client.name}</span>
            {p.resubmit_count > 0 && (
              <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-600 px-2 py-0.5 rounded-full">
                Reenvio #{p.resubmit_count}
              </span>
            )}
          </div>

          <h3 className="font-bold mb-1">{p.title}</h3>
          <p className="text-sm text-neutral-500 mb-3">{p.caption}</p>

          {/* Channels */}
          <div className="flex flex-wrap gap-1 mb-3">
            {(p.channels || []).map(ch => (
              <span key={ch} className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{ch}</span>
            ))}
          </div>

          {/* Rejected files with feedback */}
          {rejectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {rejectedFiles.map(f => (
                <div key={f.id} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">{f.name}</span>
                  </div>
                  {(f.feedbacks || []).map((fb, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400">
                      {fb.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {fb.tags.map(t => <span key={t} className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded">{t}</span>)}
                        </div>
                      )}
                      {fb.comment && <p className="italic">"{fb.comment}"</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {isRej ? (
            <div className="flex gap-2">
              <Button variant="teal" className="flex-1 justify-center" icon={<RotateCcw size={14}/>}
                onClick={() => { setResubmitModal({ open: true, post: p }); setJustificativa('') }}>
                Corrigir e Reenviar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="danger" size="sm" className="flex-1 justify-center" onClick={() => handleRejectAll(p.id)}>Reprovar tudo</Button>
              <Button variant="teal"   size="sm" className="flex-1 justify-center" onClick={() => handleApproveAll(p.id)}>Aprovar tudo</Button>
            </div>
          )}
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

      <div className="flex items-center gap-2 text-sm bg-mag-50 dark:bg-mag-950/30 border border-mag-200 dark:border-mag-800 rounded-lg px-3 py-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-mag-500 flex-shrink-0" />
        Visualizando como <strong className="text-neutral-900 dark:text-white mx-1">administrador</strong>
      </div>

      <div className="mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none">
          <option value="">Todos os clientes (pendentes)</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : actionable.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-lg font-bold mb-2">Tudo em dia!</h3>
          <p className="text-neutral-400 text-sm">Nenhuma postagem aguardando ação.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-neutral-400 mb-4">{actionable.length} post(s) aguardando ação</p>
          {actionable.map(p => renderPostCard(p))}
        </>
      )}

      {/* Resubmit modal */}
      <Modal
        open={resubmitModal.open}
        onClose={() => setResubmitModal({ open: false, post: null })}
        title="↺ Corrigir e Reenviar"
        subtitle="Explique o que foi corrigido antes de reenviar ao cliente."
      >
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Arquivos não aprovados voltarão para revisão. Arquivos já aprovados serão mantidos.
          </div>
          <Textarea
            label="Justificativa da equipe *"
            value={justificativa}
            onChange={e => setJustificativa(e.target.value)}
            placeholder="Ex: Corrigimos as cores conforme feedback e ajustamos o texto..."
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setResubmitModal({ open: false, post: null })} className="flex-1 justify-center">Cancelar</Button>
            <Button variant="teal" onClick={handleResubmit} className="flex-1 justify-center">↺ Reenviar para cliente</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
