// This registry contains presentation metadata only. Secret-backed integrations
// are configured and executed on the backend or remain unavailable.
export const INTEGRATIONS = {
  ai: {
    name: 'Claude AI (Anthropic)',
    description: 'Análise inteligente de métricas agregadas',
    icon: '🤖',
    enabled: false,
    configuration: 'backend',
    configurationNote: 'Credencial e chamada gerenciadas exclusivamente pelo backend.',
    docs: 'https://docs.anthropic.com',
    category: 'ai',
  },
  whatsapp_zapi: {
    name: 'WhatsApp via Z-API',
    description: 'Envio de avisos de aprovação via backend',
    icon: '📱',
    enabled: false,
    configuration: 'backend',
    configurationNote: 'Configuração opcional gerenciada exclusivamente pelo backend.',
    docs: 'https://developer.z-api.io',
    category: 'messaging',
  },
  whatsapp_twilio: {
    name: 'WhatsApp via Twilio',
    description: 'Integração ainda não implementada',
    icon: '📱',
    enabled: false,
    configuration: 'unavailable',
    configurationNote: 'Indisponível até existir um fluxo server-side.',
    docs: 'https://www.twilio.com/docs/whatsapp',
    category: 'messaging',
  },
  gohighlevel: {
    name: 'GoHighLevel',
    description: 'Integração ainda não implementada',
    icon: '📊',
    enabled: false,
    configuration: 'unavailable',
    configurationNote: 'Indisponível até existir um fluxo server-side.',
    docs: 'https://highlevel.stoplight.io',
    category: 'crm',
  },
  canva: {
    name: 'Canva',
    description: 'Integração ainda não implementada',
    icon: '🎨',
    enabled: false,
    configuration: 'unavailable',
    configurationNote: 'Indisponível até existir um fluxo OAuth seguro.',
    docs: 'https://www.canva.com/developers',
    category: 'design',
  },
  resend: {
    name: 'Resend',
    description: 'Integração ainda não implementada',
    icon: '✉️',
    enabled: false,
    configuration: 'unavailable',
    configurationNote: 'Indisponível até existir um fluxo server-side.',
    docs: 'https://resend.com/docs',
    category: 'email',
  },
  analytics: {
    name: 'Google Analytics',
    description: 'Identificador público de medição',
    icon: '📈',
    enabled: Boolean(import.meta.env.VITE_GA_MEASUREMENT_ID),
    configuration: 'public',
    publicEnvKeys: ['VITE_GA_MEASUREMENT_ID'],
    configurationNote: 'O Measurement ID é público e não autoriza operações administrativas.',
    docs: 'https://developers.google.com/analytics',
    category: 'analytics',
  },
}

export function isEnabled(key) {
  return INTEGRATIONS[key]?.enabled === true
}

export function getEnabled() {
  return Object.entries(INTEGRATIONS)
    .filter(([, integration]) => integration.enabled)
    .map(([key, integration]) => ({ key, ...integration }))
}

export function getByCategory(category) {
  return Object.entries(INTEGRATIONS)
    .filter(([, integration]) => integration.category === category)
    .map(([key, integration]) => ({ key, ...integration }))
}
