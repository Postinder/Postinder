import { useState, useEffect } from 'react'
import { Plus, ShieldCheck, UserPlus } from 'lucide-react'
import { createUser, fetchUsers } from '../../services/users.service'
import { PERMISSION_SCREENS, ROLE_PERMISSIONS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import { Avatar } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

const ROLE_STYLES = {
  admin:   { label: 'Admin', bg: 'bg-mag-100 dark:bg-mag-950', text: 'text-mag-600 dark:text-mag-300', color: '#A7014B' },
  manager: { label: 'Manager', bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-600 dark:text-teal-300', color: '#3087A6' },
  editor:  { label: 'Editor', bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-300', color: '#6B21A8' },
  viewer:  { label: 'Viewer', bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-300', color: '#525252' },
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'manager',
    permissions: ROLE_PERMISSIONS.manager,
  })

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  function handleRoleChange(role) {
    setForm(current => ({
      ...current,
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
    }))
  }

  function togglePerm(id) {
    set('permissions', form.permissions.includes(id)
      ? form.permissions.filter(permission => permission !== id)
      : [...form.permissions, id])
  }

  async function handleSave() {
    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha nome, e-mail e senha.')
      return
    }

    if (['editor', 'viewer'].includes(form.role) && !form.permissions.length) {
      toast.error('Selecione ao menos uma tela.')
      return
    }

    setSaving(true)
    try {
      const user = await createUser(form)
      setUsers(current => [user, ...current])
      setShowNew(false)
      setForm({ name: '', email: '', password: '', role: 'manager', permissions: ROLE_PERMISSIONS.manager })
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
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>Novo Usuário</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(item => (
            <Card key={item} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-full" />
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={34} />}
          title="Nenhum usuario cadastrado"
          description="Crie usuários internos para organizar acessos e permissões do sistema."
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>Novo Usuário</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => {
            const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.manager
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={user.name} color={roleStyle.color} size="lg" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{user.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded mt-1 ${roleStyle.bg} ${roleStyle.text}`}>
                      {roleStyle.label}
                    </span>
                  </div>
                </div>
                {user.permissions?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.slice(0, 5).map(permission => {
                      const screen = PERMISSION_SCREENS.find(item => item.id === permission)
                      return screen ? (
                        <span key={permission} className="text-[9px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">
                          {screen.icon} {screen.label}
                        </span>
                      ) : null
                    })}
                    {user.permissions.length > 5 && <span className="text-[9px] text-neutral-400">+{user.permissions.length - 5}</span>}
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
              <option value="admin">Admin - acesso total</option>
              <option value="manager">Manager - acesso operacional</option>
              <option value="editor">Editor - conteúdo e aprovações</option>
              <option value="viewer">Viewer - somente leitura</option>
            </Select>
          </div>

          {['editor', 'viewer'].includes(form.role) && (
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
              <div className="text-xs font-semibold mb-3 text-neutral-600 dark:text-neutral-300">Telas permitidas:</div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_SCREENS.map(screen => (
                  <label key={screen.id} className="flex items-center gap-2 p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-mag-400 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(screen.id)}
                      onChange={() => togglePerm(screen.id)}
                      className="accent-mag-500 w-4 h-4"
                    />
                    <span className="text-sm">{screen.icon} {screen.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">Criar usuario</Button>
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
