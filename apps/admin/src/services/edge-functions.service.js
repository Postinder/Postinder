// src/services/edge-functions.service.js
// Chamadas para as Supabase Edge Functions

import { supabase } from './supabase'

// ── Criar usuário da equipe ──
export async function createTeamUser({ name, email, password, role, permissions }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { name, email, password, role, permissions }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.user
}

// ── Enviar e-mail de aprovação ──
export async function sendApprovalEmail({ clientId, approvalLink, postCount }) {
  const { data, error } = await supabase.functions.invoke('send-approval-email', {
    body: { clientId, approvalLink, postCount }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// ── Enviar WhatsApp ──
export async function sendApprovalWhatsApp({ clientId, approvalLink, postCount, customMessage }) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { clientId, approvalLink, postCount, customMessage }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
