import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Trash2, Edit3, RotateCcw } from 'lucide-react'
import { fetchPosts, softDeletePost, computePostStatus, updatePost, resubmitPost } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import { StatusBadge, FunnelBadge, Avatar } from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea, Select } from '../../components/ui/Input'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { key:'all', label:'Todos' },
  { key:'pending', label:'Pendentes' },
  { key:'approved', label:'Aprovados' },
  { key:'rejected', label:'Recusados' },
]

// ── Edit Post Modal ──
function EditPostModal({ post, open, onClose, onSave }) {
  const [title, setTitle]       = useState('')
  const [caption, setCaption]   = useState('')
  const [status, setStatus]     = useState('pending')
  const [just, setJust]         = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (post) {
      setTitle(post.title || '')
      setCaption(post.caption || '')
      setStatus(computePostStatus(post.files || []))
      setJust(post.justificativa || '')
    }
  }, [post])

  const isRej = post && computePostStatus(post.files || []) === 'rejected'

  async function handleSave() {
    setSaving(true)
    try {
      if (isRej) {
        if (!just.trim() || just.trim().length < 10) {
          toast.error('Justificativa deve ter ao menos 10 caracteres.'); setSaving(false); return
        }
        await resubmitPost(post.id, { title, caption, justificativa: just })
        toast.success('Reenviado para aprovação!')
      } else {
        await updatePost(post.id, { title, caption })
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
      subtitle={isRej ? 'Corrija o conteúdo e reenvie para nova aprovação.' : 'Edite os dados da postagem.'}>
      <div className="space-y-4">
        {isRej && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">⚠️ Arquivos reprovados pelo cliente:</div>
            {(post.files || []).filter(f => f.status === 'REJECTED').map(f => (
              <div key={f.id} className="text-xs text-red-500 flex items-center gap-1.5 mb-1">
                <span>•</span><span>{f.name}</span>
              </div>
            ))}
          </div>
        )}
        <Input label="Título" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea label="Legenda" value={caption} onChange={e => setCaption(e.target.value)} />
        {isRej && (
          <Textarea label="Justificativa da equipe *"
            value={just} onChange={e => setJust(e.target.value)}
            placeholder="Explique o que foi corrigido..." />
        )}
        {!isRej && (
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Recusado</option>
            <option value="delivered">Entregue</option>
          </Select>
        )}
        <div className="flex gap-3 pt-2">
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
  const [posts, setPosts]       = useState([])
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [clientFilter, setCF]   = useState('')
  const [statusFilter, setSF]   = useState('all')
  const [editPost, setEditPost] = useState(null)

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

  const filtered = posts.filter(p => {
    const st = computePostStatus(p.files || [])
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
    if (clientFilter && p.client_id !== clientFilter) return false
    if (statusFilter === 'pending' && !['pending','updated'].includes(st)) return false
    if (statusFilter === 'approved' && st !== 'approved') return false
    if (statusFilter === 'rejected' && st !== 'rejected') return false
    return true
  })

  const counts = {
    total:    posts.length,
    pending:  posts.filter(p => ['pending','updated'].includes(computePostStatus(p.files||[]))).length,
    approved: posts.filter(p => computePostStatus(p.files||[]) === 'approved').length,
    rejected: posts.filter(p => computePostStatus(p.files||[]) === 'rejected').length,
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard size={20} className="text-mag-500" />
        <h1 className="text-xl font-bold">Dashboard</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total de Posts', value: counts.total,    color:'text-neutral-900 dark:text-white', sub:'todos os clientes' },
          { label:'Aguardando',     value: counts.pending,  color:'text-amber-600', sub:'pendentes' },
          { label:'Aprovados',      value: counts.approved, color:'text-green-600', sub:'concluídos' },
          { label:'Recusados',      value: counts.rejected, color:'text-red-600',   sub:'precisam ajuste' },
        ].map(m => (
          <Card key={m.label} className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{m.label}</div>
            <div className={`text-4xl font-extrabold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-neutral-400 mt-1">{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar postagem..."
            className="flex-1 min-w-[180px] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none focus:border-mag-500" />
          <select value={clientFilter} onChange={e => setCF(e.target.value)}
            className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800 outline-none">
            <option value="">Todos os clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => setSF(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${statusFilter === t.key ? 'bg-mag-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 font-semibold text-sm">
          Postagens <span className="text-neutral-400 font-normal ml-1">({filtered.length})</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-neutral-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-neutral-400">Nenhuma postagem encontrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  {['Conteúdo','Canais','Funil','Data','Cliente','Status','Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(post => {
                  const st = computePostStatus(post.files || [])
                  const client = clients.find(c => c.id === post.client_id) || {}
                  const isRej  = st === 'rejected'
                  return (
                    <tr key={post.id} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                            {post.files?.[0]?.storage_url
                              ? <img src={post.files[0].storage_url} alt="" className="w-full h-full object-cover" />
                              : post.email_link ? '📧' : '🖼️'}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white">{post.title}</div>
                            <div className="text-xs text-neutral-400">{(post.files||[]).length} arquivo(s)</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(post.channels||[]).slice(0,2).map(ch => (
                            <span key={ch} className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{ch.split('/')[0]}</span>
                          ))}
                          {(post.channels||[]).length > 2 && <span className="text-[10px] text-neutral-400">+{post.channels.length-2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><FunnelBadge tag={post.funnel_tag} /></td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">
                        {post.scheduled_date ? new Date(post.scheduled_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={client.name} color={client.color} size="sm" />
                          <span className="text-xs truncate max-w-[90px]">{client.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={st} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center">
                          {isRej ? (
                            <button onClick={() => setEditPost(post)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 text-xs font-semibold transition-colors" title="Corrigir e reenviar">
                              <RotateCcw size={12}/> Corrigir
                            </button>
                          ) : (
                            <button onClick={() => setEditPost(post)}
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500 transition-colors" title="Editar">
                              <Edit3 size={14}/>
                            </button>
                          )}
                          <button onClick={() => handleDelete(post.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500 transition-colors" title="Excluir">
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

      <EditPostModal
        post={editPost}
        open={!!editPost}
        onClose={() => setEditPost(null)}
        onSave={load}
      />
    </div>
  )
}
