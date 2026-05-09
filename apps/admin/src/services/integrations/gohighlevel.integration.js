// src/services/integrations/gohighlevel.integration.js
// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: GoHighLevel (GHL)
//
// Para ativar:
// 1. Acesse sua conta GHL → Settings → API Keys
// 2. Crie uma API Key com permissão de Contacts
// 3. Copie o Location ID da sua sub-conta
// 4. Adicione no .env:
//    VITE_GHL_API_KEY=seu-api-key
//    VITE_GHL_LOCATION_ID=seu-location-id
// ─────────────────────────────────────────────────────────────────

import { isEnabled } from './registry'

const BASE_URL   = 'https://rest.gohighlevel.com/v1'
const API_KEY    = import.meta.env.VITE_GHL_API_KEY
const LOCATION   = import.meta.env.VITE_GHL_LOCATION_ID

function headers() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  }
}

async function ghlFetch(path, options = {}) {
  if (!isEnabled('gohighlevel')) throw new Error('GoHighLevel não configurado.')
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: headers() })
  if (!res.ok) throw new Error(`GHL API error: ${res.status}`)
  return res.json()
}

// ── Sync client as GHL Contact ──
export async function syncClientToGHL(client) {
  const contact = {
    locationId: LOCATION,
    firstName:  client.name.split(' ')[0],
    lastName:   client.name.split(' ').slice(1).join(' '),
    email:      client.email,
    phone:      client.whatsapp ? `+55${client.whatsapp.replace(/\D/g,'')}` : undefined,
    tags:       ['postinder', client.segment].filter(Boolean),
    customField: [
      { id: 'postinder_client_id', value: client.id },
      { id: 'postinder_segment',   value: client.segment || '' },
    ],
  }

  return ghlFetch('/contacts/', {
    method: 'POST',
    body:   JSON.stringify(contact),
  })
}

// ── Get GHL contact by email ──
export async function findGHLContact(email) {
  return ghlFetch(`/contacts/?locationId=${LOCATION}&query=${encodeURIComponent(email)}`)
}

// ── Add note to GHL contact when post is approved ──
export async function addApprovalNote(ghlContactId, postTitle, approvedAt) {
  return ghlFetch(`/contacts/${ghlContactId}/notes/`, {
    method: 'POST',
    body: JSON.stringify({
      userId: 'postinder-bot',
      body:   `✅ Conteúdo aprovado no Postinder: "${postTitle}" em ${new Date(approvedAt).toLocaleDateString('pt-BR')}`,
    }),
  })
}

// ── Trigger GHL Workflow/Tag when client approves all ──
export async function triggerApprovalWorkflow(ghlContactId, tags = ['postinder-aprovado']) {
  return ghlFetch(`/contacts/${ghlContactId}/tags/`, {
    method: 'POST',
    body:   JSON.stringify({ tags }),
  })
}
