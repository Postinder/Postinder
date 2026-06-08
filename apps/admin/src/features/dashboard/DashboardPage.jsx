import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Trash2, Edit3, RotateCcw, Upload, MessageCircle, Copy, Check, Search } from 'lucide-react'
import { fetchPosts, softDeletePost, computePostStatus, updatePost, replaceFile, resubmitPost } from '../../services/posts.service'
import { buildApprovalLink } from '../../utils/constants'
import { fetchClients } from '../../services/clients.service'
import { StatusBadge, FunnelBadge, Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// ── Shared ResubmitModal ──
export function ResubmitModal({ post, open, onClose, onSave }) {
  const [justificativa,    setJustificativa]    = useState('')
  const [fileReplacements, setFileReplacements] = useState({})
  const [submitting,       setSubmitting]        = useState(false)
  const [notifyOpen,       setNotifyOpen]        = useState(false)
  const [notifyMsg,        setNotifyMsg]         = useState('')
  const [notifyCopied,     setNotifyCopied]      = useState(false)

  useEffect(() => { if (open) { setJustificativa(''); setFileReplacements({}) } }, [open, post])

  if (!post || !open) return null

  if (notifyOpen) return (
    <Modal open={true} onClose={() => { setNotifyOpen(false); onClose() }}
      title="📲 Avisar o cliente"
      subtitle="Informe o cliente que os arquivos corrigidos estão prontos.">
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-green-700 dark:text-green-400">
          ✓ Arquivos reenviados! Agora avise o cliente.
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide block mb-2">Mensagem</label>
          <textarea value={notifyMsg} onChange={e=>setNotifyMsg(e.target.value)}
            className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm bg-white dark:bg-neutral-800 h-28 resize-none outline-none focus:border-mag-500" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => {
            let phone = (post?.client?.whatsapp || '').replace(/\D/g,'')
            if (!phone || phone.length < 10) { toast.error('WhatsApp não cadastrado. Cadastre na tela de Clientes.'); return }
            if (phone.length <= 11) phone = '55' + phone
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(notifyMsg)}`, '_blank')
            setNotifyOpen(false); onClose()
          }} className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3 rounded-xl text-sm">
            <MessageCircle size={16}/> Enviar WhatsApp
          </button>
          <button onClick={() => { setNotifyOpen(false); onClose() }}
            className="flex-1 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm py-3 text-neutral-500 hover:bg-neutral-50">
            Pular
          </button>
        </div>
      </div>
    </Modal>
  )

  const rejectedFiles = (post.files || []).filter(f => f.status === 'REJECTED')

  async function handleSubmit() {
    const missing = rejectedFiles.filter(f => !fileReplacements[f.id])
    if (missing.length > 0) { toast.error(`Substitua ${missing.length} arquivo(s).`); return }
    try {
      setSubmitting(true)
      for (const file of rejectedFiles) {
        if (fileReplacements[file.id]) await replaceFile(file.id, fileReplacements[file.id])
      }
      await resubmitPost(post.id, { title: post.title, caption: post.caption, justificativa: justificativa.trim() || 'Arquivo(s) corrigido(s).' })

      // Busca cliente direto do banco para garantir whatsapp e tokens
      const { supabase } = await import('../../services/supabase')
      const { data: clientData } = await supabase
        .from('clients')
        .select('*, tokens:client_tokens(slug, revoked_at)')
        .eq('id', post.client_id)
        .single()

      const client = clientData || post?.client || {}
      const token  = (client.tokens || []).find(t => !t.revoked_at) || (client.tokens || [])[0]
      const link   = token ? buildApprovalLink(token.slug) : ''
      const defaultMsg = `Olá ${client.name || 'cliente'}! ✅ Corrigimos os arquivos conforme seu feedback. Acesse o link abaixo para nova aprovação:\n\n${link}`
      // Atualiza post.client com dados completos para o modal usar
      post.client = client
      setNotifyMsg(defaultMsg)
      setNotifyOpen(true)
      onSave()
    } catch(e) { toast.error(e.message || 'Erro ao reenviar') }
    finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="↺ Corrigir e Reenviar" subtitle="Substitua os arquivos rejeitados e reenvie ao cliente.">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
          ⚠️ Substitua todos os arquivos rejeitados antes de reenviar.
        </div>
        {rejectedFiles.map(file => {
          const ft = (file?.file_type||'').toUpperCase()
          const isImage = !['VIDEO','PDF','AUDIO'].includes(ft) && file?.storage_url
          const previewUrl = fileReplacements[file.id] ? URL.createObjectURL(fileReplacements[file.id]) : file.storage_url
          return (
            <div key={file.id} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
              <div className="relative h-36 bg-neutral-900">
                {isImage && previewUrl ? <img src={previewUrl} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-4xl">{{'VIDEO':'🎬','PDF':'📄','AUDIO':'🎵'}[ft]||'📎'}</div>}
                {fileReplacements[file.id] && <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">✓ Novo</div>}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 truncate mb-1">{file.name}</p>
                {(file.feedbacks||[]).map((fb,i)=>(
                  <div key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">
                    {fb.tags?.length>0&&<div className="flex flex-wrap gap-1 mb-1">{fb.tags.map(t=><span key={t} className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">{t}</span>)}</div>}
                    {fb.comment&&<p className="italic">"{fb.comment}"</p>}
                  </div>
                ))}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg cursor-pointer border-2 border-dashed text-sm font-medium mt-1 ${fileReplacements[file.id]?'border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700':'border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'}`}>
                  <Upload size={14}/>{fileReplacements[file.id]?`✓ ${fileReplacements[file.id].name}`:'Substituir arquivo'}
                  <input type="file" className="hidden" disabled={submitting} onChange={e=>{const f=e.target.files?.[0];if(f)setFileReplacements(prev=>({...prev,[file.id]:f}))}} />
                </label>
              </div>
            </div>
          )
        })}
        <Textarea label="Justificativa (opcional)" value={justificativa} onChange={e=>setJustificativa(e.target.value)} placeholder="Explique o que foi corrigido..." disabled={submitting} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="flex-1 justify-center">Cancelar</Button>
          <Button variant="teal" onClick={handleSubmit} disabled={submitting} className="flex-1 justify-center">
            {submitting?'⏳ Enviando...':'↺ Reenviar para cliente'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit Modal ──
function EditPostModal({ post, open, onClose, onSave }) {
  const [title,   setTitle]   = useState('')
  const [caption, setCaption] = useState('')
  const [saving,  setSaving]  = useState(false)
  useEffect(() => { if (post) { setTitle(post.title||''); setCaption(post.caption||'') } }, [post])
  async function handleSave() {
    setSaving(true)
    try { await updatePost(post.id,{title,caption}); toast.success('Atualizado!'); onSave(); onClose() }
    catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }
  if (!post) return null
  return (
    <Modal open={open} onClose={onClose} title="Editar Postagem">
      <div className="space-y-4">
        <Input label="Título" value={title} onChange={e=>setTitle(e.target.value)} />
        <Textarea label="Legenda" value={caption} onChange={e=>setCaption(e.target.value)} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">Salvar</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DashboardPage() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const [posts,         setPosts]        = useState([])
  const [clients,       setClients]      = useState([])
  const [loading,       setLoading]      = useState(true)
  const [search,        setSearch]       = useState(searchParams.get('q') || '')
  const [clientFilter,  setClientFilter] = useState(searchParams.get('client') || '')
  const [statusFilter,  setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [editPost,      setEditPost]     = useState(null)
  const [resubmitPost,  setResubmitPost] = useState(null)

  const load = useCallback(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p,c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Excluir esta postagem?')) return
    await softDeletePost(id)
    setPosts(p => p.filter(x => x.id !== id))
    toast.success('Postagem excluída.')
  }

  const filtered = posts.filter(p => {
    const st = computePostStatus(p.files||[], p.status)
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || clients.find(c=>c.id===p.client_id)?.name?.toLowerCase().includes(search.toLowerCase())
    const matchClient = !clientFilter || p.client_id === clientFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'pending' && ['pending','updated'].includes(st)) || st === statusFilter
    return matchSearch && matchClient && matchStatus
  })

  const counts = {
    total:    posts.filter(p => !clientFilter || p.client_id === clientFilter).length,
    pending:  posts.filter(p => (!clientFilter || p.client_id === clientFilter) && ['pending','updated'].includes(computePostStatus(p.files||[], p.status))).length,
    approved: posts.filter(p => (!clientFilter || p.client_id === clientFilter) && computePostStatus(p.files||[], p.status) === 'approved').length,
    rejected: posts.filter(p => (!clientFilter || p.client_id === clientFilter) && computePostStatus(p.files||[], p.status) === 'rejected').length,
  }

  const METRIC_CARDS = [
    { key:'all',      label:'Total',      value: counts.total,    color:'text-neutral-900 dark:text-white',  bg:'hover:bg-neutral-50 dark:hover:bg-neutral-800/50' },
    { key:'pending',  label:'Aguardando', value: counts.pending,  color:'text-amber-600',                    bg:'hover:bg-amber-50 dark:hover:bg-amber-950/20' },
    { key:'approved', label:'Aprovados',  value: counts.approved, color:'text-green-600',                    bg:'hover:bg-green-50 dark:hover:bg-green-950/20' },
    { key:'rejected', label:'Recusados',  value: counts.rejected, color:'text-red-600',                      bg:'hover:bg-red-50 dark:hover:bg-red-950/20' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-mag-500" />
          <h1 className="text-xl font-bold">Dashboard</h1>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/posts/new')}>+ Nova Postagem</Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { key:'all',      label:'Total',      value: counts.total,    color:'text-neutral-900 dark:text-white',  dot:'bg-mag-500',             sub:'Postagens no contexto atual' },
          { key:'pending',  label:'Pendentes',  value: counts.pending,  color:'text-amber-500 dark:text-amber-400',dot:'bg-neutral-300 dark:bg-neutral-600', sub:'Aguardando aprovacao' },
          { key:'approved', label:'Aprovados',  value: counts.approved, color:'text-green-600 dark:text-green-400',dot:'bg-neutral-300 dark:bg-neutral-600', sub:'Conteudos liberados' },
          { key:'rejected', label:'Recusados',  value: counts.rejected, color:'text-red-500 dark:text-red-400',    dot:'bg-neutral-300 dark:bg-neutral-600', sub:'Precisam de correcao' },
        ].map(m => (
          <button key={m.key} onClick={() => setStatusFilter(m.key)}
            className={`text-left p-5 rounded-xl border transition-all relative ${
              statusFilter===m.key
                ? 'border-mag-500 bg-mag-50 dark:bg-neutral-800'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-500'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">{m.label}</div>
              <div className={`w-2.5 h-2.5 rounded-full ${statusFilter===m.key ? 'bg-mag-500' : m.dot}`} />
            </div>
            <div className={`text-5xl font-extrabold mb-3 ${m.color}`}>{m.value}</div>
            <div className="text-xs text-neutral-400">{m.sub}</div>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <Card className="mb-4 overflow-hidden">
        {/* Context bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-mag-50 dark:bg-mag-500/20 flex items-center justify-center flex-shrink-0">
              <LayoutDashboard size={15} className="text-mag-500 dark:text-mag-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Empresa em foco</div>
              <div className="text-sm font-bold text-neutral-800 dark:text-white">
                {clientFilter ? clients.find(c=>c.id===clientFilter)?.name || 'Cliente' : 'Todas as empresas'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {statusFilter !== 'all' && (
              <span className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-3 py-1 rounded-full text-xs">
                Status: <strong className="text-neutral-900 dark:text-white">{{all:'Todos',pending:'Pendentes',approved:'Aprovados',rejected:'Recusados'}[statusFilter]}</strong>
              </span>
            )}
            <span className="bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300 px-3 py-1 rounded-full text-xs">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            {(search || clientFilter || statusFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('all') }}
                className="text-mag-500 hover:text-mag-700 font-semibold text-xs transition-colors">
                ✕ Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Filter inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-neutral-100 dark:divide-neutral-700">
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Buscar</div>
            <div className="relative">
              <Search size={13} className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar por titulo, descricao ou cliente..."
                className="w-full pl-5 text-sm bg-transparent outline-none text-neutral-700 dark:text-neutral-200 placeholder-neutral-400" />
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Empresa</div>
            <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}
              className="w-full text-sm bg-transparent outline-none text-neutral-700 dark:text-white font-semibold cursor-pointer">
              <option value="">Todas as empresas</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1">
              <span>⊞</span> Status
            </div>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
              className="w-full text-sm bg-transparent outline-none text-neutral-700 dark:text-white font-semibold cursor-pointer">
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Recusados</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Posts table */}
      <Card>
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <span className="font-semibold text-sm">Postagens <span className="text-neutral-400 font-normal">({filtered.length})</span></span>
          {(search || clientFilter || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('all') }}
              className="text-xs text-neutral-400 hover:text-mag-500 transition-colors">✕ Limpar filtros</button>
          )}
        </div>
        {loading ? (
          <div className="p-10 text-center text-neutral-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-neutral-400">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm">Nenhuma postagem encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  {['Conteúdo','Canais','Funil','Cliente','Status','Ações'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(post => {
                  const st     = computePostStatus(post.files||[], post.status)
                  const client = clients.find(c => c.id === post.client_id) || {}
                  const isRej  = st === 'rejected'
                  return (
                    <tr key={post.id} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-lg">
                            {post.files?.[0]?.storage_url ? <img src={post.files[0].storage_url} alt="" className="w-full h-full object-cover" /> : post.email_link ? '📧' : '🖼️'}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white text-sm">{post.title}</div>
                            <div className="text-xs text-neutral-400">{(post.files||[]).length} arquivo(s)</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(post.channels||[]).slice(0,2).map(ch=><span key={ch} className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{ch.split('/')[0]}</span>)}
                          {(post.channels||[]).length>2&&<span className="text-[10px] text-neutral-400">+{post.channels.length-2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><FunnelBadge tag={post.funnel_tag} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={client.name} color={client.color} size="sm" />
                          <span className="text-xs truncate max-w-[80px]">{client.name||'—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={st} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {isRej ? (
                            <button onClick={() => setResubmitPost(post)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold">
                              <RotateCcw size={11}/> Corrigir
                            </button>
                          ) : (
                            <button onClick={() => setEditPost(post)}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500">
                              <Edit3 size={14}/>
                            </button>
                          )}
                          <button onClick={() => handleDelete(post.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EditPostModal post={editPost} open={!!editPost} onClose={()=>setEditPost(null)} onSave={load} />
      <ResubmitModal post={resubmitPost} open={!!resubmitPost} onClose={()=>setResubmitPost(null)} onSave={load} />
    </div>
  )
}
