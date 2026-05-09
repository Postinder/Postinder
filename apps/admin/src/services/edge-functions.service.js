// src/services/edge-functions.service.js
// DEPRECATED: Edge Functions are now handled by the backend API
// This file is kept for backwards compatibility only

import { apiClient } from '../lib/axios'

// ── Criar usuário da equipe ──
export async function createTeamUser({ name, email, password, role, permissions }) {
  const { data } = await apiClient.post('/admin/users', {
    name,
    email,
    password,
    role,
    permissions,
  })
  return data.user
}

// ── Enviar e-mail de aprovação ──
export async function sendApprovalEmail({ clientId, approvalLink, postCount }) {
  const { data } = await apiClient.post('/notifications/approval-email', {
    clientId,
    approvalLink,
    postCount,
  })
  return data
}

// ── Enviar WhatsApp ──
export async function sendApprovalWhatsApp({ clientId, approvalLink, postCount, customMessage }) {
  const { data } = await apiClient.post('/notifications/approval-whatsapp', {
    clientId,
    approvalLink,
    postCount,
    customMessage,
  })
  return data
}
