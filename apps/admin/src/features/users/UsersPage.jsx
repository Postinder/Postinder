import { useState, useEffect } from 'react'
import { Edit3, MoreVertical, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { createUser, deleteUser, fetchUsers, updateUser } from '../../services/users.service'
import { useAuthStore } from '../../store/authStore'
import { PERMISSION_SCREENS, ROLE_PERMISSIONS } from '../../utils/constants'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Badge'
import PageHeader from '../../components/ui/PageHeader'
import toast from 'react-hot-toast'

const ROLE_STYLES = {
  admin:   { label: 'Admin', bg: 'bg-mag-100 dark:bg-mag-950', text: 'text-mag-600 dark:text-mag-300', color: '#A7014B' },
  manager: { label: 'Manager', bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-600 dark:text-teal-300', color: '#3087A6' },
  editor:  { label: 'Editor', bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-300', color: '#6B21A8' },
  viewer:  { label: 'Viewer', bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-300', color: '#525252' },
}

const defaultForm = {
  name: '',
  email: '',
  password: '',
  role: 'manager',
  permissions: ROLE_PERMISSIONS.manager,
}

function isPrimaryAdmin(user) {
  return String(user?.email || '').trim().toLowerCase() === 'admin@postinder.local'
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  function resetForm() {
    setForm(defaultForm)
    setEditUser(null)
    setShowNew(false)
  }

  function openCreate() {
    setForm(defaultForm)
    setEditUser(null)
    setShowNew(true)
  }

  function openEdit(targetUser) {
    setEditUser(targetUser)
    setForm({
      name: targetUser.name || '',
      email: targetUser.email || '',
      password: '',
      role: targetUser.role || 'viewer',
      permissions: targetUser.permissions?.length
        ? targetUser.permissions
        : ROLE_PERMISSIONS[targetUser.role] || [],
    })
    setShowNew(true)
  }

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
    if (!form.name || !form.email || (!editUser && !form.password)) {
      toast.error('Preencha nome, e-mail e senha.')
      return
    }

    if (['editor', 'viewer'].includes(form.role) && !form.permissions.length) {
      toast.error('Selecione ao menos uma tela.')
      return
    }

    setSaving(true)
    try {
      if (editUser) {
        const updates = {
          name: form.name,
          role: form.role,
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        }
        const updated = await updateUser(editUser.id, updates)
        setUsers(current => current.map(item => item.id === editUser.id ? { ...item, ...updated } : item))
        toast.success('Usuario atualizado!')
      } else {
        const user = await createUser(form)
        setUsers(current => [user, ...current])
        toast.success(`Usuario ${form.name} criado!`)
      }
      resetForm()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(targetUser) {
    if (isPrimaryAdmin(targetUser)) {
      toast.error('O usuario admin principal nao pode ser excluido.')
      return
    }
    if (targetUser.id === currentUser?.id) {
      toast.error('Voce nao pode excluir o proprio usuario.')
      return
    }
    if (!confirm(`Excluir o usuario ${targetUser.name}?`)) return

    try {
      await deleteUser(targetUser.id)
      setUsers(current => current.filter(item => item.id !== targetUser.id))
      toast.success('Usuario excluido.')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="Usuarios do sistema"
        actions={<Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>Novo Usuario</Button>}
      />

      {loading ? (
        <div className="text-center py-16 text-neutral-400">Carregando...</div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center text-neutral-400">
          <p className="text-sm">Nenhum usuario cadastrado.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => {
            const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.manager
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} color={roleStyle.color} size="lg" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{user.name}</div>
                      <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${roleStyle.bg} ${roleStyle.text}`}>
                          {roleStyle.label}
                        </span>
                        {isPrimaryAdmin(user) && (
                          <span className="inline-block rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hidden gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950/60 sm:flex">
                    <button onClick={() => openEdit(user)} className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white hover:text-teal-500 dark:hover:bg-neutral-800" title="Editar usuario"><Edit3 size={14} /></button>
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={isPrimaryAdmin(user) || user.id === currentUser?.id}
                      className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800"
                      title={isPrimaryAdmin(user) ? 'Admin principal nao pode ser excluido' : 'Excluir usuario'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <details className="relative sm:hidden">
                    <summary className="list-none rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60">
                      <MoreVertical size={16} />
                    </summary>
                    <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                      <button onClick={() => openEdit(user)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"><Edit3 size={14}/> Editar</button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={isPrimaryAdmin(user) || user.id === currentUser?.id}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={14}/> Excluir
                      </button>
                    </div>
                  </details>
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

      <Modal
        open={showNew}
        onClose={resetForm}
        title={editUser ? 'Editar Usuario' : 'Novo Usuario'}
        subtitle={editUser ? 'Altere o perfil, permissoes e senha deste usuario.' : 'Defina o perfil e as telas que este usuario podera acessar.'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nome completo *" name="new-user-name" autoComplete="off" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="E-mail *" name="new-user-email" type="email" autoComplete="off" disabled={!!editUser} value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label={editUser ? 'Nova senha (opcional)' : 'Senha *'} name="new-user-password" type="password" autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} />
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <Button onClick={handleSave} loading={saving} className="flex-1 justify-center">{editUser ? 'Salvar usuario' : 'Criar usuario'}</Button>
            <Button variant="secondary" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
