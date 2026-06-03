import { Plug, CheckCircle, XCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react'
import { INTEGRATIONS } from '../../services/integrations/registry'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { useState } from 'react'

const CATEGORY_LABELS = {
  ai:        { label: 'Inteligência Artificial', icon: '🤖' },
  messaging: { label: 'Mensageria',              icon: '💬' },
  crm:       { label: 'CRM',                    icon: '📊' },
  design:    { label: 'Design',                 icon: '🎨' },
  email:     { label: 'E-mail',                 icon: '✉️' },
  analytics: { label: 'Analytics',              icon: '📈' },
}

const ENV_INSTRUCTIONS = {
  VITE_ANTHROPIC_API_KEY: 'console.anthropic.com → API Keys',
  VITE_ZAPI_INSTANCE:     'developer.z-api.io → Instâncias',
  VITE_ZAPI_TOKEN:        'developer.z-api.io → Token da instância',
  VITE_TWILIO_SID:        'console.twilio.com → Account SID',
  VITE_TWILIO_TOKEN:      'console.twilio.com → Auth Token',
  VITE_TWILIO_FROM:       'Ex: whatsapp:+14155238886',
  VITE_GHL_API_KEY:       'GoHighLevel → Settings → API Keys',
  VITE_GHL_LOCATION_ID:   'GoHighLevel → Settings → Business Info → Location ID',
  VITE_CANVA_CLIENT_ID:   'canva.com/developers → Apps → Client ID',
  VITE_CANVA_CLIENT_SECRET:'canva.com/developers → Apps → Client Secret',
  VITE_RESEND_API_KEY:    'resend.com → API Keys',
  VITE_GA_MEASUREMENT_ID: 'analytics.google.com → Admin → Measurement ID',
}

function IntegrationCard({ name, description, icon, enabled, envKeys, docs, category }) {
  const [showEnv, setShowEnv] = useState(false)

  return (
    <Card className={`p-5 transition-all ${enabled ? 'border-green-300 dark:border-green-800' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="font-bold text-sm">{name}</div>
            <div className="text-xs text-neutral-400">{description}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
          enabled
            ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
        }`}>
          {enabled ? <><CheckCircle size={12}/> Ativo</> : <><XCircle size={12}/> Inativo</>}
        </div>
      </div>

      {!enabled && (
        <div>
          <button
            onClick={() => setShowEnv(v => !v)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-mag-500 transition-colors mb-2"
          >
            {showEnv ? <EyeOff size={12}/> : <Eye size={12}/>}
            {showEnv ? 'Ocultar configuração' : 'Como ativar'}
          </button>

          {showEnv && (
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 text-xs space-y-2">
              <p className="font-semibold text-neutral-600 dark:text-neutral-300 mb-3">
                Adicione as seguintes variáveis no arquivo <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">.env</code>:
              </p>
              {envKeys.map(key => (
                <div key={key} className="flex items-start gap-2 bg-white dark:bg-neutral-900 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                  <code className="text-mag-600 dark:text-mag-400 font-mono flex-shrink-0">{key}=</code>
                  <span className="text-neutral-400 italic">{ENV_INSTRUCTIONS[key] || 'Consulte a documentação'}</span>
                </div>
              ))}
              <p className="text-neutral-400 pt-1">
                Após configurar, reinicie o servidor com <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">npm run dev</code>
              </p>
              {docs && (
                <a href={docs} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-teal-500 hover:underline mt-1">
                  <ExternalLink size={11}/> Documentação oficial
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {enabled && docs && (
        <a href={docs} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-teal-500 hover:underline mt-1">
          <ExternalLink size={11}/> Documentação
        </a>
      )}
    </Card>
  )
}

export default function IntegrationsPage() {
  const byCategory = Object.entries(INTEGRATIONS).reduce((acc, [key, integration]) => {
    const cat = integration.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ key, ...integration })
    return acc
  }, {})

  const totalEnabled  = Object.values(INTEGRATIONS).filter(i => i.enabled).length
  const totalIntegrations = Object.keys(INTEGRATIONS).length

  return (
    <div>
      <PageHeader
        icon={Plug}
        title="Integracoes"
        subtitle="Conecte o Postinder com WhatsApp, CRM, IA e outras ferramentas. Cada integracao e independente."
      />

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <strong className="text-green-600">{totalEnabled}</strong>
            <span className="text-neutral-400"> de </span>
            <strong>{totalIntegrations}</strong>
            <span className="text-neutral-400"> integrações ativas</span>
          </div>
          <div className="flex-1 mx-4 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${totalIntegrations ? totalEnabled/totalIntegrations*100 : 0}%` }} />
          </div>
          <span className="text-xs text-neutral-400">{totalIntegrations ? Math.round(totalEnabled/totalIntegrations*100) : 0}%</span>
        </div>
      </Card>

      <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-700 dark:text-blue-400 text-sm mb-2">📋 Como configurar uma integração</h3>
        <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
          <li>1. Clique em <strong>"Como ativar"</strong> na integração desejada</li>
          <li>2. Crie a conta no serviço e obtenha as credenciais indicadas</li>
          <li>3. Abra o arquivo <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env</code> na pasta do projeto</li>
          <li>4. Adicione as variáveis com os valores obtidos</li>
          <li>5. Reinicie o servidor: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">npm run dev</code></li>
        </ol>
      </Card>

      {Object.entries(byCategory).map(([category, integrations]) => {
        const catInfo = CATEGORY_LABELS[category] || { label: category, icon: '🔌' }
        return (
          <div key={category} className="mb-8">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <span>{catInfo.icon}</span>
              <span>{catInfo.label}</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {integrations.map(i => <IntegrationCard key={i.key} {...i} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
