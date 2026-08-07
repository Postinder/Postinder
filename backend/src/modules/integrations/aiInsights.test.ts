import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_MODE = 'production'
process.env.ENABLE_DEMO_RESET = 'false'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_h04'
process.env.JWT_SECRET = 'h04-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

const SECRET_SENTINEL = 'H04_SECRET_SENTINEL_NUNCA_PUBLICAR_123'
const CLIENT_SENTINEL = 'CLIENTE_REAL_NAO_DEVE_SAIR'
const EMAIL_SENTINEL = 'EMAIL_NAO_DEVE_SAIR@example.test'
const PORTAL_SENTINEL = 'PORTAL_TOKEN_NAO_DEVE_SAIR'
const ID_SENTINEL = 'ID_INTERNO_NAO_DEVE_SAIR'

const metrics = {
  totalPosts: 10,
  approved: 6,
  rejected: 2,
  pending: 2,
  clientCount: 2,
  clients: [
    { label: 'Cliente 1', total: 6, approved: 4 },
    { label: 'Cliente 2', total: 4, approved: 2 },
  ],
}

const performanceResponse = JSON.stringify({
  score: 80,
  classificacao: 'Bom',
  resumo: 'Desempenho consistente.',
  pontos_fortes: ['Boa taxa de aprovação.'],
  pontos_atencao: ['Acompanhar pendências.'],
  recomendacoes: ['Revisar itens pendentes.'],
  cliente_destaque: 'Cliente 1',
  cliente_atencao: 'Cliente 2',
})

function validPerformanceBody() {
  return { action: 'performance', period: 'month', metrics }
}

test('service validates strict minimized input and sanitizes provider output', async t => {
  const [{ AIInsightsService }, { AppException }] = await Promise.all([
    import('./application/AIInsightsService'),
    import('../../shared/exceptions/AppException'),
  ])

  const providerRequests: any[] = []
  const provider = {
    async generate(request: unknown) {
      providerRequests.push(request)
      return performanceResponse
    },
  }
  const service = new AIInsightsService(provider)

  await t.test('performance uses only aggregate and pseudonymous metrics', async () => {
    const result = await service.generate(validPerformanceBody())
    assert.equal(result.action, 'performance')
    assert.equal(result.result.score, 80)
    assert.equal(providerRequests.length, 1)

    const serialized = JSON.stringify(providerRequests[0])
    assert.match(serialized, /Cliente 1/)
    for (const forbidden of [
      SECRET_SENTINEL,
      CLIENT_SENTINEL,
      EMAIL_SENTINEL,
      PORTAL_SENTINEL,
      ID_SENTINEL,
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
  })

  await t.test('chat sends the bounded question and aggregate context without client labels', async () => {
    provider.generate = async (request: unknown) => {
      providerRequests.push(request)
      return 'Resposta segura'
    }
    const result = await service.generate({
      action: 'chat',
      question: 'Como melhorar a taxa de aprovação?',
      period: 'week',
      metrics,
    })
    assert.deepEqual(result, { action: 'chat', answer: 'Resposta segura' })
    const serialized = JSON.stringify(providerRequests.at(-1))
    assert.equal(serialized.includes('Cliente 1'), false)
    assert.match(serialized, /Como melhorar/)
  })

  for (const [name, invalid] of [
    ['secret in body', { ...validPerformanceBody(), apiKey: SECRET_SENTINEL }],
    ['provider URL in body', { ...validPerformanceBody(), providerUrl: 'https://provider.invalid' }],
    ['model in body', { ...validPerformanceBody(), model: 'arbitrary-model' }],
    ['internal identifier', { ...validPerformanceBody(), clientId: ID_SENTINEL }],
    ['raw client data', { ...validPerformanceBody(), clientName: CLIENT_SENTINEL }],
    ['unknown action', { ...validPerformanceBody(), action: 'arbitrary' }],
    ['excessive question', {
      action: 'chat',
      question: 'x'.repeat(501),
      period: 'month',
      metrics,
    }],
  ] as const) {
    await t.test(name, async () => {
      const callsBefore = providerRequests.length
      await assert.rejects(() => service.generate(invalid))
      assert.equal(providerRequests.length, callsBefore)
    })
  }

  await t.test('malformed provider content is not reflected', async () => {
    const malformedService = new AIInsightsService({
      async generate() {
        return `not-json-${SECRET_SENTINEL}`
      },
    })
    await assert.rejects(
      () => malformedService.generate(validPerformanceBody()),
      (error: any) =>
        error instanceof AppException
        && error.statusCode === 502
        && !error.message.includes(SECRET_SENTINEL),
    )
  })
})

test('Anthropic adapter keeps configuration server-side and fails safely', async t => {
  const [{ AnthropicAIProvider }, { AppException }] = await Promise.all([
    import('./infrastructure/AnthropicAIProvider'),
    import('../../shared/exceptions/AppException'),
  ])
  const request = { system: 'System', prompt: 'Prompt', maxTokens: 100 }

  for (const [name, options] of [
    ['missing key', {}],
    ['empty key', { apiKey: '   ' }],
    ['invalid model', { apiKey: SECRET_SENTINEL, model: 'unapproved-model' }],
    ['invalid timeout', { apiKey: SECRET_SENTINEL, timeoutMs: 'invalid' }],
  ] as const) {
    await t.test(name, async () => {
      let fetchCalls = 0
      const provider = new AnthropicAIProvider(options, (async () => {
        fetchCalls += 1
        throw new Error('must not be called')
      }) as typeof fetch)
      await assert.rejects(
        () => provider.generate(request),
        (error: any) => error instanceof AppException && error.statusCode === 503,
      )
      assert.equal(fetchCalls, 0)
    })
  }

  await t.test('success uses the fixed URL, allowlisted model and backend-only authorization', async () => {
    let capturedUrl = ''
    let capturedOptions: RequestInit | undefined
    const provider = new AnthropicAIProvider(
      { apiKey: SECRET_SENTINEL },
      (async (url: string | URL | Request, options?: RequestInit) => {
        capturedUrl = String(url)
        capturedOptions = options
        return new Response(JSON.stringify({
          content: [{ type: 'text', text: 'Resposta segura' }],
        }), { status: 200 })
      }) as typeof fetch,
    )

    assert.equal(await provider.generate(request), 'Resposta segura')
    assert.equal(capturedUrl, 'https://api.anthropic.com/v1/messages')
    assert.equal((capturedOptions?.headers as any)['x-api-key'], SECRET_SENTINEL)
    const upstreamBody = JSON.parse(String(capturedOptions?.body))
    assert.equal(upstreamBody.model, 'claude-sonnet-4-20250514')
    assert.equal(upstreamBody.messages[0].content, 'Prompt')
  })

  for (const status of [401, 403, 429, 500]) {
    await t.test(`upstream ${status} is generic`, async () => {
      const provider = new AnthropicAIProvider(
        { apiKey: SECRET_SENTINEL },
        (async () => new Response(
          JSON.stringify({ error: { message: `raw-${SECRET_SENTINEL}` } }),
          { status },
        )) as typeof fetch,
      )
      await assert.rejects(
        () => provider.generate(request),
        (error: any) =>
          error instanceof AppException
          && error.statusCode === 502
          && !error.message.includes(SECRET_SENTINEL),
      )
    })
  }

  await t.test('network failure is generic', async () => {
    const provider = new AnthropicAIProvider(
      { apiKey: SECRET_SENTINEL },
      (async () => {
        throw new Error(`network-${SECRET_SENTINEL}`)
      }) as typeof fetch,
    )
    await assert.rejects(
      () => provider.generate(request),
      (error: any) =>
        error instanceof AppException
        && error.statusCode === 502
        && !error.message.includes(SECRET_SENTINEL),
    )
  })

  await t.test('timeout abort is converted to a safe 504', async () => {
    const provider = new AnthropicAIProvider(
      { apiKey: SECRET_SENTINEL, timeoutMs: 1000 },
      (async (_url: string | URL | Request, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })) as typeof fetch,
    )
    await assert.rejects(
      () => provider.generate(request),
      (error: any) => error instanceof AppException && error.statusCode === 504,
    )
  })

  await t.test('malformed response is a safe 502', async () => {
    const provider = new AnthropicAIProvider(
      { apiKey: SECRET_SENTINEL },
      (async () => new Response('not-json', { status: 200 })) as typeof fetch,
    )
    await assert.rejects(
      () => provider.generate(request),
      (error: any) => error instanceof AppException && error.statusCode === 502,
    )
  })
})

test('real HTTP endpoint composes C-01 and H-03 before the provider', async () => {
  const [
    { createApp },
    { env },
    { JwtProvider },
    { AIInsightsService },
    { AIInsightsController },
    { AnthropicAIProvider },
  ] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
    import('../../modules/auth/infrastructure/JwtProvider'),
    import('./application/AIInsightsService'),
    import('./presentation/controllers/AIInsightsController'),
    import('./infrastructure/AnthropicAIProvider'),
  ])

  let providerCalls = 0
  let controllerCalls = 0
  const provider = {
    async generate(request: any) {
      providerCalls += 1
      return request.prompt.includes('Pergunta do usuário')
        ? 'Resposta segura'
        : performanceResponse
    },
  }
  const controller = new AIInsightsController(new AIInsightsService(provider))
  const originalGenerate = controller.generate.bind(controller)
  controller.generate = async (req, res) => {
    controllerCalls += 1
    return originalGenerate(req, res)
  }

  const app = createApp({
    runtimeEnvironment: {
      ...env,
      DEPLOYMENT_MODE: 'production',
      ENABLE_DEMO_RESET: 'false',
    },
    aiInsightsController: controller,
  })
  const server: Server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const { port } = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${port}`
  const originalConsoleError = console.error
  const capturedLogs: string[] = []
  console.error = (...args: unknown[]) => {
    capturedLogs.push(JSON.stringify(args))
  }

  const jwt = new JwtProvider()
  const adminToken = jwt.sign({
    type: 'admin',
    userId: 'admin-id',
    email: 'admin@test.invalid',
    role: 'admin',
  }, '5m')
  const tokenForRole = (role: string) => jwt.sign({
    type: 'admin',
    userId: `${role}-id`,
    email: `${role}@test.invalid`,
    role,
  }, '5m')
  const clientToken = jwt.sign({
    type: 'client',
    clientId: 'client-id',
    email: 'client@test.invalid',
  }, '5m')

  async function post(
    token: string | undefined,
    body: unknown,
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(`${baseUrl}/api/v1/integrations/ai-insights`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    }
  }

  try {
    const allowed = await post(adminToken, validPerformanceBody())
    assert.equal(allowed.status, 200)
    assert.equal(allowed.body.data.result.score, 80)
    assert.equal(controllerCalls, 1)
    assert.equal(providerCalls, 1)

    for (const [name, token, status] of [
      ['manager', tokenForRole('manager'), 403],
      ['editor', tokenForRole('editor'), 403],
      ['viewer', tokenForRole('viewer'), 403],
      ['unknown role', tokenForRole('unknown'), 403],
      ['client', clientToken, 403],
      ['missing token', undefined, 401],
      ['invalid token', 'invalid-token', 401],
    ] as const) {
      const callsBefore: number = controllerCalls
      const response = await post(token, validPerformanceBody())
      assert.equal(response.status, status, name)
      assert.equal(controllerCalls, callsBefore, name)
    }

    for (const invalidBody of [
      { ...validPerformanceBody(), apiKey: SECRET_SENTINEL },
      { ...validPerformanceBody(), providerUrl: 'https://provider.invalid' },
      { ...validPerformanceBody(), model: 'unapproved-model' },
      { ...validPerformanceBody(), clientName: CLIENT_SENTINEL },
      { ...validPerformanceBody(), email: EMAIL_SENTINEL },
      { ...validPerformanceBody(), portalToken: PORTAL_SENTINEL },
      { ...validPerformanceBody(), clientId: ID_SENTINEL },
      { action: 'chat', question: 'x'.repeat(501), period: 'month', metrics },
    ]) {
      const providerBefore: number = providerCalls
      const response = await post(adminToken, invalidBody)
      assert.equal(response.status, 400)
      assert.equal(providerCalls, providerBefore)
      const serialized = JSON.stringify(response)
      for (const forbidden of [
        SECRET_SENTINEL,
        CLIENT_SENTINEL,
        EMAIL_SENTINEL,
        PORTAL_SENTINEL,
        ID_SENTINEL,
      ]) {
        assert.equal(serialized.includes(forbidden), false)
      }
    }

    const chat = await post(adminToken, {
      action: 'chat',
      question: 'Como melhorar a aprovação?',
      period: 'year',
      metrics,
    })
    assert.equal(chat.status, 200)
    assert.equal(chat.body.data.answer, 'Resposta segura')

    const unavailableController = new AIInsightsController(new AIInsightsService(
      new AnthropicAIProvider({}),
    ))
    const unavailableApp = createApp({
      runtimeEnvironment: {
        ...env,
        DEPLOYMENT_MODE: 'production',
        ENABLE_DEMO_RESET: 'false',
      },
      aiInsightsController: unavailableController,
    })
    const unavailableServer: Server = unavailableApp.listen(0, '127.0.0.1')
    await new Promise<void>((resolve, reject) => {
      unavailableServer.once('listening', resolve)
      unavailableServer.once('error', reject)
    })
    try {
      const unavailablePort = (unavailableServer.address() as AddressInfo).port
      const response = await fetch(
        `http://127.0.0.1:${unavailablePort}/api/v1/integrations/ai-insights`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(validPerformanceBody()),
        },
      )
      const body = await response.json()
      assert.equal(response.status, 503)
      assert.deepEqual(body, {
        error: 'AI integration unavailable',
        code: 'INTEGRATION_UNAVAILABLE',
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        unavailableServer.close(error => error ? reject(error) : resolve()))
    }

    const serializedLogs = capturedLogs.join('\n')
    for (const forbidden of [
      SECRET_SENTINEL,
      CLIENT_SENTINEL,
      EMAIL_SENTINEL,
      PORTAL_SENTINEL,
      ID_SENTINEL,
    ]) {
      assert.equal(serializedLogs.includes(forbidden), false)
    }
  } finally {
    console.error = originalConsoleError
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()))
  }
})

test('central sanitizer covers integration credentials and payload fields', async () => {
  const { sanitizeForLogging, sanitizeLogText, LOG_REDACTED_VALUE } =
    await import('../../shared/utils/logSanitizer')

  const sanitized = sanitizeForLogging({
    apiKey: SECRET_SENTINEL,
    clientSecret: SECRET_SENTINEL,
    providerToken: SECRET_SENTINEL,
    authorization: `Bearer ${SECRET_SENTINEL}`,
    prompt: CLIENT_SENTINEL,
    messages: [{ content: EMAIL_SENTINEL }],
    upstreamRequest: { portalToken: PORTAL_SENTINEL },
  })
  const serialized = JSON.stringify(sanitized)
  for (const forbidden of [
    SECRET_SENTINEL,
    CLIENT_SENTINEL,
    EMAIL_SENTINEL,
    PORTAL_SENTINEL,
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
  assert.match(serialized, new RegExp(LOG_REDACTED_VALUE.replace(/[[\]]/g, '\\$&')))
  assert.equal(
    sanitizeLogText(`apiKey=${SECRET_SENTINEL}`).includes(SECRET_SENTINEL),
    false,
  )
})
