// src/services/integrations/canva.integration.js
// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: Canva
//
// Para ativar:
// 1. Acesse https://www.canva.com/developers
// 2. Crie um app e configure OAuth
// 3. Adicione no .env:
//    VITE_CANVA_CLIENT_ID=seu-client-id
//    VITE_CANVA_CLIENT_SECRET=seu-secret
//
// Fluxo OAuth: usuário clica → autoriza no Canva → retorna com token
// O token permite exportar designs como imagens/PDFs direto para o Postinder
// ─────────────────────────────────────────────────────────────────

import { isEnabled } from './registry'

const CLIENT_ID    = import.meta.env.VITE_CANVA_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/integrations/canva/callback`

// ── Step 1: Redirect user to Canva OAuth ──
export function authorizeCanva() {
  if (!isEnabled('canva')) throw new Error('Canva não configurado.')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'asset:read design:content:read',
  })

  window.location.href = `https://www.canva.com/api/oauth/authorize?${params}`
}

// ── Step 2: Exchange code for token (via Supabase Edge Function) ──
export async function exchangeCanvaCode(code) {
  // This must go through a backend to protect the client secret
  const res = await fetch('/api/canva/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  })
  if (!res.ok) throw new Error('Falha ao autenticar com Canva.')
  return res.json() // { access_token, refresh_token, expires_in }
}

// ── Step 3: List user's Canva designs ──
export async function listCanvaDesigns(accessToken) {
  const res = await fetch('https://api.canva.com/rest/v1/designs', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Falha ao buscar designs do Canva.')
  const data = await res.json()
  return data.items || []
}

// ── Step 4: Export design as image ──
export async function exportCanvaDesign(accessToken, designId, format = 'png') {
  // 1. Request export
  const exportRes = await fetch(`https://api.canva.com/rest/v1/exports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      design_id: designId,
      format:    { type: format === 'pdf' ? 'pdf' : 'png', export_quality: 'pro' },
    }),
  })

  if (!exportRes.ok) throw new Error('Falha ao exportar design do Canva.')
  const { job } = await exportRes.json()

  // 2. Poll until ready
  let url = null
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const statusRes = await fetch(`https://api.canva.com/rest/v1/exports/${job.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const status = await statusRes.json()
    if (status.job?.status === 'success') {
      url = status.job.urls?.[0]
      break
    }
  }

  if (!url) throw new Error('Timeout ao exportar design do Canva.')

  // 3. Download as Blob (to upload to R2/Supabase Storage)
  const blob = await fetch(url).then(r => r.blob())
  return new File([blob], `canva-${designId}.${format}`, { type: blob.type })
}

// ── Canva status ──
export function getCanvaStatus() {
  const token = sessionStorage.getItem('canva_token')
  return {
    connected:  !!token,
    configured: isEnabled('canva'),
    token,
  }
}
