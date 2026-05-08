// supabase/functions/send-approval-email/index.ts
// Envia e-mail com link de aprovação para o cliente via Resend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clientId, postTitle, approvalLink, postCount } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client data
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('name, email')
      .eq('id', clientId)
      .single()

    if (error || !client) {
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch email config
    const { data: emailCfg } = await supabaseAdmin
      .from('email_config')
      .select('*')
      .single()

    const senderName   = emailCfg?.sender_name   || '20Cinco Comunicação'
    const replyTo      = emailCfg?.reply_to       || 'contato@20cin.co'
    const subject      = emailCfg?.subject        || 'Você tem conteúdos aguardando aprovação!'
    const bodyTemplate = emailCfg?.body_template  || 'Seus conteúdos estão prontos para revisão.'

    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY não configurada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build HTML email
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e2e2">
        <div style="background:#A7014B;padding:28px 32px">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900">🔥 Postinder</h1>
          <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px">${senderName}</p>
        </div>
        <div style="padding:32px">
          <p style="font-size:16px;color:#1a1a1a">Olá, <strong>${client.name}</strong>!</p>
          <p style="color:#666;line-height:1.6;font-size:14px">${bodyTemplate}</p>
          <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin:20px 0;text-align:center">
            <p style="color:#666;font-size:13px;margin:0 0 12px">
              Você tem <strong style="color:#A7014B">${postCount || 1} postagem(ns)</strong> aguardando sua aprovação.
            </p>
            <a href="${approvalLink}"
              style="display:inline-block;background:#A7014B;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
              Revisar agora →
            </a>
          </div>
          <p style="color:#999;font-size:12px">Sem login necessário. Acesse pelo link acima a qualquer momento.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px 32px;text-align:center">
          <p style="color:#aaa;font-size:11px;margin:0">Postinder · ${senderName} · 2025</p>
        </div>
      </div>
    `

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${senderName} <noreply@postinder.app>`,
        to:      [client.email],
        subject,
        html,
        reply_to: replyTo,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: result.message || 'Erro ao enviar e-mail.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log notification
    await supabaseAdmin.from('notifications').insert({
      client_id:   clientId,
      type:        'email_sent',
      title:       'E-mail enviado',
      description: `Link de aprovação enviado para ${client.email}`,
    })

    return new Response(
      JSON.stringify({ sent: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
