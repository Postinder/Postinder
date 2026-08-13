import { Plug, CheckCircle, XCircle, ExternalLink, Server } from 'lucide-react'
import { INTEGRATIONS } from '../../services/integrations/registry'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'

const CATEGORY_LABELS = {
  ai:        { label: 'Inteligência Artificial', icon: '🤖' },
  messaging: { label: 'Mensageria',              icon: '💬' },
  crm:       { label: 'CRM',                    icon: '📊' },
  design:    { label: 'Design',                 icon: '🎨' },
  email:     { label: 'E-mail',                 icon: '✉️' },
  analytics: { label: 'Analytics',              icon: '📈' },
}

function IntegrationCard({
  name,
  description,
  icon,
  enabled,
  configuration,
  configurationNote,
  publicEnvKeys = [],
  docs,
}) {
  const serverManaged = configuration === 'backend'
  const unavailable = configuration === 'unavailable'

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
          serverManaged
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
            : enabled
            ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
        }`}>
          {serverManaged
            ? <><Server size={12}/> Server-side</>
            : enabled
              ? <><CheckCircle size={12}/> Ativo</>
              : <><XCircle size={12}/> Indisponível</>}
        </div>
      </div>

      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 text-xs text-neutral-500 dark:text-neutral-400">
        {configurationNote}
        {publicEnvKeys.length > 0 && (
          <div className="mt-2">
            Configuração pública permitida: <code className="font-mono">{publicEnvKeys.join(', ')}</code>
          </div>
        )}
        {unavailable && (
          <div className="mt-2 font-medium">
            Nenhuma credencial deve ser adicionada ao frontend.
          </div>
        )}
      </div>

      {docs && (
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
        <h3 className="font-semibold text-blue-700 dark:text-blue-400 text-sm mb-2">🔒 Configuração segura</h3>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Integrações que exigem credenciais privadas são configuradas exclusivamente no backend.
          O frontend aceita apenas identificadores explicitamente públicos.
        </p>
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
