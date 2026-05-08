import { supabase } from './supabase'

export async function fetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*, tokens:client_tokens(slug, token, expires_at, revoked_at)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data
}

export async function createClient(clientData) {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name:          clientData.name,
      email:         clientData.email,
      password_hash: clientData.password, // In production: hash via Edge Function
      whatsapp:      clientData.whatsapp  || null,
      document:      clientData.document  || null,
      document_type: clientData.documentType || null,
      segment:       clientData.segment   || null,
      deadline_days: clientData.deadlineDays || 7,
      color:         clientData.color,
    })
    .select()
    .single()
  if (error) throw error

  // Generate approval token
  const slug  = `${clientData.name.toLowerCase().replace(/\s+/g,'-')}-${Math.random().toString(36).slice(2,8)}`
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  await supabase.from('client_tokens').insert({
    client_id: data.id,
    token,
    slug,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  })

  return { ...data, slug }
}

export async function updateClient(id, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteClient(id) {
  await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('client_id', id)
}

export async function regenerateClientToken(clientId, name) {
  // Revoke current tokens
  await supabase.from('client_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('revoked_at', null)

  // Create new token
  const slug  = `${name.toLowerCase().replace(/\s+/g,'-')}-${Math.random().toString(36).slice(2,8)}`
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const { data, error } = await supabase.from('client_tokens').insert({
    client_id: clientId, token, slug,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single()
  if (error) throw error
  return data
}

// ── VCF parsing (client-side) ──
export function parseVCFText(text) {
  const contacts = []
  const vcards = text.split(/BEGIN:VCARD/i).filter(v => v.trim())
  vcards.forEach(vcard => {
    let name = '', phone = ''
    const lines = vcard.split(/\r?\n/)
    lines.forEach(line => {
      if (/^FN:/i.test(line)) name = line.replace(/^FN:/i,'').trim()
      else if (/^N:/i.test(line) && !name) {
        const parts = line.replace(/^N:/i,'').split(';')
        name = `${parts[1] || ''} ${parts[0] || ''}`.trim()
      }
      if (/^TEL/i.test(line)) phone = line.replace(/.*:/,'').replace(/\D/g,'').trim()
    })
    if (name || phone) contacts.push({ name, phone, email: '', password: '', segment: '', selected: true })
  })
  return contacts
}
