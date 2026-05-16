// src/services/integrations/registry.js
// ─────────────────────────────────────────────────────────────────
// POSTINDER — Central de Integrações
//
// Como adicionar uma nova integração:
// 1. Crie um arquivo em src/services/integrations/nome.integration.js
// 2. Registre aqui com enabled: false
// 3. Configure as credenciais no .env
// 4. Implemente os métodos no arquivo da integração
//
// Nenhuma integração quebra o sistema se estiver desabilitada.
// ─────────────────────────────────────────────────────────────────

export const INTEGRATIONS = {

  // ── IA / Claude (Anthropic) ──────────────────────────────────
  ai: {
    name:        'Claude AI (Anthropic)',
    description: 'Análise inteligente de métricas e feedbacks',
    icon:        '🤖',
    enabled:     !!import.meta.env.VITE_ANTHROPIC_API_KEY,
    envKeys:     ['VITE_ANTHROPIC_API_KEY'],
    docs:        'https://docs.anthropic.com',
    category:    'ai',
  },

  // ── WhatsApp ─────────────────────────────────────────────────
  whatsapp_zapi: {
    name:        'WhatsApp via Z-API',
    description: 'Envio automático de avisos de aprovação via WhatsApp',
    icon:        '📱',
    enabled:     !!(import.meta.env.VITE_ZAPI_INSTANCE && import.meta.env.VITE_ZAPI_TOKEN),
    envKeys:     ['VITE_ZAPI_INSTANCE', 'VITE_ZAPI_TOKEN'],
    docs:        'https://developer.z-api.io',
    category:    'messaging',
  },

  whatsapp_twilio: {
    name:        'WhatsApp via Twilio',
    description: 'Alternativa ao Z-API para envio de WhatsApp',
    icon:        '📱',
    enabled:     !!(import.meta.env.VITE_TWILIO_SID && import.meta.env.VITE_TWILIO_TOKEN),
    envKeys:     ['VITE_TWILIO_SID', 'VITE_TWILIO_TOKEN', 'VITE_TWILIO_FROM'],
    docs:        'https://www.twilio.com/docs/whatsapp',
    category:    'messaging',
  },

  // ── CRM ──────────────────────────────────────────────────────
  gohighlevel: {
    name:        'GoHighLevel',
    description: 'Sincronizar clientes e contatos com o GHL CRM',
    icon:        '📊',
    enabled:     !!import.meta.env.VITE_GHL_API_KEY,
    envKeys:     ['VITE_GHL_API_KEY', 'VITE_GHL_LOCATION_ID'],
    docs:        'https://highlevel.stoplight.io',
    category:    'crm',
  },

  // ── Design ───────────────────────────────────────────────────
  canva: {
    name:        'Canva',
    description: 'Importar designs direto do Canva para aprovação',
    icon:        '🎨',
    enabled:     !!import.meta.env.VITE_CANVA_CLIENT_ID,
    envKeys:     ['VITE_CANVA_CLIENT_ID', 'VITE_CANVA_CLIENT_SECRET'],
    docs:        'https://www.canva.com/developers',
    category:    'design',
  },

  // ── E-mail ───────────────────────────────────────────────────
  resend: {
    name:        'Resend',
    description: 'Envio de e-mails transacionais com templates',
    icon:        '✉️',
    enabled:     !!import.meta.env.VITE_RESEND_API_KEY,
    envKeys:     ['VITE_RESEND_API_KEY'],
    docs:        'https://resend.com/docs',
    category:    'email',
  },

  // ── Analytics ────────────────────────────────────────────────
  analytics: {
    name:        'Google Analytics',
    description: 'Rastreamento de uso da plataforma',
    icon:        '📈',
    enabled:     !!import.meta.env.VITE_GA_MEASUREMENT_ID,
    envKeys:     ['VITE_GA_MEASUREMENT_ID'],
    docs:        'https://developers.google.com/analytics',
    category:    'analytics',
  },
}

// ── Check if integration is available ──
export function isEnabled(key) {
  return INTEGRATIONS[key]?.enabled === true
}

// ── Get all enabled integrations ──
export function getEnabled() {
  return Object.entries(INTEGRATIONS)
    .filter(([, v]) => v.enabled)
    .map(([key, v]) => ({ key, ...v }))
}

// ── Get integrations by category ──
export function getByCategory(category) {
  return Object.entries(INTEGRATIONS)
    .filter(([, v]) => v.category === category)
    .map(([key, v]) => ({ key, ...v }))
}
