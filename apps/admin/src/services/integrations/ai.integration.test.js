import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  buildAggregateMetrics,
  buildChatPayload,
  buildPerformancePayload,
  createAIIntegrationClient,
} from './ai.core.js'

const SECRET_SENTINEL = 'H04_SECRET_SENTINEL_NUNCA_PUBLICAR_123'
const CLIENT_SENTINEL = 'CLIENTE_REAL_NAO_DEVE_SAIR'
const EMAIL_SENTINEL = 'EMAIL_NAO_DEVE_SAIR@example.test'
const PORTAL_SENTINEL = 'PORTAL_TOKEN_NAO_DEVE_SAIR'
const ID_SENTINEL = 'ID_INTERNO_NAO_DEVE_SAIR'

const clients = [
  {
    id: ID_SENTINEL,
    name: CLIENT_SENTINEL,
    email: EMAIL_SENTINEL,
    portalToken: PORTAL_SENTINEL,
  },
]
const posts = [
  {
    id: 'post-internal-id',
    client_id: ID_SENTINEL,
    _status: 'approved',
    caption: CLIENT_SENTINEL,
  },
]

test('frontend builds only aggregate and pseudonymous AI payloads', () => {
  const aggregate = buildAggregateMetrics({ posts, clients })
  assert.deepEqual(aggregate, {
    totalPosts: 1,
    approved: 1,
    rejected: 0,
    pending: 0,
    clientCount: 1,
    clients: [{ label: 'Cliente 1', total: 1, approved: 1 }],
  })

  const performance = buildPerformancePayload({ posts, clients, period: 'month' })
  const chat = buildChatPayload(
    `Como melhorar ${CLIENT_SENTINEL} ${EMAIL_SENTINEL} ${PORTAL_SENTINEL} ${ID_SENTINEL}?`,
    { posts, clients, period: 'week' },
  )
  for (const payload of [performance, chat]) {
    const serialized = JSON.stringify(payload)
    for (const forbidden of [
      SECRET_SENTINEL,
      CLIENT_SENTINEL,
      EMAIL_SENTINEL,
      PORTAL_SENTINEL,
      ID_SENTINEL,
      'post-internal-id',
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
  }
})

test('frontend client calls only the Postinder endpoint without external authorization', async () => {
  const calls = []
  const client = createAIIntegrationClient({
    async post(path, body) {
      calls.push({ path, body })
      if (body.action === 'performance') {
        return { data: { data: { action: 'performance', result: { score: 90 } } } }
      }
      return { data: { data: { action: 'chat', answer: 'Resposta' } } }
    },
  })

  assert.deepEqual(
    await client.analyzePerformance({ posts, clients, period: 'year' }),
    { score: 90 },
  )
  assert.equal(
    await client.chatWithMetrics('Pergunta', { posts, clients, period: 'month' }),
    'Resposta',
  )
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.path, '/integrations/ai-insights')
    assert.equal('apiKey' in call.body, false)
    assert.equal('providerUrl' in call.body, false)
    assert.equal('model' in call.body, false)
    assert.equal('authorization' in call.body, false)
  }
})

test('frontend maps backend failures without reflecting upstream details', async () => {
  const client = createAIIntegrationClient({
    async post() {
      throw {
        response: {
          status: 502,
          data: { error: `raw-${SECRET_SENTINEL}` },
        },
      }
    },
  })
  await assert.rejects(
    () => client.analyzePerformance({ posts, clients, period: 'month' }),
    error =>
      /temporariamente indisponível/.test(error.message)
      && !error.message.includes(SECRET_SENTINEL),
  )
})

test('integration sources contain no frontend secret configuration or direct provider request', () => {
  const sources = [
    readFileSync(new URL('./registry.js', import.meta.url), 'utf8'),
    readFileSync(new URL('./ai.integration.js', import.meta.url), 'utf8'),
    readFileSync(new URL('./ai.core.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../../components/ai/AIInsightsPanel.jsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../../features/settings/IntegrationsPage.jsx', import.meta.url), 'utf8'),
  ].join('\n')

  for (const forbidden of [
    'VITE_ANTHROPIC_API_KEY',
    'VITE_ZAPI_TOKEN',
    'VITE_TWILIO_TOKEN',
    'VITE_GHL_API_KEY',
    'VITE_CANVA_CLIENT_SECRET',
    'VITE_RESEND_API_KEY',
    'api.anthropic.com/v1/messages',
    "'x-api-key'",
  ]) {
    assert.equal(sources.includes(forbidden), false, forbidden)
  }

  const viteVariables = [...sources.matchAll(/VITE_[A-Z0-9_]+/g)].map(match => match[0])
  assert.deepEqual([...new Set(viteVariables)], ['VITE_GA_MEASUREMENT_ID'])
})
