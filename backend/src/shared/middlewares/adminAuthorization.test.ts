import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_MODE = 'demo'
process.env.ENABLE_DEMO_RESET = 'true'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_h03'
process.env.JWT_SECRET = 'h03-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

type JsonResponse = {
  status: number
  body: any
}

let server: Server
let baseUrl = ''
let handlerCalls = 0
let databaseCalls = 0
let adminToken = ''
let managerToken = ''
let editorToken = ''
let viewerToken = ''
let clientToken = ''
let legacyRoleToken = ''
const originalConsoleError = console.error

function bearer(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function request(
  pathValue: string,
  token?: string,
  options: RequestInit = {},
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${pathValue}`, {
    ...options,
    headers: {
      ...(token ? bearer(token) : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

function concretePath(template: string) {
  return template
    .replace(':postId', 'post-id')
    .replace(':fileId', 'file-id')
    .replace(':id', 'resource-id')
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

test('capability model is immutable, authoritative and deny-by-default', async t => {
  const {
    ADMIN_CAPABILITIES,
    getAdminCapabilities,
    hasAdminCapability,
    isAdminCapability,
    isKnownAdminRole,
  } = await import('../../modules/auth/domain/AdminCapability')

  const identity = (role: unknown, permissions: string[] = []) => ({
    type: 'admin',
    userId: 'user-id',
    email: 'user@test.invalid',
    role,
    permissions,
  })

  await t.test('known roles and documented profile boundaries', () => {
    assert.equal(isKnownAdminRole('admin'), true)
    assert.equal(isKnownAdminRole('manager'), true)
    assert.equal(isKnownAdminRole('editor'), true)
    assert.equal(isKnownAdminRole('viewer'), true)
    assert.equal(isKnownAdminRole('gestor'), false)
    assert.equal(isKnownAdminRole('equipe'), false)
    assert.equal(isKnownAdminRole(''), false)
    assert.equal(isKnownAdminRole(undefined), false)
  })

  await t.test('admin receives all declared capabilities', () => {
    assert.deepEqual(getAdminCapabilities('admin'), ADMIN_CAPABILITIES)
  })

  await t.test('viewer receives approved reads and no write', () => {
    const capabilities = getAdminCapabilities('viewer')
    assert.equal(capabilities.includes('posts:read'), true)
    assert.equal(capabilities.includes('metrics:read'), true)
    assert.equal(capabilities.includes('notifications:read'), true)
    assert.equal(capabilities.some(capability => !capability.endsWith(':read')), false)
  })

  await t.test('manager and editor preserve only proven operational scopes', () => {
    assert.equal(hasAdminCapability(identity('manager'), 'clients:update'), true)
    assert.equal(hasAdminCapability(identity('manager'), 'posts:execute'), true)
    assert.equal(hasAdminCapability(identity('manager'), 'clients:delete'), false)
    assert.equal(hasAdminCapability(identity('manager'), 'admin-users:create'), false)
    assert.equal(hasAdminCapability(identity('editor'), 'posts:create'), true)
    assert.equal(hasAdminCapability(identity('editor'), 'posts:submit'), true)
    assert.equal(hasAdminCapability(identity('editor'), 'posts:execute'), false)
    assert.equal(hasAdminCapability(identity('editor'), 'files:delete'), false)
    assert.equal(hasAdminCapability(identity('manager'), 'ai-insights:generate'), false)
    assert.equal(hasAdminCapability(identity('editor'), 'ai-insights:generate'), false)
    assert.equal(hasAdminCapability(identity('viewer'), 'ai-insights:generate'), false)
  })

  await t.test('missing, invalid, client and private identities receive no capability', () => {
    assert.equal(hasAdminCapability(undefined, 'posts:read'), false)
    assert.equal(hasAdminCapability(identity(''), 'posts:read'), false)
    assert.equal(hasAdminCapability(identity('unknown'), 'posts:read'), false)
    assert.equal(hasAdminCapability({ type: 'client', clientId: 'client-id', email: 'client@test.invalid' }, 'posts:read'), false)
    assert.equal(hasAdminCapability('private-portal-value', 'posts:read'), false)
  })

  await t.test('token permissions and unknown capabilities cannot elevate privilege', () => {
    assert.equal(hasAdminCapability(identity('viewer', [...ADMIN_CAPABILITIES]), 'posts:create'), false)
    assert.equal(isAdminCapability('unknown:capability'), false)
    assert.equal(hasAdminCapability(identity('admin'), 'unknown:capability'), false)
  })

  await t.test('returned capability collections cannot mutate the server map', () => {
    const viewerCapabilities = getAdminCapabilities('viewer')
    assert.equal(Object.isFrozen(viewerCapabilities), true)
    assert.throws(() => (viewerCapabilities as string[]).push('posts:create'))
    assert.equal(hasAdminCapability(identity('viewer'), 'posts:create'), false)
  })
})

test('requireCapability calls next only for an administrative identity with the capability', async t => {
  const { requireCapability } = await import('./requireCapability')

  function run(user: unknown, capability: any) {
    const calls: unknown[] = []
    requireCapability(capability)({ user } as any, {} as any, (error?: unknown) => calls.push(error || 'next'))
    return calls
  }

  const admin = {
    type: 'admin',
    userId: 'admin-id',
    email: 'admin@test.invalid',
    role: 'admin',
  }
  const viewer = {
    type: 'admin',
    userId: 'viewer-id',
    email: 'viewer@test.invalid',
    role: 'viewer',
    permissions: ['posts:create'],
  }

  await t.test('authorized identity proceeds exactly once', () => {
    assert.deepEqual(run(admin, 'posts:create'), ['next'])
  })

  for (const [name, identity, capability] of [
    ['admin without declared capability', admin, 'unknown:capability'],
    ['viewer without write capability', viewer, 'posts:create'],
    ['missing identity', undefined, 'posts:read'],
    ['client identity', { type: 'client', clientId: 'client-id', email: 'client@test.invalid' }, 'posts:read'],
    ['private token', 'private-portal-value', 'posts:read'],
  ] as const) {
    await t.test(name, () => {
      const calls = run(identity, capability)
      assert.equal(calls.length, 1)
      assert.equal((calls[0] as any).statusCode, 403)
      assert.equal((calls[0] as any).message, 'Insufficient access')
    })
  }
})

test('every mounted administrative route has exactly one explicit capability policy', async () => {
  const {
    ADMIN_ROUTE_POLICIES,
    resolveAdminRouteCapability,
  } = await import('../authorization/AdminRoutePolicy')

  const routeFiles = [
    ['notifications', 'src/modules/notifications/presentation/routes/notifications.routes.ts'],
    ['posts', 'src/modules/posts/presentation/routes/posts.routes.ts'],
    ['clients', 'src/modules/clients/presentation/routes/clients.routes.ts'],
    ['users', 'src/modules/users/presentation/routes/users.routes.ts'],
    ['approvals', 'src/modules/approvals/presentation/routes/approvals.routes.ts', 'createApprovalsRoutes'],
    ['files', 'src/modules/approvals/presentation/routes/approvals.routes.ts', 'createFilesRoutes'],
    ['feedback', 'src/modules/approvals/presentation/routes/approvals.routes.ts', 'createFeedbackRoutes'],
    ['activities', 'src/modules/activities/presentation/routes/activities.routes.ts'],
    ['integrations', 'src/modules/integrations/presentation/routes/integrations.routes.ts'],
    ['maintenance', 'src/modules/maintenance/presentation/routes/maintenance.routes.ts'],
    ['branding', 'src/modules/branding/presentation/routes/branding.routes.ts', 'createAdminBrandingRoutes'],
  ] as const

  const mounted = new Set<string>()
  for (const [prefix, relativeFile, functionName] of routeFiles) {
    const source = readFileSync(path.join(process.cwd(), relativeFile), 'utf8')
    const scopedSource = functionName
      ? source.slice(source.indexOf(`export function ${functionName}`), source.indexOf('return router', source.indexOf(`export function ${functionName}`)))
      : source
    for (const match of scopedSource.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
      const method = match[1].toUpperCase()
      const suffix = match[2] === '/' ? '' : match[2]
      mounted.add(`${method} /api/v1/${prefix}${suffix}`)
    }
  }

  const declared = ADMIN_ROUTE_POLICIES.map(policy => `${policy.method} ${policy.path}`)
  assert.equal(new Set(declared).size, declared.length, 'duplicate route policy')
  assert.deepEqual([...mounted].sort(), [...declared].sort())
  for (const policy of ADMIN_ROUTE_POLICIES) {
    assert.equal(resolveAdminRouteCapability(policy.method, concretePath(policy.path)), policy.capability)
  }
  assert.equal(resolveAdminRouteCapability('POST', '/api/v1/unknown'), null)
  assert.equal(resolveAdminRouteCapability('GET', '/api/v1/posts/resource-id/unknown'), null)
})

test('user role validation accepts only official roles before repository access', async () => {
  const { UsersController } = await import('../../modules/users/presentation/controllers/UsersController')
  let repositoryCalls = 0
  const repository = {
    async create() {
      repositoryCalls += 1
      return { id: 'created' }
    },
    async update() {
      repositoryCalls += 1
      return { id: 'updated' }
    },
  }
  const controller = new UsersController(repository as any)

  for (const role of ['gestor', 'equipe', 'unknown', '', ' ADMINISTRATOR ']) {
    const create = createResponse()
    await controller.create({
      body: { name: 'Test', email: 'test@test.invalid', password: 'Password!1', role },
    } as any, create.response as any)
    assert.equal(create.state.status, 400)

    const update = createResponse()
    await controller.update({
      params: { id: 'user-id' },
      body: { role },
    } as any, update.response as any)
    assert.equal(update.state.status, 400)
  }
  assert.equal(repositoryCalls, 0)
})

before(async () => {
  console.error = () => {}
  const [
    { ClientsController },
    { PortalController },
    { UsersRepository },
    { PostsController },
    { SoundtracksController },
    { ApprovalsController },
    { ActivitiesController },
    { NotificationsController },
    { MaintenanceController },
    { AIInsightsController },
    { BrandingController },
    poolModule,
  ] = await Promise.all([
    import('../../modules/clients/presentation/controllers/ClientsController'),
    import('../../modules/portal/presentation/controllers/PortalController'),
    import('../../modules/users/infrastructure/repositories/UsersRepository'),
    import('../../modules/posts/presentation/controllers/PostsController'),
    import('../../modules/soundtracks/presentation/controllers/SoundtracksController'),
    import('../../modules/approvals/presentation/controllers/ApprovalsController'),
    import('../../modules/activities/presentation/controllers/ActivitiesController'),
    import('../../modules/notifications/presentation/controllers/NotificationsController'),
    import('../../modules/maintenance/presentation/controllers/MaintenanceController'),
    import('../../modules/integrations/presentation/controllers/AIInsightsController'),
    import('../../modules/branding/presentation/controllers/BrandingController'),
    import('../database/pool'),
  ])

  ;(poolModule.pool as any).query = async () => {
    databaseCalls += 1
    throw new Error('Database access is forbidden in H-03 tests')
  }
  ;(poolModule.pool as any).connect = async () => {
    databaseCalls += 1
    throw new Error('Database access is forbidden in H-03 tests')
  }

  const respond = async (_req: unknown, res: any) => {
    handlerCalls += 1
    return res.json({ success: true })
  }
  const patch = (prototype: any, methods: string[]) => {
    for (const method of methods) prototype[method] = respond
  }

  patch(ClientsController.prototype, ['create', 'list', 'getById', 'notify', 'activate', 'update', 'deletePermanently', 'delete'])
  patch(PortalController.prototype, ['createClientLink', 'getClientLink', 'replaceClientLink'])
  ;(UsersRepository.prototype as any).findAll = async () => {
    handlerCalls += 1
    return []
  }
  ;(UsersRepository.prototype as any).create = async (input: unknown) => {
    handlerCalls += 1
    return { id: 'created-user', ...(input as object) }
  }
  ;(UsersRepository.prototype as any).update = async (id: string, input: unknown) => {
    handlerCalls += 1
    return { id, ...(input as object) }
  }
  ;(UsersRepository.prototype as any).delete = async () => {
    handlerCalls += 1
    return true
  }
  patch(PostsController.prototype, [
    'list', 'create', 'submitBatchForApproval', 'getById', 'update', 'delete',
    'duplicate', 'updateStatus', 'markExecuted', 'uploadFiles', 'reorderFiles',
    'replaceFile', 'removeFile', 'submitForApproval', 'resubmit',
  ])
  patch(SoundtracksController.prototype, ['get', 'update', 'upload'])
  patch(ApprovalsController.prototype, ['getQueue', 'approveFile', 'rejectFile', 'listMonthlyFeedbacks', 'submitFeedback'])
  patch(ActivitiesController.prototype, ['list', 'create'])
  patch(NotificationsController.prototype, ['list', 'markAsRead', 'markAllAsRead'])
  patch(MaintenanceController.prototype, ['resetDemoData'])
  patch(AIInsightsController.prototype, ['generate'])
  patch(BrandingController.prototype, ['uploadLogo', 'removeLogo'])

  const [
    { createApp },
    { env },
    { JwtProvider },
  ] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
    import('../../modules/auth/infrastructure/JwtProvider'),
  ])
  const jwt = new JwtProvider()
  const signAdmin = (role: string, permissions: string[] = []) => jwt.sign({
    type: 'admin',
    userId: `${role}-id`,
    email: `${role}@test.invalid`,
    role,
    permissions,
  }, '5m')

  adminToken = signAdmin('admin')
  managerToken = signAdmin('manager')
  editorToken = signAdmin('editor')
  viewerToken = signAdmin('viewer', ['admin-users:create', 'demo-reset:execute'])
  legacyRoleToken = signAdmin('gestor', ['admin-users:create', 'demo-reset:execute'])
  clientToken = jwt.sign({
    type: 'client',
    clientId: 'client-id',
    email: 'client@test.invalid',
  }, '5m')

  const app = createApp({
    runtimeEnvironment: {
      ...env,
      DEPLOYMENT_MODE: 'demo',
      ENABLE_DEMO_RESET: 'true',
    },
  })
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
})

after(async () => {
  try {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  } finally {
    console.error = originalConsoleError
  }
})

test('admin can reach every explicitly declared administrative route', async () => {
  const { ADMIN_ROUTE_POLICIES } = await import('../authorization/AdminRoutePolicy')
  for (const policy of ADMIN_ROUTE_POLICIES) {
    const body = policy.path === '/api/v1/users' && policy.method === 'POST'
      ? { name: 'New user', email: 'new-user@test.invalid', password: 'Password!1', role: 'viewer' }
      : policy.path === '/api/v1/users/:id' && policy.method === 'PUT'
        ? { name: 'Updated user', role: 'viewer' }
        : { confirmation: 'RESETAR' }
    const response = await request(concretePath(policy.path), adminToken, {
      method: policy.method,
      ...(policy.method === 'GET' ? {} : { body: JSON.stringify(body) }),
    })
    assert.equal(
      response.status >= 200 && response.status < 300,
      true,
      `${policy.method} ${policy.path} returned ${response.status}`,
    )
  }
  assert.equal(databaseCalls, 0)
})

test('viewer route matrix allows only approved reads and blocks every write before handlers', async () => {
  const { ADMIN_ROUTE_POLICIES } = await import('../authorization/AdminRoutePolicy')
  const { hasAdminCapability } = await import('../../modules/auth/domain/AdminCapability')
  const viewerIdentity = {
    type: 'admin',
    userId: 'viewer-id',
    email: 'viewer@test.invalid',
    role: 'viewer',
    permissions: ['admin-users:create', 'demo-reset:execute'],
  }

  for (const policy of ADMIN_ROUTE_POLICIES) {
    const beforeCalls = handlerCalls
    const response = await request(concretePath(policy.path), viewerToken, {
      method: policy.method,
      ...(policy.method === 'GET' ? {} : { body: JSON.stringify({ role: 'admin', confirmation: 'RESETAR' }) }),
    })
    const allowed = hasAdminCapability(viewerIdentity, policy.capability)
    assert.equal(response.status, allowed ? 200 : 403, `${policy.method} ${policy.path}`)
    assert.equal(handlerCalls, beforeCalls + (allowed ? 1 : 0))
    if (!allowed) {
      assert.deepEqual(response.body, { error: 'Insufficient access', code: 'FORBIDDEN' })
    }
  }
  assert.equal(databaseCalls, 0)
})

test('manager and editor follow the authoritative profile matrix', async t => {
  const cases = [
    ['manager client update', managerToken, 'PUT', '/api/v1/clients/resource-id', 200],
    ['manager destructive client deletion', managerToken, 'DELETE', '/api/v1/clients/resource-id/permanent', 403],
    ['manager administrative user creation', managerToken, 'POST', '/api/v1/users', 403],
    ['manager demo reset', managerToken, 'POST', '/api/v1/maintenance/reset-demo-data', 403],
    ['editor post creation', editorToken, 'POST', '/api/v1/posts', 200],
    ['editor post submission', editorToken, 'POST', '/api/v1/posts/post-id/submit-for-approval', 200],
    ['editor execution', editorToken, 'POST', '/api/v1/posts/post-id/execute', 403],
    ['editor file deletion', editorToken, 'DELETE', '/api/v1/posts/post-id/files/file-id', 403],
    ['editor client mutation', editorToken, 'PUT', '/api/v1/clients/resource-id', 403],
    ['editor role elevation', editorToken, 'PUT', '/api/v1/users/user-id', 403],
    ['manager AI execution', managerToken, 'POST', '/api/v1/integrations/ai-insights', 403],
    ['editor AI execution', editorToken, 'POST', '/api/v1/integrations/ai-insights', 403],
  ] as const

  for (const [name, token, method, pathValue, expectedStatus] of cases) {
    await t.test(name, async () => {
      const beforeCalls = handlerCalls
      const response = await request(pathValue, token, {
        method,
        body: JSON.stringify({ role: 'admin' }),
      })
      assert.equal(response.status, expectedStatus)
      assert.equal(handlerCalls, beforeCalls + (expectedStatus === 200 ? 1 : 0))
    })
  }
})

test('C-01 identities and deny-by-default remain ahead of every privileged handler', async t => {
  const cases = [
    ['missing token', undefined, 401],
    ['client token', clientToken, 403],
    ['private portal token', 'private-portal-value', 401],
    ['legacy ambiguous role', legacyRoleToken, 403],
  ] as const

  for (const [name, token, expectedStatus] of cases) {
    await t.test(name, async () => {
      const beforeCalls = handlerCalls
      const response = await request('/api/v1/users', token)
      assert.equal(response.status, expectedStatus)
      assert.equal(handlerCalls, beforeCalls)
    })
  }

  await t.test('unknown administrative route is denied before Express routing', async () => {
    const beforeCalls = handlerCalls
    const response = await request('/api/v1/internal-route-without-policy', adminToken)
    assert.equal(response.status, 403)
    assert.equal(handlerCalls, beforeCalls)
    assert.deepEqual(response.body, { error: 'Insufficient access', code: 'FORBIDDEN' })
  })

  await t.test('viewer body cannot assign itself an administrator role', async () => {
    const beforeCalls = handlerCalls
    const response = await request('/api/v1/users/viewer-id', viewerToken, {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin', permissions: ['admin-users:update'] }),
    })
    assert.equal(response.status, 403)
    assert.equal(handlerCalls, beforeCalls)
  })

  await t.test('branding mutation rejects unauthenticated, client and viewer identities before upload', async () => {
    for (const [token, expectedStatus] of [[undefined, 401], [clientToken, 403], [viewerToken, 403]] as const) {
      const beforeCalls = handlerCalls
      const response = await request('/api/v1/branding/logo', token, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      assert.equal(response.status, expectedStatus)
      assert.equal(handlerCalls, beforeCalls)
    }
  })
})

test('demo reset composes C-02 availability, C-01 identity and H-03 capability', async () => {
  const [{ createApp }, { env }] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
  ])

  async function requestFrom(app: ReturnType<typeof createApp>, token: string) {
    const localServer: Server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve, reject) => {
      localServer.once('listening', resolve)
      localServer.once('error', reject)
    })
    try {
      const { port } = localServer.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/maintenance/reset-demo-data`, {
        method: 'POST',
        headers: {
          ...bearer(token),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirmation: 'RESETAR' }),
      })
      return response.status
    } finally {
      await new Promise<void>((resolve, reject) => localServer.close(error => error ? reject(error) : resolve()))
    }
  }

  const productionApp = createApp({
    runtimeEnvironment: {
      ...env,
      DEPLOYMENT_MODE: 'production',
      ENABLE_DEMO_RESET: 'true',
    },
  })
  const noOptInApp = createApp({
    runtimeEnvironment: {
      ...env,
      DEPLOYMENT_MODE: 'demo',
      ENABLE_DEMO_RESET: 'false',
    },
  })

  assert.equal(await requestFrom(productionApp, adminToken), 404)
  assert.equal(await requestFrom(noOptInApp, adminToken), 404)
  assert.equal((await request('/api/v1/maintenance/reset-demo-data', adminToken, {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'RESETAR' }),
  })).status, 200)
  assert.equal((await request('/api/v1/maintenance/reset-demo-data', viewerToken, {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'RESETAR' }),
  })).status, 403)
  assert.equal((await request('/api/v1/maintenance/reset-demo-data', clientToken, {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'RESETAR' }),
  })).status, 403)
})
