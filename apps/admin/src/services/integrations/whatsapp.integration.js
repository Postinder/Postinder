// src/services/integrations/whatsapp.integration.js
// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: WhatsApp (Z-API ou Twilio)
//
// Para ativar Z-API:
// 1. Acesse https://developer.z-api.io
// 2. Crie uma instância e conecte seu WhatsApp
// 3. Adicione no .env:
//    VITE_ZAPI_INSTANCE=sua-instancia
//    VITE_ZAPI_TOKEN=seu-token
//
// Para ativar Twilio (alternativa):
//    VITE_TWILIO_SID=ACxxxx
//    VITE_TWILIO_TOKEN=seu-token
//    VITE_TWILIO_FROM=whatsapp:+14155238886
// ─────────────────────────────────────────────────────────────────

import { isEnabled } from './registry'

// ── Z-API ──
async function sendViaZAPI(phone, message) {
  const instance = import.meta.env.VITE_ZAPI_INSTANCE
  const token    = import.meta.env.VITE_ZAPI_TOKEN

  const res = await fetch(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone:   phone.replace(/\D/g, ''),
        message,
      }),
    }
  )

  if (!res.ok) throw new Error(`Z-API error: ${res.status}`)
  return res.json()
}

// ── Main: send approval link ──
export async function sendApprovalLink({ clientName, phone, approvalLink, postCount = 1 }) {
  if (!isEnabled('whatsapp_zapi') && !isEnabled('whatsapp_twilio')) {
    // Fallback: open WhatsApp Web
    const message = buildMessage(clientName, approvalLink, postCount)
    const url = `https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    return { method: 'manual', url }
  }

  const message = buildMessage(clientName, approvalLink, postCount)

  if (isEnabled('whatsapp_zapi')) {
    await sendViaZAPI(phone, message)
    return { method: 'zapi', sent: true }
  }

  throw new Error('Nenhum provedor de WhatsApp configurado.')
}

function buildMessage(name, link, count) {
  return `Olá ${name}! 🔥\n\nVocê tem *${count} conteúdo(s)* aguardando sua aprovação no Postinder.\n\nAcesse agora:\n${link}\n\n✅ Sem login necessário. Deslize para aprovar ou recusar cada arquivo.`
}

// ── Quick WhatsApp open (always works, no API needed) ──
export function openWhatsApp(phone, clientName) {
  const msg = `Olá ${clientName}! Você tem conteúdos aguardando aprovação no Postinder.`
  window.open(`https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
}
