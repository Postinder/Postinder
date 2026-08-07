import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_MODE = 'production'
process.env.ENABLE_DEMO_RESET = 'false'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_c02'
process.env.JWT_SECRET = 'c02-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

type RuntimeOverrides = {
  NODE_ENV?: 'development' | 'test' | 'production'
  DEPLOYMENT_MODE?: string
  ENABLE_DEMO_RESET?: string
}

function createResponse() {
  const state: { status: number; body: any } = { status: 200, body: undefined }
  const response = {
    status(code: number) {
      state.status = code
      return response
    },
    json(body: any) {
      state.body = body
      return response
    },
  }
  return { response, state }
}

test('configuration matrix is fail-closed and independent from NODE_ENV', async t => {
  const { getDemoResetAvailability } = await import('../../config/demoReset')
  const cases = [
    ['production + demo + true', 'production', 'demo', 'true', true],
    ['production + demo + false', 'production', 'demo', 'false', false],
    ['production + demo + missing flag', 'production', 'demo', undefined, false],
    ['production + production + true', 'production', 'production', 'true', false],
    ['production + production + false', 'production', 'production', 'false', false],
    ['production + production + missing flag', 'production', 'production', undefined, false],
    ['development + demo + true', 'development', 'demo', 'true', true],
    ['development + demo + false', 'development', 'demo', 'false', false],
    ['development + production + true', 'development', 'production', 'true', false],
    ['test + demo + true', 'test', 'demo', 'true', true],
    ['missing mode + true', 'production', undefined, 'true', false],
    ['invalid mode + true', 'production', 'staging', 'true', false],
  ] as const

  for (const [name, nodeEnv, deploymentMode, resetFlag, expected] of cases) {
    await t.test(name, () => {
      const result = getDemoResetAvailability({
        NODE_ENV: nodeEnv,
        DEPLOYMENT_MODE: deploymentMode,
        ENABLE_DEMO_RESET: resetFlag,
      })
      assert.equal(result.enabled, expected)
    })
  }
})

test('configuration accepts only exact demo and textual true values', async () => {
  const { getDemoResetAvailability } = await import('../../config/demoReset')

  for (const mode of ['', 'DEMO', ' demo', 'demo ', 'staging', true, 1, null]) {
    assert.equal(getDemoResetAvailability({
      DEPLOYMENT_MODE: mode,
      ENABLE_DEMO_RESET: 'true',
    }).enabled, false)
  }

  for (const flag of ['', 'false', 'TRUE', 'True', '1', 'yes', ' true', true, 1, null, undefined]) {
    assert.equal(getDemoResetAvailability({
      DEPLOYMENT_MODE: 'demo',
      ENABLE_DEMO_RESET: flag,
    }).enabled, false)
  }

  assert.equal(getDemoResetAvailability({
    NODE_ENV: 'production',
    DEPLOYMENT_MODE: 'demo',
    ENABLE_DEMO_RESET: 'true',
  }).enabled, true)
})

test('real application mounts reset only for explicit demo opt-in', async () => {
  const [{ createApp }, { env }, { JwtProvider }] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
    import('../auth/infrastructure/JwtProvider'),
  ])

  const provider = new JwtProvider()
  const tokens = {
    admin: provider.sign({
      type: 'admin',
      userId: 'admin-id',
      email: 'admin@test.invalid',
      role: 'admin',
    }, '5m'),
    viewer: provider.sign({
      type: 'admin',
      userId: 'viewer-id',
      email: 'viewer@test.invalid',
      role: 'viewer',
    }, '5m'),
    client: provider.sign({
      type: 'client',
      clientId: 'client-id',
      email: 'client@test.invalid',
    }, '5m'),
    refresh: provider.sign({
      type: 'refresh',
      context: 'admin',
      userId: 'admin-id',
      email: 'admin@test.invalid',
    }, '5m'),
  }

  async function exercise(
    overrides: RuntimeOverrides,
    requests: Array<{ token?: string; expected: number }>,
  ) {
    let controllerCalls = 0
    const maintenanceController = {
      async resetDemoData(_req: any, res: any) {
        controllerCalls += 1
        return res.json({ success: true })
      },
    }
    const runtimeEnvironment = {
      ...env,
      NODE_ENV: overrides.NODE_ENV ?? 'production',
      DEPLOYMENT_MODE: overrides.DEPLOYMENT_MODE,
      ENABLE_DEMO_RESET: overrides.ENABLE_DEMO_RESET,
    }
    const app = createApp({
      runtimeEnvironment,
      maintenanceController: maintenanceController as any,
    })
    let server: Server | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve)
        server.once('error', reject)
      })
      const address = server!.address() as AddressInfo
      const url = `http://127.0.0.1:${address.port}/api/v1/maintenance/reset-demo-data`

      for (const item of requests) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(item.token ? { authorization: `Bearer ${item.token}` } : {}),
          },
          body: JSON.stringify({ confirmation: 'RESETAR' }),
        })
        assert.equal(response.status, item.expected)
      }
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close(error => error ? reject(error) : resolve())
        })
      }
    }
    return controllerCalls
  }

  const demoCalls = await exercise(
    {
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'demo',
      ENABLE_DEMO_RESET: 'true',
    },
    [
      { token: tokens.admin, expected: 200 },
      { token: tokens.viewer, expected: 403 },
      { token: tokens.client, expected: 403 },
      { token: tokens.refresh, expected: 403 },
      { token: 'private-test-token', expected: 401 },
      { expected: 401 },
    ],
  )
  assert.equal(demoCalls, 1)

  const unavailableScenarios: RuntimeOverrides[] = [
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'demo', ENABLE_DEMO_RESET: 'false' },
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'production', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'production', ENABLE_DEMO_RESET: 'false' },
    { NODE_ENV: 'development', DEPLOYMENT_MODE: 'production', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', DEPLOYMENT_MODE: '', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'staging', ENABLE_DEMO_RESET: 'true' },
  ]

  for (const scenario of unavailableScenarios) {
    const calls = await exercise(scenario, [
      { token: tokens.admin, expected: 404 },
      { token: tokens.client, expected: 404 },
      { expected: 404 },
    ])
    assert.equal(calls, 0)
  }
})

test('defensive guard blocks direct reset before every side effect', async () => {
  const { MaintenanceController } = await import('./presentation/controllers/MaintenanceController')
  const effects = {
    fileQuery: 0,
    connect: 0,
    transactionQueries: 0,
    locks: 0,
    storage: 0,
    logs: 0,
  }
  const dependencies = {
    pool: {
      async query() {
        effects.fileQuery += 1
        return { rows: [] }
      },
      async connect() {
        effects.connect += 1
        return {
          async query() {
            effects.transactionQueries += 1
            return { rows: [] }
          },
          release() {},
        }
      },
    },
    async acquireEmailLock() {
      effects.locks += 1
    },
    normalizeEmail(value: string) {
      return value.toLowerCase()
    },
    async removeStoredFile() {
      effects.storage += 1
      return { removed: true }
    },
    logger: {
      error() {
        effects.logs += 1
      },
    },
  }
  const request = {
    user: { type: 'admin', userId: 'admin-id', role: 'admin' },
    body: { confirmation: 'RESETAR' },
  }

  for (const configuration of [
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'production', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'invalid', ENABLE_DEMO_RESET: 'true' },
    { NODE_ENV: 'production', ENABLE_DEMO_RESET: 'true' },
  ]) {
    const controller = new MaintenanceController(configuration, dependencies as any)
    const { response, state } = createResponse()
    await controller.resetDemoData(request as any, response as any)
    assert.equal(state.status, 404)
    assert.equal(state.body.error, 'Not found')
    assert.deepEqual(effects, {
      fileQuery: 0,
      connect: 0,
      transactionQueries: 0,
      locks: 0,
      storage: 0,
      logs: 0,
    })
  }
})

test('defensive guard preserves admin-only profile checks in demo mode', async () => {
  const { MaintenanceController } = await import('./presentation/controllers/MaintenanceController')
  let effectCalls = 0
  const dependencies = {
    pool: {
      async query() {
        effectCalls += 1
        return { rows: [] }
      },
      async connect() {
        effectCalls += 1
        throw new Error('must not connect')
      },
    },
    async acquireEmailLock() {
      effectCalls += 1
    },
    normalizeEmail(value: string) {
      return value
    },
    async removeStoredFile() {
      effectCalls += 1
      return { removed: true }
    },
    logger: { error() { effectCalls += 1 } },
  }
  const controller = new MaintenanceController(
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'demo', ENABLE_DEMO_RESET: 'true' },
    dependencies as any,
  )

  for (const user of [
    { type: 'admin', userId: 'viewer-id', role: 'viewer' },
    { type: 'client', clientId: 'client-id' },
    undefined,
  ]) {
    const { response, state } = createResponse()
    await controller.resetDemoData({
      user,
      body: { confirmation: 'RESETAR' },
    } as any, response as any)
    assert.equal(state.status, 403)
  }
  assert.equal(effectCalls, 0)
})

test('authorized demo reset preserves the transaction and response contract with local mocks', async () => {
  const { MaintenanceController } = await import('./presentation/controllers/MaintenanceController')
  const transactionSql: string[] = []
  const removedObjects: Array<{ bucket?: string; storagePath?: string }> = []
  let released = false
  let fileQueries = 0
  let connections = 0
  let locks = 0
  const fakeClient = {
    async query(sql: string) {
      transactionSql.push(sql.replace(/\s+/g, ' ').trim())
      return { rows: [] }
    },
    release() {
      released = true
    },
  }
  const dependencies = {
    pool: {
      async query() {
        fileQueries += 1
        return {
          rows: [{ bucket: 'demo-bucket', storage_path: 'demo/file.png' }],
        }
      },
      async connect() {
        connections += 1
        return fakeClient
      },
    },
    async acquireEmailLock() {
      locks += 1
    },
    normalizeEmail(value: string) {
      return value.trim().toLowerCase()
    },
    async removeStoredFile(input: { bucket?: string; storagePath?: string }) {
      removedObjects.push(input)
      return { removed: true }
    },
    logger: { error() {} },
  }
  const controller = new MaintenanceController(
    { NODE_ENV: 'production', DEPLOYMENT_MODE: 'demo', ENABLE_DEMO_RESET: 'true' },
    dependencies as any,
  )
  const { response, state } = createResponse()

  await controller.resetDemoData({
    user: { type: 'admin', userId: 'admin-id', role: 'admin' },
    body: { confirmation: 'RESETAR' },
  } as any, response as any)

  assert.equal(state.status, 200)
  assert.equal(state.body.success, true)
  assert.equal(fileQueries, 1)
  assert.equal(connections, 1)
  assert.equal(locks, 2)
  assert.equal(removedObjects.length, 1)
  assert.equal(transactionSql[0], 'BEGIN')
  assert.ok(transactionSql.some(sql => sql.startsWith('TRUNCATE TABLE')))
  assert.equal(transactionSql.filter(sql => sql.startsWith('INSERT INTO')).length, 2)
  assert.equal(transactionSql.at(-1), 'COMMIT')
  assert.equal(transactionSql.includes('ROLLBACK'), false)
  assert.equal(released, true)
})
