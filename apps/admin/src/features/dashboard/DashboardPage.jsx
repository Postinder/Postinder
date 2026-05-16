import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Trash2, Edit3, RotateCcw, Plus, ExternalLink } from 'lucide-react'
import { fetchPosts, softDeletePost, computePostStatus, updatePost, resubmitPost } from '../../services/posts.service'
import { fetchClients, notifyClient } from '../../services/clients.service'
import { StatusBadge, Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import Skeleton from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { key: 'all',             label: 'Todos' },
  { key: 'pending_approval',label: 'Pendentes' },
  { key: 'approved',        label: 'Aprovados' },
  { key: 'rejected',        label: 'Recusados' },
  { key: 'draft',           label: 'Rascunhos' },
]

function EditPostModal({ post, open, onClose, onSave }) {
  const [title,   setTitle]   = useState('')
  const [caption, setCaption] = useState('')
  const [just,    setJust]    = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (post) { setTitle(post.title || ''); setCaption(post.description || ''); setJust('') }
  }, [post])

  const isRej = post?.status === 'rejected'

  async function handleSave() {
    setSaving(true)
    try {
      if (isRej) {
        if (!just.trim() || just.trim().length < 10) { toast.error('Justificativa deve ter ao menos 10 caracteres.'); setSaving(false); return }
        await resubmitPost(post.id, { title, caption, justificativa: just })
        toast.success('Reenviado para aprovação!')
      } else {
        await updatePost(post.id, { title, description: caption })
        toast.success('Postagem atualizada!')
      }
      onSave()
      onClose()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  if (!post) return null
  return (
    <Modal open={open} onClose={onClose}
      title={isRej ? '↺ Corrigir e Reenviar' : 'Editar Postagem'}
      subtitle={isRej ? 'Corrija e reenvie para nova aprovação do cliente.' : 'Edite os dados da postagem.'}>
      <div className="space-y-4">
        {isRej && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">⚠️ Arquivos reprovados pelo cliente</p>
            {(post.files || []).filter(f => f.status === 'rejected').map(f => (
              <div key={f.id} className="text-xs text-red-500">• {f.name}</div>
            ))}
          </div>
        )}
        <Input label="Título" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea label="Legenda / Descrição" value={caption} onChange={e => setCaption(e.target.value)} />
        {isRej && (
          <Textarea label="O que foi corrigido? *" value={just} onChange={e => setJust(e.target.value)}
            placeholder="Explique o que foi ajustado..." />
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1 justify-center"
            variant={isRej ? 'teal' : 'primary'}>
            {isRej ? '↺ Reenviar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [posts,        setPosts]        = useState([])
  const [clients,      setClients]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setSF]           = useState('all')
  const [editPost,     setEditPost]     = useState(null)

  // Read client filter from URL (?client=uuid)
  const clientFilter = searchParams.get('client') || ''

  function setClientFilter(id) {
    if (id) setSearchParams({ client: id })
    else    setSearchParams({})
  }

  const load = useCallback(() => {
    Promise.all([fetchPosts(), fetchClients()])
      .then(([p, c]) => { setPosts(p); setClients(c) })
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

  async function sendApprovalNotification(clientId) {
    try {
      await notifyClient(clientId)
      toast.success('Mensagem via WhatsApp foi enviada.')
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Não foi possível enviar o WhatsApp.')
    }
  }

  const activeClient = clients.find(c => c.id === clientFilter)

  const filtered = posts.filter(p => {
    const st = computePostStatus(p)
    if (search && !p.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (clientFilter && p.client_id !== clientFilter && p.clientId !== clientFilter) return false
    if (statusFilter !== 'all' && st !== statusFilter) return false
    return true
  })

  const counts = {
    all:             posts.filter(p => !clientFilter || p.client_id === clientFilter || p.clientId === clientFilter).length,
    pending_approval:posts.filter(p => (!clientFilter || p.client_id === clientFilter || p.clientId === clientFilter) && computePostStatus(p) === 'pending_approval').length,
    approved:        posts.filter(p => (!clientFilter || p.client_id === clientFilter || p.clientId === clientFilter) && computePostStatus(p) === 'approved').length,
    rejected:        posts.filter(p => (!clientFilter || p.client_id === clientFilter || p.clientId === clientFilter) && computePostStatus(p) === 'rejected').length,
    draft:           posts.filter(p => (!clientFilter || p.client_id === clientFilter || p.clientId === clientFilter) && computePostStatus(p) === 'draft').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-mag-500" />
          <h1 className="text-xl font-bold">
            {activeClient ? (
              <>
                <button onClick={() => setClientFilter('')} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-base font-normal">Dashboard</button>
                <span className="text-neutral-300 dark:text-neutral-600 mx-2">/</span>
                {activeClient.name}
              </>
            ) : 'Dashboard'}
          </h1>
        </div>
        <Button size="sm" icon={<Plus size={14}/>} onClick={() => navigate('/admin/posts/new')}>
          Nova Postagem
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',      value: counts.all,              color: 'text-neutral-900 dark:text-white', key: 'all' },
          { label: 'Pendentes',  value: counts.pending_approval, color: 'text-amber-600',  key: 'pending_approval' },
          { label: 'Aprovados',  value: counts.approved,         color: 'text-green-600',  key: 'approved' },
          { label: 'Recusados',  value: counts.rejected,         color: 'text-red-600',    key: 'rejected' },
        ].map(m => (
          <button key={m.key} onClick={() => setSF(statusFilter === m.key ? 'all' : m.key)}
            className={`text-left p-5 rounded-xl border transition-all bg-white dark:bg-neutral-900 ${statusFilter === m.key ? 'border-mag-500 shadow-[inset_0_0_0_1px_#A7014B]' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{m.label}</div>
            <div className={`text-4xl font-extrabold ${m.color}`}>{m.value}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar postagem..."
            className="flex-1 min-w-[160px] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500" />
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none">
            <option value="">Todos os clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => setSF(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${statusFilter === t.key ? 'bg-mag-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 text-sm font-semibold flex items-center justify-between">
          <span>Postagens <span className="text-neutral-400 font-normal">({filtered.length})</span></span>
          {activeClient && (
            <span className="text-xs text-neutral-400">Filtrando por: <strong className="text-neutral-700 dark:text-neutral-200">{activeClient.name}</strong></span>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="grid grid-cols-[2fr_1.4fr_1.5fr_1fr_1fr] gap-4 items-center py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-neutral-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">Nenhuma postagem encontrada.</p>
              <button onClick={() => navigate('/admin/posts/new')}
                className="mt-3 text-mag-500 hover:text-mag-600 text-sm font-semibold">
                + Criar primeira postagem
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  {['Conteúdo', 'Cliente', 'Arquivos', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(post => {
                  const st = computePostStatus(post)
                  const client = clients.find(c => c.id === (post.client_id || post.clientId)) || {}
                  const files = post.files || []
                  const isRej = st === 'rejected'
                  const firstFile = files[0]

                  return (
                    <tr key={post.id} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                      {/* Conteúdo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                            {firstFile?.file_type === 'IMAGE' && firstFile?.storage_url
                              ? <img src={firstFile.storage_url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                              : firstFile ? { VIDEO:'🎬', AUDIO:'🎵', PDF:'📄', DOC:'📝', SHEET:'📊', PPTX:'📋' }[firstFile.file_type] || '📎'
                              : '🖼️'
                            }
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white line-clamp-1">{post.title || '(sem título)'}</div>
                            <div className="text-xs text-neutral-400">{files.length} arquivo{files.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <button onClick={() => setClientFilter(post.client_id || post.clientId)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                          <Avatar name={client.name} color={client.color} size="sm" />
                          <span className="text-xs truncate max-w-[90px]">{client.name || '—'}</span>
                        </button>
                      </td>

                      {/* Arquivos */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {files.slice(0, 3).map((f, i) => (
                            <div key={i} className="w-7 h-7 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs overflow-hidden"
                              title={f.name}>
                              {f.file_type === 'IMAGE' && f.storage_url
                                ? <img src={f.storage_url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                                : <span className="text-[10px]">{{ VIDEO:'🎬', AUDIO:'🎵', PDF:'📄', DOC:'📝', SHEET:'📊', PPTX:'📋' }[f.file_type] || '📎'}</span>
                              }
                            </div>
                          ))}
                          {files.length > 3 && <span className="text-xs text-neutral-400 self-center">+{files.length - 3}</span>}
                          {files.length === 0 && <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3"><StatusBadge status={st} /></td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center">
                          {isRej ? (
                            <button onClick={() => setEditPost(post)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold">
                              <RotateCcw size={11}/> Corrigir
                            </button>
                          ) : (
                            <button onClick={() => setEditPost(post)}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500" title="Editar">
                              <Edit3 size={14}/>
                            </button>
                          )}
                          <button onClick={() => handleDelete(post.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500" title="Excluir">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <EditPostModal post={editPost} open={!!editPost} onClose={() => setEditPost(null)} onSave={async () => {
        if (editPost?.status === 'rejected') {
          await sendApprovalNotification(editPost.client_id || editPost.clientId)
        }
        load()
      }} />
    </div>
  )
}
