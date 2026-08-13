import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { Request, Response } from 'express'

process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_MODE = 'production'
process.env.ENABLE_DEMO_RESET = 'false'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_h02'
process.env.JWT_SECRET = 'h02-test-secret-not-for-production'
process.env.LOG_LEVEL = 'debug'

type CapturedCall = {
  sink: 'log' | 'warn' | 'error'
  args: unknown[]
}

const captured: CapturedCall[] = []
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
}

function syntheticPortalToken(label: string) {
  return ['PORTAL', 'TOKEN', 'SUPER', 'SECRETO', 'TESTE', label].join('_')
}

function capturedText() {
  return JSON.stringify(captured)
}

function clearCaptured() {
  captured.length = 0
}

function assertSecretAbsent(secret: string, ...outputs: unknown[]) {
  for (const output of outputs) {
    const text = typeof output === 'string' ? output : JSON.stringify(output)
    assert.equal(text.includes(secret), false, `secret leaked in output: ${text}`)
  }
}

before(() => {
  console.log = (...args: unknown[]) => captured.push({ sink: 'log', args })
  console.warn = (...args: unknown[]) => captured.push({ sink: 'warn', args })
  console.error = (...args: unknown[]) => captured.push({ sink: 'error', args })
})

after(() => {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})

test('central sanitizer redacts portal paths, query credentials and nested structured values without mutation', async () => {
  const {
    LOG_REDACTED_VALUE,
    extractPortalTokenCandidates,
    sanitizeForLogging,
    sanitizeLogText,
    sanitizeRequestTarget,
  } = await import('./logSanitizer')

  const secret = syntheticPortalToken('DIRECT')
  const normalUuid = '123e4567-e89b-12d3-a456-426614174000'
  const target = `/api/v1/portal/${secret}/posts?view=compact&token=${secret}`
  const circular: Record<string, unknown> = { value: secret, normalUuid }
  circular.self = circular
  const error = Object.assign(new Error(`repository failed for ${target}`), {
    cause: new Error(`cause contains ${secret}`),
  })
  const original = {
    token: secret,
    portalToken: secret,
    private_token: secret,
    accessToken: secret,
    refresh_token: secret,
    authorization: `Bearer ${secret}`,
    cookie: `portal=${secret}`,
    password: secret,
    secret,
    params: { token: secret, postId: normalUuid },
    query: { token: secret, view: 'compact' },
    body: { nested: [{ portalToken: secret }, null, 42, true] },
    headers: { authorization: `Bearer ${secret}` },
    requestUrl: target,
    circular,
    error,
    buffer: Buffer.from(secret),
  }

  const sanitized = sanitizeForLogging(original, {
    secrets: extractPortalTokenCandidates(target),
    maxEntries: 50,
  }) as Record<string, any>
  const serialized = JSON.stringify(sanitized)

  assertSecretAbsent(secret, serialized)
  assert.match(serialized, /\[REDACTED\]/)
  assert.match(serialized, /\[Circular\]/)
  assert.match(serialized, /Buffer redacted/)
  assert.match(serialized, new RegExp(normalUuid))
  assert.match(sanitizeRequestTarget(target), /\/api\/v1\/portal\/\[REDACTED\]\/posts\?view=compact&token=\[REDACTED\]/)
  assert.equal(sanitizeLogText('/api/v1/posts/' + normalUuid), '/api/v1/posts/' + normalUuid)
  assert.equal(sanitized.token, LOG_REDACTED_VALUE)
  assert.equal(original.token, secret)
  assert.equal(original.params.token, secret)
  assert.equal(original.circular.self, circular)
})

test('central logger sanitizes every console sink before emission', async () => {
  const [{ Logger }] = await Promise.all([import('./Logger')])
  const secret = syntheticPortalToken('LOGGER')
  const logger = new Logger()
  clearCaptured()

  logger.debug(`GET /portal/${secret}`, { portalToken: secret })
  logger.info('request', { originalUrl: `/api/v1/portal/${secret}?view=compact` })
  logger.warn('warning', { headers: { authorization: `Bearer ${secret}` } })
  logger.error('error', {
    error: Object.assign(new Error(`failed at /api/v1/portal/${secret}`), {
      cause: { privateToken: secret },
    }),
  })

  const output = capturedText()
  assertSecretAbsent(secret, output)
  assert.match(output, /\[REDACTED\]/)
  assert.deepEqual(captured.map(call => call.sink), ['log', 'log', 'warn', 'error'])
})

test('portal request matrix never emits or reflects the private token and preserves functional use', async t => {
  const [
    { createApp },
    { env },
    { PortalController },
    { AppException },
  ] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
    import('../../modules/portal/presentation/controllers/PortalController'),
    import('../exceptions/AppException'),
  ])

  const state = {
    validatedTokens: [] as string[],
    approvalCalls: 0,
    rejectionComments: [] as string[],
    activities: [] as unknown[],
    activeToken: '',
  }

  const validSession = {
    tokenId: 'internal-token-id',
    clientId: 'client-id',
    companyId: 'company-id',
    expiresAt: new Date(Date.now() + 60_000),
    client: { id: 'client-id', name: 'Client test', email: 'client@test.invalid' },
  }

  const portalRepository = {
    async validateToken(token: string) {
      state.validatedTokens.push(token)
      state.activeToken = token
      if (/(INVALID|EXPIRED|REVOKED|INACTIVE)/.test(token)) return null
      return validSession
    },
    async listPosts() {
      if (state.activeToken.endsWith('REPOSITORY')) {
        throw Object.assign(new Error(`repository failed for /api/v1/portal/${state.activeToken}`), {
          cause: new Error(`database cause included ${state.activeToken}`),
        })
      }
      return []
    },
    async listFeedbacks() {
      return []
    },
    async approvePost() {
      state.approvalCalls += 1
      return { kind: 'completed', status: 'approved', snapshot: [] }
    },
    async rejectPost(_postId: string, comment: string) {
      state.rejectionComments.push(comment)
      return { kind: 'completed', status: 'rejected', snapshot: [] }
    },
    async saveFeedback() {
      return { id: 'feedback-id' }
    },
  }
  const activityRepository = {
    async createForPost(_postId: string, activity: unknown) {
      state.activities.push(activity)
      return activity
    },
    async createForFile(_fileId: string, activity: unknown) {
      state.activities.push(activity)
      return activity
    },
  }
  const soundtrackRepository = {}

  class TestPortalController extends PortalController {
    async getPortal(req: Request, res: Response) {
      if (req.params.token.endsWith('CONTROLLER')) {
        throw new AppException(`controller rejected ${req.params.token}`, 400, 'PORTAL_TEST_ERROR')
      }
      if (req.params.token.endsWith('SERVICE')) {
        const serviceError = Object.assign(new Error(`service failed for ${req.params.token}`), {
          cause: { url: `/api/v1/portal/${req.params.token}` },
        })
        throw serviceError
      }
      return super.getPortal(req, res)
    }
  }

  const controller = new TestPortalController(
    portalRepository as any,
    activityRepository as any,
    soundtrackRepository as any,
    {
      async get() {
        return {
          retention: { executed_attachment_hours: 24 },
          features: { soundtrack: false },
          client_fields: { whatsapp: 'optional', segment: 'optional', deadline_days: 'optional', document: 'hidden' },
          post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'hidden' },
          portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true, approval_mode: 'content' },
        }
      },
    } as any,
  )
  const app = createApp({ runtimeEnvironment: env, portalController: controller })
  const server: Server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const { port } = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${port}`

  async function request(path: string, options: RequestInit = {}) {
    clearCaptured()
    const response = await fetch(`${baseUrl}${path}`, options)
    const text = await response.text()
    await new Promise(resolve => setImmediate(resolve))
    return { status: response.status, text, logs: capturedText() }
  }

  async function verifyScenario(
    label: string,
    expectedStatus: number,
    pathSuffix = '?view=compact',
  ) {
    const secret = syntheticPortalToken(label)
    const result = await request(`/api/v1/portal/${secret}${pathSuffix}`)
    assert.equal(result.status, expectedStatus)
    assertSecretAbsent(secret, result.logs, result.text, state.activities)
    assert.match(result.logs, /\/api\/v1\/portal\/\[REDACTED\]/)
    return { secret, result }
  }

  try {
    await t.test('valid access and non-sensitive query', async () => {
      const { secret, result } = await verifyScenario('VALID', 200, `?view=compact&token=${syntheticPortalToken('VALID')}`)
      assert.equal(state.validatedTokens.at(-1), secret)
      assert.match(result.logs, /view=compact/)
      assert.match(result.logs, /token=\[REDACTED\]/)
    })

    for (const label of ['INVALID', 'EXPIRED', 'REVOKED', 'INACTIVE']) {
      await t.test(`${label.toLowerCase()} token`, async () => {
        const { secret, result } = await verifyScenario(label, 401)
        assert.equal(state.validatedTokens.at(-1), secret)
        assert.match(result.text, /Portal link expired or invalid/)
      })
    }

    await t.test('internal repository error with stack and cause', async () => {
      const { result } = await verifyScenario('REPOSITORY', 500)
      assert.match(result.text, /Internal server error/)
      assert.match(result.logs, /repository failed/)
      assert.match(result.logs, /database cause included/)
    })

    await t.test('controller error is sanitized in log and HTTP response', async () => {
      const { result } = await verifyScenario('CONTROLLER', 400)
      assert.match(result.text, /controller rejected \[REDACTED\]/)
      assert.match(result.logs, /PORTAL_TEST_ERROR/)
    })

    await t.test('service-originated error is sanitized in log, stack and cause', async () => {
      const { result } = await verifyScenario('SERVICE', 500)
      assert.match(result.text, /Internal server error/)
      assert.match(result.logs, /service failed/)
    })

    await t.test('unknown portal route returns generic 404 without reflecting URL', async () => {
      const secret = syntheticPortalToken('UNKNOWN')
      const result = await request(`/api/v1/portal/${secret}/route-that-does-not-exist?view=compact`)
      assert.equal(result.status, 404)
      assertSecretAbsent(secret, result.logs, result.text)
      assert.match(result.logs, /\/api\/v1\/portal\/\[REDACTED\]/)
      assert.match(result.text, /Not found/)
    })

    await t.test('approval still uses the real token and emits token-free activity', async () => {
      const secret = syntheticPortalToken('APPROVE')
      const result = await request(`/api/v1/portal/${secret}/posts/post-id/approve`, { method: 'POST' })
      assert.equal(result.status, 200)
      assert.equal(state.validatedTokens.at(-1), secret)
      assert.equal(state.approvalCalls, 1)
      assertSecretAbsent(secret, result.logs, result.text, state.activities)
    })

    await t.test('adjustment preserves functional comment while redacting activity metadata', async () => {
      const secret = syntheticPortalToken('REJECT')
      const comment = `please remove credential ${secret}`
      const result = await request(`/api/v1/portal/${secret}/posts/post-id/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      assert.equal(result.status, 200)
      assert.equal(state.validatedTokens.at(-1), secret)
      assert.equal(state.rejectionComments.at(-1), comment)
      assertSecretAbsent(secret, result.logs, result.text, state.activities)
      assert.match(JSON.stringify(state.activities.at(-1)), /\[REDACTED\]/)
    })
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
