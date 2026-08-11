import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

process.env.NODE_ENV = 'test'
process.env.DEPLOYMENT_MODE = 'demo'
process.env.ENABLE_DEMO_RESET = 'true'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_c01'
process.env.JWT_SECRET = 'c01-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

type JsonResponse = {
  status: number
  body: any
}

let server: Server
let baseUrl = ''
let jwtProvider: InstanceType<typeof import('../../modules/auth/infrastructure/JwtProvider').JwtProvider>
let adminToken = ''
let viewerToken = ''
let clientToken = ''
let expiredToken = ''
let wrongContextToken = ''
let invalidAdminRoleToken = ''
let legacyAmbiguousToken = ''
let refreshAccessToken = ''

const calls = {
  database: 0,
  clientList: 0,
  clientCreate: 0,
  portalValidate: 0,
  portalApprove: 0,
  portalReject: 0,
  activity: 0,
}

async function request(path: string, options: RequestInit = {}): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` }
}

before(async () => {
  const [{ PortalRepository }, { ClientRepository }, { ActivityRepository }, { PlatformSettingsRepository }, poolModule] = await Promise.all([
    import('../../modules/portal/infrastructure/repositories/PortalRepository'),
    import('../../modules/clients/infrastructure/repositories/ClientRepository'),
    import('../../modules/activities/infrastructure/repositories/ActivityRepository'),
    import('../../modules/platformSettings/infrastructure/repositories/PlatformSettingsRepository'),
    import('../database/pool'),
  ])

  ;(poolModule.pool as any).query = async () => {
    calls.database += 1
    throw new Error('Database access is forbidden in the C-01 authorization test')
  }
  ;(poolModule.pool as any).connect = async () => {
    calls.database += 1
    throw new Error('Database access is forbidden in the C-01 authorization test')
  }

  ;(ClientRepository.prototype as any).findAll = async () => {
    calls.clientList += 1
    return { clients: [], total: 0 }
  }
  ;(ClientRepository.prototype as any).create = async (dto: any) => {
    calls.clientCreate += 1
    return { id: 'client-created-by-test', ...dto }
  }

  ;(PortalRepository.prototype as any).validateToken = async (token: string) => {
    calls.portalValidate += 1
    if (token !== 'private-test-token') return null
    return {
      tokenId: 'portal-token-id',
      clientId: 'client-id',
      companyId: 'company-id',
      expiresAt: new Date(Date.now() + 60_000),
      client: { id: 'client-id', name: 'Client test', email: 'client@test.invalid' },
    }
  }
  ;(PortalRepository.prototype as any).getClient = async () => ({
    id: 'client-id',
    name: 'Client test',
    email: 'client@test.invalid',
  })
  ;(PortalRepository.prototype as any).listPosts = async () => []
  ;(PortalRepository.prototype as any).listFeedbacks = async () => []
  ;(PortalRepository.prototype as any).markClientAccess = async () => undefined
  ;(PortalRepository.prototype as any).approvePost = async () => {
    calls.portalApprove += 1
    return { kind: 'completed', status: 'approved', snapshot: [] }
  }
  ;(PortalRepository.prototype as any).rejectPost = async () => {
    calls.portalReject += 1
    return { kind: 'completed', status: 'rejected', snapshot: [] }
  }
  ;(PortalRepository.prototype as any).saveFeedback = async () => ({ id: 'feedback-id' })

  ;(ActivityRepository.prototype as any).createForClient = async () => {
    calls.activity += 1
  }
  ;(ActivityRepository.prototype as any).createForPost = async () => {
    calls.activity += 1
  }
  ;(PlatformSettingsRepository.prototype as any).find = async () => ({
    retention: { executed_attachment_hours: 24 },
    features: { soundtrack: false },
    client_fields: { whatsapp: 'optional', segment: 'optional', deadline_days: 'optional', document: 'hidden' },
    post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'hidden' },
    portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true, approval_mode: 'content' },
    updated_at: null,
  })

  const [{ JwtProvider }, { createApp }] = await Promise.all([
    import('../../modules/auth/infrastructure/JwtProvider'),
    import('../../app'),
  ])

  jwtProvider = new JwtProvider()
  adminToken = jwtProvider.sign(
    {
      type: 'admin',
      userId: 'admin-id',
      email: 'admin@test.invalid',
      role: 'admin',
      permissions: ['clients'],
    },
    '5m',
  )
  viewerToken = jwtProvider.sign(
    {
      type: 'admin',
      userId: 'viewer-id',
      email: 'viewer@test.invalid',
      role: 'viewer',
      permissions: [],
    },
    '5m',
  )
  clientToken = jwtProvider.sign(
    {
      type: 'client',
      clientId: 'client-id',
      email: 'client@test.invalid',
      companyId: 'company-id',
    },
    '5m',
  )
  expiredToken = jwtProvider.sign(
    {
      type: 'admin',
      userId: 'expired-admin-id',
      email: 'expired@test.invalid',
      role: 'admin',
    },
    '-1s',
  )
  wrongContextToken = jwtProvider.sign(
    {
      type: 'portal',
      userId: 'wrong-context-id',
      email: 'wrong-context@test.invalid',
      role: 'admin',
    },
    '5m',
  )
  invalidAdminRoleToken = jwtProvider.sign(
    {
      type: 'admin',
      userId: 'invalid-role-id',
      email: 'invalid-role@test.invalid',
      role: 'client',
    },
    '5m',
  )
  legacyAmbiguousToken = jwtProvider.sign(
    {
      userId: 'legacy-admin-id',
      email: 'legacy@test.invalid',
      role: 'admin',
    },
    '5m',
  )
  refreshAccessToken = jwtProvider.sign(
    {
      type: 'refresh',
      context: 'admin',
      userId: 'admin-id',
      email: 'admin@test.invalid',
    },
    '5m',
  )

  const app = createApp()
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve)
    server.once('error', reject)
  })
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  if (!server) return
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
})

test('admin and client login issue explicitly typed access and refresh tokens', async () => {
  const bcryptjs = (await import('bcryptjs')).default
  const [{ AuthService }, { JwtProvider }] = await Promise.all([
    import('../../modules/auth/application/services/AuthService'),
    import('../../modules/auth/infrastructure/JwtProvider'),
  ])
  const passwordHash = await bcryptjs.hash('ValidPassword!1', 4)
  const repository = {
    findByEmail: async () => ({
      id: 'admin-id',
      email: 'admin@test.invalid',
      name: 'Admin',
      role: 'admin',
      permissions: ['clients'],
      password_hash: passwordHash,
      is_active: true,
    }),
    findClientByEmail: async () => ({
      id: 'client-id',
      email: 'client@test.invalid',
      name: 'Client',
      password_hash: passwordHash,
      is_active: true,
    }),
    findClientById: async () => ({
      id: 'client-id',
      email: 'client@test.invalid',
      name: 'Client',
      password_hash: passwordHash,
      is_active: true,
    }),
    updateClientLastAccess: async () => undefined,
  }
  const provider = new JwtProvider()
  const service = new AuthService(provider, repository as any)

  const admin = await service.loginAdmin({
    email: 'admin@test.invalid',
    password: 'ValidPassword!1',
    userType: 'admin',
  })
  const client = await service.loginClient({
    email: 'client@test.invalid',
    password: 'ValidPassword!1',
    userType: 'client',
  })

  assert.equal(provider.verify(admin.accessToken).type, 'admin')
  assert.equal(provider.verify(admin.refreshToken).context, 'admin')
  assert.equal(provider.verify(client.accessToken).type, 'client')
  assert.equal(provider.verify(client.refreshToken).context, 'client')
  assert.equal((await service.refreshToken(admin.refreshToken)).user.type, 'admin')
  assert.equal((await service.refreshToken(client.refreshToken)).user.type, 'client')
})

test('legacy or ambiguous refresh tokens are rejected instead of promoted to admin', async () => {
  const [{ AuthService }, { JwtProvider }] = await Promise.all([
    import('../../modules/auth/application/services/AuthService'),
    import('../../modules/auth/infrastructure/JwtProvider'),
  ])
  const provider = new JwtProvider()
  const service = new AuthService(provider, {
    findByEmail: async () => assert.fail('legacy token must not query an admin identity'),
    findClientById: async () => assert.fail('legacy token must not query a client identity'),
  } as any)
  const legacyRefresh = provider.sign(
    { type: 'refresh', userId: 'legacy-id', email: 'legacy@test.invalid' },
    '5m',
  )
  const mixedRefresh = provider.sign(
    {
      type: 'refresh',
      context: 'admin',
      userId: 'admin-id',
      clientId: 'client-id',
      email: 'admin@test.invalid',
    },
    '5m',
  )

  await assert.rejects(() => service.refreshToken(legacyRefresh), /Token refresh failed/)
  await assert.rejects(() => service.refreshToken(mixedRefresh), /Token refresh failed/)
})

test('identity matrix returns the expected HTTP boundary responses', async t => {
  const cases = [
    {
      name: 'missing token',
      headers: {},
      expected: 401,
    },
    {
      name: 'valid admin token with permission',
      headers: bearer(adminToken),
      expected: 200,
    },
    {
      name: 'valid viewer token on permitted read',
      headers: bearer(viewerToken),
      expected: 200,
    },
    {
      name: 'valid client token',
      headers: bearer(clientToken),
      expected: 403,
    },
    {
      name: 'private portal token used as bearer',
      headers: bearer('private-test-token'),
      expected: 401,
    },
    {
      name: 'invalid token',
      headers: bearer('not-a-jwt'),
      expected: 401,
    },
    {
      name: 'expired token',
      headers: bearer(expiredToken),
      expected: 401,
    },
    {
      name: 'valid signature with wrong context',
      headers: bearer(wrongContextToken),
      expected: 403,
    },
    {
      name: 'admin context with a non-administrative role',
      headers: bearer(invalidAdminRoleToken),
      expected: 403,
    },
    {
      name: 'legacy ambiguous access token',
      headers: bearer(legacyAmbiguousToken),
      expected: 403,
    },
    {
      name: 'refresh token used as access token',
      headers: bearer(refreshAccessToken),
      expected: 403,
    },
  ]

  for (const item of cases) {
    await t.test(item.name, async () => {
      const response = await request('/api/v1/clients', { headers: item.headers })
      assert.equal(response.status, item.expected)
      if (item.expected === 403) {
        assert.equal(response.body.error, 'Administrative access required')
        assert.equal(response.body.code, 'FORBIDDEN')
      }
    })
  }
})

test('viewer remains read-only and admin write access remains unchanged', async () => {
  const viewer = await request('/api/v1/clients', {
    method: 'POST',
    headers: { ...bearer(viewerToken), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Blocked', email: 'blocked@test.invalid', password: 'Password!1' }),
  })
  assert.equal(viewer.status, 403)
  assert.equal(viewer.body.error, 'Insufficient access')

  const admin = await request('/api/v1/clients', {
    method: 'POST',
    headers: { ...bearer(adminToken), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Allowed', email: 'allowed@test.invalid', password: 'Password!1' }),
  })
  assert.equal(admin.status, 201)
  assert.equal(calls.clientCreate, 1)
})

test('client JWT is rejected before every representative administrative handler', async t => {
  const baseline = { ...calls }
  const routes = [
    ['administrative read', 'GET', '/api/v1/clients'],
    ['client creation', 'POST', '/api/v1/clients'],
    ['client editing', 'PUT', '/api/v1/clients/client-id'],
    ['status change', 'PATCH', '/api/v1/posts/post-id/status'],
    ['file upload', 'POST', '/api/v1/posts/post-id/files'],
    ['post deletion', 'DELETE', '/api/v1/posts/post-id'],
    ['irreversible client deletion', 'DELETE', '/api/v1/clients/client-id/permanent'],
    ['soundtrack administration', 'PUT', '/api/v1/posts/post-id/soundtrack'],
    ['demo reset', 'POST', '/api/v1/maintenance/reset-demo-data'],
    ['administrative users', 'GET', '/api/v1/users'],
    ['approval queue', 'GET', '/api/v1/approvals/queue'],
    ['feedback metrics', 'GET', '/api/v1/feedback/monthly'],
    ['activity history', 'GET', '/api/v1/activities'],
    ['administrative notifications', 'GET', '/api/v1/notifications'],
  ] as const

  for (const [name, method, path] of routes) {
    await t.test(name, async () => {
      const response = await request(path, {
        method,
        headers: { ...bearer(clientToken), 'content-type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.error, 'Administrative access required')
      assert.equal(response.body.code, 'FORBIDDEN')
    })
  }

  assert.deepEqual(calls, baseline)
  assert.equal(calls.database, 0)
})

test('authenticated client portal accepts only client access tokens', async () => {
  const client = await request('/api/v1/client-portal', { headers: bearer(clientToken) })
  assert.equal(client.status, 200)
  assert.deepEqual(client.body.posts, [])

  const admin = await request('/api/v1/client-portal', { headers: bearer(adminToken) })
  assert.equal(admin.status, 403)
  assert.equal(admin.body.error, 'Client access required')
  assert.equal(admin.body.code, 'FORBIDDEN')
})

test('client approval and adjustment remain available only on client routes', async () => {
  const beforeApprove = calls.portalApprove
  const beforeReject = calls.portalReject

  const approve = await request('/api/v1/client-portal/posts/post-id/approve', {
    method: 'POST',
    headers: { ...bearer(clientToken), 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(approve.status, 200)
  assert.equal(calls.portalApprove, beforeApprove + 1)

  const reject = await request('/api/v1/client-portal/posts/post-id/reject', {
    method: 'POST',
    headers: { ...bearer(clientToken), 'content-type': 'application/json' },
    body: JSON.stringify({ comment: 'Please adjust this post' }),
  })
  assert.equal(reject.status, 200)
  assert.equal(calls.portalReject, beforeReject + 1)
})

test('private portal token remains scoped to the public portal route', async () => {
  const portal = await request('/api/v1/portal/private-test-token')
  assert.equal(portal.status, 200)
  assert.deepEqual(portal.body.posts, [])
  assert.ok(calls.portalValidate > 0)

  const administrative = await request('/api/v1/clients', {
    headers: bearer('private-test-token'),
  })
  assert.equal(administrative.status, 401)
  assert.equal(calls.database, 0)
})
