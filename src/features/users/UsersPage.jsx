import { useState, useEffect } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { PERMISSION_SCREENS, ROLE_PERMISSIONS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

// User creation is handled by Edge Function (no secret key needed in frontend)

const ROLE_STYLES = {
  admin:  { label:'Admin',  bg:'bg-mag-100 dark:bg-mag-950',      text:'text-mag-600 dark:text-mag-300',    color:'#A7014B' },
  gestor: { label:'Gestor', bg:'bg-teal-100 dark:bg-teal-950',    text:'text-teal-600 dark:text-teal-300',  color:'#3087A6' },
  equipe: { label:'Equipe', bg:'bg-purple-100 dark:bg-purple-950',text:'text-purple-600 dark:text-purple-300',color:'#6B21A8' },
}

export default function UsersPage() {
  const [users, setUsers]     = useState([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'gestor', permissions:['dashboard','approvals'] })

  useEffect(() => {
    supabase.from('users').select('*').is('deleted_at', null)
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

  async function handleSave() {
    if (!form.name || !form.email || !form.password) { toast.error('Preencha nome, e-mail e senha.'); return }
    if (form.role === 'equipe' && !form.permissions.length) { toast.error('Selecione ao menos uma tela.'); return }
    setSaving(true)
    try {
      // Call Edge Function — service key stays safe on the server
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          name:        form.name,
          email:       form.email,
          password:    form.password,
          role:        form.role,
          permissions: form.permissions,
        }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setUsers(u => [...u, data.user])
      setShowNew(false)
      setForm({ name:'', email:'', password:'', role:'gestor', permissions:['dashboard','approvals'] })
      toast.success(`Usuário ${form.name} criado!`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-mag-500" />
          <h1 className="text-xl font-bold">Usuários do sistema</h1>
        </div>
        <Button size="sm" icon={<Plus size={14}/>} onClick={() => setShowNew(true)}>Novo Usuário</Button>
      </div>



      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => {
            const rs = ROLE_STYLES[u.role] || ROLE_STYLES.gestor
            return (
              <Card key={u.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={u.name} color={rs.color} size="lg" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{u.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{u.email}</div>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded mt-1 ${rs.bg} ${rs.text}`}>{rs.label}</span>
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
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo Usuário" subtitle="Defina o perfil e as telas que este usuário poderá acessar.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome completo *" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="E-mail *" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="Senha *" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            <Select label="Perfil" value={form.role} onChange={e => handleRoleChange(e.target.value)}>
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
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">Criar usuário</Button>
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
