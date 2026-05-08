import { supabase } from './supabase'

// ── Admin / Gestor / Equipe login ──
export async function loginAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('E-mail ou senha incorretos.')

  // Fetch profile from users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  // No profile = not a team member
  if (profileError || !profile) {
    await supabase.auth.signOut()
    throw new Error('Usuário não encontrado.')
  }

  return {
    session: data.session,
    user: {
      id:          data.user.id,
      email:       data.user.email,
      name:        profile.name,
      role:        profile.role,        // 'admin' | 'gestor' | 'equipe'
      permissions: profile.permissions || [],
      type:        'admin',
    }
  }
}

// ── Client login ──
export async function loginClient(email, password) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('email', email)
    .single()
  if (error || !data) throw new Error('E-mail não encontrado.')
  if (data.password_hash !== password) throw new Error('Senha incorreta.')
  return { ...data, type: 'client' }
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/recover`,
  })
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
