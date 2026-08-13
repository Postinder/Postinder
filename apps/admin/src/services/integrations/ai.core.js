const AI_ENDPOINT = '/integrations/ai-insights'
const ALLOWED_PERIODS = new Set(['week', 'month', 'year'])

function normalizePeriod(period) {
  return ALLOWED_PERIODS.has(period) ? period : 'month'
}

function statusOf(post) {
  return post?._status || post?.status || ''
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function minimizeQuestion(question, clients) {
  let minimized = String(question || '').trim()
  clients.slice(0, 100).forEach((client, index) => {
    const replacements = [
      [client?.name, `Cliente ${index + 1}`],
      [client?.email, '[dado removido]'],
      [client?.whatsapp, '[dado removido]'],
      [client?.id, '[dado removido]'],
      [client?.portalToken, '[dado removido]'],
      [client?.portal_token, '[dado removido]'],
    ]
    for (const [rawValue, replacement] of replacements) {
      if (typeof rawValue !== 'string' || rawValue.length < 3) continue
      minimized = minimized.replace(
        new RegExp(escapeRegExp(rawValue), 'gi'),
        replacement,
      )
    }
  })
  return minimized
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[dado removido]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [dado removido]')
    .slice(0, 500)
}

export function buildAggregateMetrics({ posts = [], clients = [] } = {}) {
  const approved = posts.filter(post => statusOf(post) === 'approved').length
  const rejected = posts.filter(post => statusOf(post) === 'rejected').length
  const pending = posts.filter(post => statusOf(post) === 'pending').length

  return {
    totalPosts: posts.length,
    approved,
    rejected,
    pending,
    clientCount: clients.length,
    clients: clients.slice(0, 100).map((client, index) => {
      const clientPosts = posts.filter(post => post.client_id === client.id)
      return {
        label: `Cliente ${index + 1}`,
        total: clientPosts.length,
        approved: clientPosts.filter(post => statusOf(post) === 'approved').length,
      }
    }),
  }
}

export function buildPerformancePayload({ posts = [], clients = [], period } = {}) {
  return {
    action: 'performance',
    period: normalizePeriod(period),
    metrics: buildAggregateMetrics({ posts, clients }),
  }
}

export function buildChatPayload(question, { posts = [], clients = [], period } = {}) {
  return {
    action: 'chat',
    question: minimizeQuestion(question, clients),
    period: normalizePeriod(period),
    metrics: buildAggregateMetrics({ posts, clients }),
  }
}

function safeIntegrationError(error) {
  const status = error?.response?.status
  if (status === 400) return new Error('Os dados selecionados não puderam ser processados.')
  if (status === 401) return new Error('Sua sessão expirou. Entre novamente.')
  if (status === 403) return new Error('Acesso insuficiente para executar a análise.')
  if (status === 429) return new Error('Muitas solicitações. Tente novamente em instantes.')
  if (status === 502) return new Error('O provedor de IA está temporariamente indisponível.')
  if (status === 503) return new Error('A integração de IA não está configurada.')
  if (status === 504 || error?.code === 'ECONNABORTED') {
    return new Error('A análise excedeu o tempo limite.')
  }
  return new Error('Não foi possível executar a análise de IA.')
}

export function createAIIntegrationClient(httpClient) {
  async function execute(payload) {
    try {
      const response = await httpClient.post(AI_ENDPOINT, payload)
      return response.data?.data
    } catch (error) {
      throw safeIntegrationError(error)
    }
  }

  return {
    async analyzePerformance(input) {
      const data = await execute(buildPerformancePayload(input))
      return data?.result
    },
    async chatWithMetrics(question, context) {
      const data = await execute(buildChatPayload(question, context))
      return data?.answer || ''
    },
  }
}
