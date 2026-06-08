import { useState, useEffect } from 'react'
import { Plus, ShieldCheck, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { PERMISSION_SCREENS, ROLE_PERMISSIONS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

const ROLE_STYLES = {
  admin:  { label:'Admin',  bg:'bg-mag-100 dark:bg-mag-950',       text:'text-mag-600 dark:text-mag-300',     color:'#A7014B' },
  gestor: { label:'Gestor', bg:'bg-teal-100 dark:bg-teal-950',     text:'text-teal-600 dark:text-teal-300',   color:'#3087A6' },
  equipe: { label:'Equipe', bg:'bg-purple-100 dark:bg-purple-950', text:'text-purple-600 dark:text-purple-300',color:'#6B21A8' },
}

const PAGE_SIZE = 10
const emptyForm = { name:'', email:'', password:'', role:'gestor', permissions:['dashboard','approvals'] }

export default function UsersPage() {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [page,     setPage]     = useState(1)
  const [showNew,  setShowNew]  = useState(false)
  const [editUser, setEditUser] = useState(null)   // user being edited
  const [form,     setForm]     = useState(emptyForm)

  useEffect(() => {
    supabase.from('users').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setUsers(data) })
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleRoleChange(role) {
    set('role', role)
    set('permissions', ROLE_PERMISSIONS[role] || [])
  }

  function togglePerm(id) {
    const cur = form.permissions
    set('permissions', cur.includes(id) ? cur.filter(p => p !== id) : [...cur, id])
  }

  function openNew() {
    setForm(emptyForm)
    setEditUser(null)
    setShowNew(true)
  }

  function openEdit(u) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, permissions: u.permissions || [] })
    setEditUser(u)
    setShowNew(true)
  }

  async function handleDeactivate(u) {
    if (!confirm(`Desativar o usuário "${u.name}"? Ele não conseguirá mais logar.`)) return
    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', u.id)
    if (error) { toast.error(error.message); return }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: false } : x))
    toast.success(`Usuário ${u.name} desativado.`)
  }

  async function handleReactivate(u) {
    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', u.id)
    if (error) { toast.error(error.message); return }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: true } : x))
    toast.success(`Usuário ${u.name} reativado!`)
  }

  async function handleSave() {
    if (!form.name || !form.email) { toast.error('Preencha nome e e-mail.'); return }
    if (!editUser && !form.password) { toast.error('Informe a senha.'); return }
    if (form.role === 'equipe' && !form.permissions.length) { toast.error('Selecione ao menos uma tela.'); return }
    setSaving(true)
    try {
      if (editUser) {
        // Update existing user
        const updates = { name: form.name, email: form.email, role: form.role, permissions: form.permissions }
        if (form.password) updates.password_hash = form.password // handled by edge fn if needed
        const { error } = await supabase.from('users').update(updates).eq('id', editUser.id)
        if (error) throw error
        setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u))
        toast.success(`Usuário ${form.name} atualizado!`)
      } else {
        // Create new user via Edge Function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { name: form.name, email: form.email, password: form.password, role: form.role, permissions: form.permissions }
        })
        if (error) {
          let msg = error.message
          try { const body = await error.context.json(); if (body?.error) msg = body.error } catch {}
          throw new Error(msg)
        }
        if (data?.error) throw new Error(data.error)
        setUsers(u => [...u, data.user])
        toast.success(`Usuário ${form.name} criado!`)
      }
      setShowNew(false)
      setEditUser(null)
      setForm(emptyForm)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
  const paged = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-mag-500" />
          <h1 className="text-xl font-bold">Usuários do sistema</h1>
          <span className="text-sm text-neutral-400 font-normal">({users.length})</span>
        </div>
        <Button size="sm" icon={<Plus size={14}/>} onClick={openNew}>Novo Usuário</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {paged.map(u => {
              const rs = ROLE_STYLES[u.role] || ROLE_STYLES.gestor
              return (
                <Card key={u.id} className={`p-4 ${u.is_active === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={u.name} color={rs.color} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{u.name}</div>
                      <div className="text-xs text-neutral-400 truncate">{u.email}</div>
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded mt-1 ${rs.bg} ${rs.text}`}>{rs.label}</span>
                      {u.is_active === false && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded mt-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 ml-1">Inativo</span>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-teal-500 transition-colors" title="Editar">
                        <Pencil size={13}/>
                      </button>
                      {u.is_active !== false ? (
                        <button onClick={() => handleDeactivate(u)}
                          title="Desativar usuário"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors text-xs font-bold">
                          ON
                        </button>
                      ) : (
                        <button onClick={() => handleReactivate(u)}
                          title="Reativar usuário"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 transition-colors text-xs font-bold">
                          OFF
                        </button>
                      )}
                    </div>
                  </div>
                  {u.role === 'equipe' && u.permissions?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(u.permissions || []).slice(0, 5).map(p => {
                        const s = PERMISSION_SCREENS.find(x => x.id === p)
                        return s ? <span key={p} className="text-[9px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">{s.icon} {s.label}</span> : null
                      })}
                      {(u.permissions || []).length > 5 && <span className="text-[9px] text-neutral-400">+{u.permissions.length - 5}</span>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:border-mag-400 transition-colors">
                <ChevronLeft size={16}/>
              </button>
              <span className="text-sm text-neutral-500 font-medium">
                Página {page} de {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:border-mag-400 transition-colors">
                <ChevronRight size={16}/>
              </button>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setEditUser(null) }}
        title={editUser ? `Editar — ${editUser.name}` : 'Novo Usuário'}
        subtitle={editUser ? 'Altere os dados, cargo ou permissões.' : 'Defina o perfil e as telas que este usuário poderá acessar.'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome completo *" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="E-mail *" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label={editUser ? 'Nova senha (deixe vazio para manter)' : 'Senha *'} type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            <Select label="Cargo" value={form.role} onChange={e => handleRoleChange(e.target.value)}>
              <option value="admin">Admin — acesso total</option>
              <option value="gestor">Gestor — acesso operacional</option>
              <option value="equipe">Equipe — acesso personalizado</option>
            </Select>
          </div>
          {form.role === 'equipe' && (
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
              <div className="text-xs font-semibold mb-3 text-neutral-600 dark:text-neutral-300">🔒 Telas permitidas:</div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_SCREENS.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-mag-400 transition-colors">
                    <input type="checkbox" checked={form.permissions.includes(s.id)} onChange={() => togglePerm(s.id)} className="accent-mag-500 w-4 h-4" />
                    <span className="text-sm">{s.icon} {s.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-neutral-400 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">Usuários do tipo Equipe nunca acessam a tela de Usuários.</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">
              {editUser ? 'Salvar alterações' : 'Criar usuário'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowNew(false); setEditUser(null) }}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
