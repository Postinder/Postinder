// src/services/integrations/email.integration.js
// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO: Resend (e-mail transacional)
//
// Para ativar:
// 1. Acesse https://resend.com e crie uma conta gratuita
// 2. Verifique seu domínio de envio
// 3. Crie uma API Key
// 4. Adicione no .env: VITE_RESEND_API_KEY=re_xxxx
//
// Plano gratuito: 3.000 e-mails/mês, 100/dia — suficiente para começar
// ─────────────────────────────────────────────────────────────────

import { isEnabled } from './registry'

const API_KEY = import.meta.env.VITE_RESEND_API_KEY

// ── Core send function ──
async function sendEmail({ to, subject, html, from = '20Cinco Comunicação <noreply@20cin.co>' }) {
  if (!isEnabled('resend')) {
    console.warn('Resend não configurado. E-mail não enviado para:', to)
    return { simulated: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Resend error: ${res.status}`)
  }

  return res.json()
}

// ── Template: Approval link ──
export function sendApprovalEmail({ to, clientName, approvalLink, postCount, senderName, bodyTemplate }) {
  const subject = `Você tem ${postCount} conteúdo(s) aguardando aprovação!`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e2e2">
      <div style="background:#A7014B;padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900">🔥 Postinder</h1>
        <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px">${senderName || '20Cinco Comunicação'}</p>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px;color:#1a1a1a">Olá, <strong>${clientName}</strong>!</p>
        <p style="color:#666;line-height:1.6;font-size:14px">${bodyTemplate || 'Seus conteúdos da semana estão prontos para revisão.'}</p>
        <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin:20px 0;text-align:center">
          <p style="color:#666;font-size:13px;margin:0 0 12px">Você tem <strong style="color:#A7014B">${postCount} postagem(ns)</strong> aguardando sua aprovação.</p>
          <a href="${approvalLink}" style="display:inline-block;background:#A7014B;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Revisar agora →
          </a>
        </div>
        <p style="color:#999;font-size:12px">Sem login necessário. Acesse pelo link acima a qualquer momento.</p>
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;text-align:center">
        <p style="color:#aaa;font-size:11px;margin:0">Postinder · 20Cinco Comunicação · 2025</p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}

// ── Template: Post rejected notification (to agency) ──
export function sendRejectionAlert({ to, postTitle, clientName, feedbackTags, comment }) {
  const subject = `⚠️ ${clientName} recusou: "${postTitle}"`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#dc2626">Conteúdo recusado</h2>
      <p><strong>${clientName}</strong> recusou o post <em>"${postTitle}"</em>.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
        <p style="color:#dc2626;font-weight:600;margin:0 0 8px">Motivos:</p>
        <p style="margin:0">${feedbackTags?.join(', ') || '—'}</p>
        ${comment ? `<p style="margin:8px 0 0;color:#666;font-style:italic">"${comment}"</p>` : ''}
      </div>
      <p>Acesse o Postinder para corrigir e reenviar.</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}
