// supabase/functions/send-whatsapp/index.ts
// Envia mensagem WhatsApp via Z-API com link de aprovação

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clientId, approvalLink, postCount, customMessage } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch client
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('name, whatsapp')
      .eq('id', clientId)
      .single()

    if (error || !client) {
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!client.whatsapp) {
      return new Response(
        JSON.stringify({ error: 'Cliente não possui WhatsApp cadastrado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const zapiInstance = Deno.env.get('ZAPI_INSTANCE')
    const zapiToken    = Deno.env.get('ZAPI_TOKEN')

    if (!zapiInstance || !zapiToken) {
      return new Response(
        JSON.stringify({ error: 'Z-API não configurada. Adicione ZAPI_INSTANCE e ZAPI_TOKEN nos secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build message
    const phone   = client.whatsapp.replace(/\D/g, '')
    const message = customMessage || 
      `Olá ${client.name}! 🔥\n\nVocê tem *${postCount || 1} conteúdo(s)* aguardando sua aprovação no Postinder.\n\nAcesse agora:\n${approvalLink}\n\n✅ Sem login necessário. Deslize para aprovar ou recusar cada arquivo.`

    // Send via Z-API
    const res = await fetch(
      `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      }
    )

    const result = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: result.message || 'Erro ao enviar WhatsApp.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log notification
    await supabaseAdmin.from('notifications').insert({
      client_id:   clientId,
      type:        'whatsapp_sent',
      title:       'WhatsApp enviado',
      description: `Link de aprovação enviado para ${client.whatsapp}`,
    })

    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
