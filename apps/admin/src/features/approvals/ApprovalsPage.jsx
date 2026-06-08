import { useState, useEffect } from 'react'
import { CheckCircle, RotateCcw, AlertTriangle, Upload, MessageCircle, Copy, Check } from 'lucide-react'
import { fetchPosts, computePostStatus, replaceFile, resubmitPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { approveAllFiles, rejectAllFiles } from '../../services/approvals.service'
import { buildApprovalLink } from '../../utils/constants'
import { StatusBadge, FunnelBadge } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Input'
import toast from 'react-hot-toast'

function buildWALink(whatsapp, name, link) {
  let phone = (whatsapp || '').replace(/\D/g, '')
  if (!phone || phone.length < 10) return null
  if (phone.length <= 11) phone = '55' + phone
  const msg = encodeURIComponent(`Olá ${name}! ✅ Corrigimos os arquivos conforme seu feedback. Acesse o link abaixo para nova aprovação:\n\n${link}`)
  return `https://wa.me/${phone}?text=${msg}`
}

export default function ApprovalsPage() {
  const [posts, setPosts]     = useState([])
  const [clients, setClients] = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)
  const [resubmitModal, setResubmitModal] = useState({ open: false, post: null })
  const [justificativa, setJustificativa] = useState('')
  const [fileReplacements, setFileReplacements] = useState({})
  const [replacingFile, setReplacingFile] = useState(null)
  const [notifyModal,   setNotifyModal]   = useState({ open: false, post: null, link: '', client: null })
  const [notifyMsg,     setNotifyMsg]     = useState('')
  const [notifyCopied,  setNotifyCopied]  = useState(false)

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
    const post = resubmitModal.post
    const rejectedFiles = (post.files || []).filter(f => f.status === 'REJECTED')
    const missing = rejectedFiles.filter(f => !fileReplacements[f.id])
    if (missing.length > 0) {
      toast.error(`Substitua os ${missing.length} arquivo(s) rejeitado(s) antes de reenviar.`)
      return
    }
    try {
      setReplacingFile('submitting')
      for (const file of rejectedFiles) {
        const newFile = fileReplacements[file.id]
        if (newFile) {
          setReplacingFile(`replacing-${file.id}`)
          await replaceFile(file.id, newFile)
        }
      }
      await resubmitPost(post.id, { title: post.title, caption: post.caption, justificativa: justificativa.trim() || 'Arquivo(s) corrigido(s).' })
      setPosts(ps => ps.map(p => p.id === post.id
        ? { ...p, files: (p.files || []).map(f => f.status !== 'APPROVED' ? { ...f, status: 'PENDING', updated_badge: true } : f) }
        : p))
      // Busca cliente diretamente do banco para garantir whatsapp e tokens
      const { supabase } = await import('../../services/supabase')
      const { data: clientData } = await supabase
        .from('clients')
        .select('*, tokens:client_tokens(slug, revoked_at)')
        .eq('id', post.client_id)
        .single()

      const clientFull = clientData || clients.find(c => c.id === post.client_id) || {}
      const token  = (clientFull.tokens || []).find(t => !t.revoked_at) || (clientFull.tokens || [])[0]
      const link   = token ? buildApprovalLink(token.slug) : ''
      const defaultMsg = `Olá ${clientFull.name || 'cliente'}! ✅ Corrigimos os arquivos conforme seu feedback. Acesse o link abaixo para nova aprovação:\n\n${link}`
      setResubmitModal({ open: false, post: null })
      setJustificativa('')
      setFileReplacements({})
      setReplacingFile(null)
      setNotifyMsg(defaultMsg)
      setNotifyModal({ open: true, post, link, client: clientFull })
    } catch (e) {
      setReplacingFile(null)
      toast.error(e.message || 'Erro ao reenviar')
    }
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
        onClose={() => { setResubmitModal({ open: false, post: null }); setFileReplacements({}); setReplacingFile(null) }}
        title="↺ Corrigir e Reenviar"
        subtitle="Substitua os arquivos rejeitados e envie novamente."
      >
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Você deve substituir todos os arquivos rejeitados antes de reenviar.
          </div>

          {/* Rejected files with replacement upload + preview */}
          {resubmitModal.post && (resubmitModal.post.files || []).filter(f => f.status === 'REJECTED').map(file => {
            const ft = (file?.file_type || '').toUpperCase()
            const isImage = ft === 'IMAGE' || (!ft && file?.storage_url && !/\.(pdf|mp4|mov|mp3)$/i.test(file.name || ''))
            const previewUrl = fileReplacements[file.id]
              ? URL.createObjectURL(fileReplacements[file.id])
              : file.storage_url

            return (
              <div key={file.id} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
                {/* Preview */}
                <div className="relative h-36 bg-neutral-900">
                  {isImage && previewUrl
                    ? <img src={previewUrl} alt={file.name} className="w-full h-full object-contain" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">
                        {{ VIDEO:'🎬', PDF:'📄', AUDIO:'🎵' }[ft] || '📎'}
                      </div>
                  }
                  {fileReplacements[file.id] && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">✓ Novo</div>
                  )}
                </div>

                {/* Info + feedback */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 truncate mb-1">{file.name}</p>
                  {file.feedbacks && file.feedbacks.length > 0 && file.feedbacks.map((fb, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">
                      {fb.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {fb.tags.map(t => <span key={t} className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded text-xs">{t}</span>)}
                        </div>
                      )}
                      {fb.comment && <p className="italic">"{fb.comment}"</p>}
                    </div>
                  ))}

                  {/* Upload button */}
                  <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg cursor-pointer transition-colors border-2 border-dashed text-sm font-medium mt-2 ${
                    fileReplacements[file.id]
                      ? 'border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                      : 'border-red-300 dark:border-red-700 hover:bg-red-100/50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400'
                  }`}>
                    <Upload size={14} />
                    {fileReplacements[file.id] ? `✓ ${fileReplacements[file.id].name}` : 'Substituir arquivo'}
                    <input type="file" className="hidden" disabled={replacingFile !== null}
                      onChange={e => {
                        const newFile = e.target.files?.[0]
                        if (newFile) setFileReplacements(prev => ({ ...prev, [file.id]: newFile }))
                      }} />
                  </label>
                </div>
              </div>
            )
          })}

          {/* Justificativa — opcional */}
          <Textarea
            label="Justificativa da equipe (opcional)"
            value={justificativa}
            onChange={e => setJustificativa(e.target.value)}
            placeholder="Explique o que foi corrigido..."
            disabled={replacingFile !== null}
          />

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setResubmitModal({ open: false, post: null }); setFileReplacements({}); setReplacingFile(null) }}
              disabled={replacingFile !== null}
              className="flex-1 justify-center"
            >
              Cancelar
            </Button>
            <Button
              variant="teal"
              onClick={handleResubmit}
              disabled={replacingFile !== null}
              className="flex-1 justify-center"
            >
              {replacingFile ? '⏳ Enviando...' : '↺ Reenviar para cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Notify client modal */}
      <Modal open={notifyModal.open} onClose={() => setNotifyModal({ open: false, post: null, link: '' })}
        title="📲 Avisar o cliente"
        subtitle="Informe o cliente que os arquivos corrigidos estão prontos para aprovação.">
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-green-700 dark:text-green-400">
            ✓ Arquivos reenviados com sucesso! Agora avise o cliente.
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide block mb-2">Mensagem</label>
            <textarea
              value={notifyMsg}
              onChange={e => setNotifyMsg(e.target.value)}
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm bg-white dark:bg-neutral-800 h-28 resize-none outline-none focus:border-mag-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const whatsapp = notifyModal.client?.whatsapp || ''
                let phone = whatsapp.replace(/\D/g, '')
                if (!phone || phone.length < 10) {
                  toast.error('WhatsApp não cadastrado para este cliente. Cadastre o número na tela de Clientes.')
                  return
                }
                if (phone.length <= 11) phone = '55' + phone
                const msg = encodeURIComponent(notifyMsg)
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                setNotifyModal({ open: false, post: null, link: '' })
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3 rounded-xl text-sm transition-colors">
              <MessageCircle size={16}/> Enviar pelo WhatsApp
            </button>
            <Button variant="secondary" onClick={() => setNotifyModal({ open: false, post: null, link: '' })} className="flex-1 justify-center">
              Pular
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
