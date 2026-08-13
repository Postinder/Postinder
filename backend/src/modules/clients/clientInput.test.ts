import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_clients'
process.env.JWT_SECRET = 'client-hotfix-test-secret'
process.env.LOG_LEVEL = 'error'

import {
  ClientInputValidationError,
  isValidCnpj,
  isValidCpf,
  normalizeClientDocument,
  normalizeDeadlineDays,
} from './domain/clientInput'
import { createPostSchema, updatePostSchema } from '../posts/application/dtos/CreatePostDTO'

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

async function createController(repository: Record<string, any>, settings?: Record<string, any>) {
  const { ClientsController } = await import('./presentation/controllers/ClientsController')
  return new ClientsController(repository as any, {
    async createForClient() {},
  } as any, settings as any)
}

test('CPF and CNPJ validators accept valid numbers and reject invalid check digits', () => {
  assert.equal(isValidCpf('529.982.247-25'), true)
  assert.equal(isValidCpf('529.982.247-24'), false)
  assert.equal(isValidCpf('111.111.111-11'), false)
  assert.equal(isValidCnpj('04.252.011/0001-10'), true)
  assert.equal(isValidCnpj('04.252.011/0001-11'), false)
  assert.equal(isValidCnpj('11.111.111/1111-11'), false)
})

test('document normalization stores digits and keeps an absent document nullable', () => {
  assert.deepEqual(normalizeClientDocument('CPF', '529.982.247-25'), {
    document_type: 'cpf',
    document_number: '52998224725',
  })
  assert.deepEqual(normalizeClientDocument('cnpj', '04.252.011/0001-10'), {
    document_type: 'cnpj',
    document_number: '04252011000110',
  })
  assert.deepEqual(normalizeClientDocument('cpf', ''), {
    document_type: null,
    document_number: null,
  })
})

test('document normalization rejects invalid and incompatible values without echoing them', () => {
  for (const [type, value] of [
    ['cpf', '529.982.247-24'],
    ['cnpj', '04.252.011/0001-11'],
    ['cpf', '04.252.011/0001-10'],
    ['cnpj', '529.982.247-25'],
    ['cpf', 'abc529.982.247-25'],
  ]) {
    assert.throws(
      () => normalizeClientDocument(type, value),
      error => error instanceof ClientInputValidationError
        && error.message === 'Invalid client document'
        && !error.message.includes(String(value)),
    )
  }
})

test('approval deadline normalization preserves custom values and rejects invalid values', () => {
  assert.equal(normalizeDeadlineDays(12), 12)
  assert.equal(normalizeDeadlineDays('18'), 18)
  assert.equal(normalizeDeadlineDays(undefined), undefined)
  assert.throws(() => normalizeDeadlineDays(0), /Invalid approval deadline/)
  assert.throws(() => normalizeDeadlineDays(2.5), /Invalid approval deadline/)
})

test('client creation accepts no document and persists an official custom deadline', async () => {
  let received: any
  const controller = await createController({
    async create(dto: any) {
      received = dto
      return { id: 'client-1', ...dto, password_hash: undefined }
    },
  })
  const { response, state } = createResponse()

  await controller.create({
    body: {
      name: 'Cliente',
      email: 'cliente@example.test',
      password: 'password',
      deadline_days: 12,
    },
    tenantId: 'company-1',
    user: { userId: 'admin-1', role: 'admin' },
  } as any, response as any)

  assert.equal(state.status, 201)
  assert.equal(received.deadline_days, 12)
  assert.equal(received.document_type, null)
  assert.equal(received.document_number, null)
  assert.equal(state.body.data.document_type, null)
  assert.equal(state.body.data.document_number, null)
})

test('client creation ignores CPF/CNPJ even when a caller still sends legacy fields', async t => {
  for (const item of [
    { type: 'cpf', formatted: '529.982.247-25', digits: '52998224725' },
    { type: 'cnpj', formatted: '04.252.011/0001-10', digits: '04252011000110' },
  ]) {
    await t.test(item.type, async () => {
      let received: any
      const controller = await createController({
        async create(dto: any) {
          received = dto
          return { id: `client-${item.type}`, ...dto }
        },
      })
      const { response, state } = createResponse()

      await controller.create({
        body: {
          name: 'Cliente',
          email: `${item.type}@example.test`,
          password: 'password',
          document_type: item.type,
          document_number: item.formatted,
        },
      } as any, response as any)

      assert.equal(state.status, 201)
      assert.equal(received.document_type, null)
      assert.equal(received.document_number, null)
    })
  }
})

test('client creation does not validate or collect a legacy document', async () => {
  let calls = 0
  const controller = await createController({
    async create() {
      calls += 1
      return { id: 'client-1' }
    },
  })
  const { response, state } = createResponse()

  await controller.create({
    body: {
      name: 'Cliente',
      email: 'cliente@example.test',
      password: 'password',
      document_type: 'cpf',
      document_number: '123.456.789-00',
    },
  } as any, response as any)

  assert.equal(state.status, 201)
  assert.equal(calls, 1)
})

test('client update changes and explicitly removes a document and accepts legacy deadlineDays', async () => {
  const updates: any[] = []
  const controller = await createController({
    async update(_id: string, dto: any) {
      updates.push(dto)
      return { id: 'client-1', ...dto }
    },
  }, {
    async get() {
      return {
        retention: { executed_attachment_hours: 24 },
        features: { soundtrack: false },
        client_fields: { whatsapp: 'optional', segment: 'optional', deadline_days: 'optional', document: 'optional' },
        post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'optional' },
        portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true },
      }
    },
  })

  let result = createResponse()
  await controller.update({
    params: { id: 'client-1' },
    body: {
      document_type: 'cpf',
      document_number: '529.982.247-25',
      deadlineDays: 21,
    },
  } as any, result.response as any)
  assert.equal(result.state.status, 200)
  assert.equal(updates[0].document_number, '52998224725')
  assert.equal(updates[0].deadline_days, 21)

  result = createResponse()
  await controller.update({
    params: { id: 'client-1' },
    body: {
      document_type: null,
      document_number: null,
    },
  } as any, result.response as any)
  assert.equal(result.state.status, 200)
  assert.equal(updates[1].document_type, null)
  assert.equal(updates[1].document_number, null)
})

test('client update accepts the portal detailed view only as a boolean', async () => {
  const updates: any[] = []
  const controller = await createController({
    async update(_id: string, dto: any) {
      updates.push(dto)
      return { id: 'client-1', ...dto }
    },
  })

  let result = createResponse()
  await controller.update({ params: { id: 'client-1' }, body: { portal_detailed_view: true } } as any, result.response as any)
  assert.equal(result.state.status, 200)
  assert.equal(updates[0].portal_detailed_view, true)
  assert.equal(updates[0].portal_mode_override, 'detailed')

  result = createResponse()
  await controller.update({ params: { id: 'client-1' }, body: { portal_detailed_view: 'true' } } as any, result.response as any)
  assert.equal(result.state.status, 400)
  assert.equal(updates.length, 1)
})

test('hidden client fields are omitted and cannot block or overwrite historical values', async () => {
  let created: any
  let updated: any
  const controller = await createController({
    async create(dto: any) { created = dto; return { id: 'client-1', ...dto } },
    async update(_id: string, dto: any) { updated = dto; return { id: 'client-1', ...dto } },
  }, {
    async get() {
      return {
        retention: { executed_attachment_hours: 24 },
        features: { soundtrack: false },
        client_fields: { whatsapp: 'hidden', segment: 'hidden', deadline_days: 'hidden', document: 'hidden' },
        post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'optional' },
        portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true },
      }
    },
  })
  let result = createResponse()
  await controller.create({
    body: {
      name: 'Cliente', email: 'client@example.test', password: 'password',
      whatsapp: 'secret-old', segment: 'old', deadline_days: 99,
      document_type: 'cpf', document_number: '52998224725',
    },
  } as any, result.response as any)
  assert.equal(result.state.status, 201)
  assert.equal(created.whatsapp, undefined)
  assert.equal(created.segment, undefined)
  assert.equal(created.deadline_days, undefined)
  assert.equal(created.document_number, null)

  result = createResponse()
  await controller.update({
    params: { id: 'client-1' },
    body: { document_type: null, document_number: null },
  } as any, result.response as any)
  assert.equal(result.state.status, 200)
  assert.equal(Object.prototype.hasOwnProperty.call(updated, 'document_number'), false)
})

test('required client fields are enforced on create and against the effective record on partial update', async () => {
  let createCalls = 0
  let updateCalls = 0
  const requiredSettings = {
    async get() {
      return {
        retention: { executed_attachment_hours: 24 },
        features: { soundtrack: false },
        client_fields: { whatsapp: 'required', segment: 'required', deadline_days: 'required', document: 'required' },
        post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'optional' },
        portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true },
      }
    },
  }
  const repository = {
    async create() { createCalls += 1; return { id: 'client-1' } },
    async findById() {
      return { whatsapp: '', segment: 'Segmento', deadline_days: 7, document_number: '52998224725' }
    },
    async update() { updateCalls += 1; return { id: 'client-1' } },
  }
  const controller = await createController(repository, requiredSettings)
  let result = createResponse()
  await controller.create({ body: { name: 'Cliente', email: 'client@example.test', password: 'password' } } as any, result.response as any)
  assert.equal(result.state.status, 400)
  assert.equal(createCalls, 0)

  result = createResponse()
  await controller.update({ params: { id: 'client-1' }, body: { name: 'Novo nome' } } as any, result.response as any)
  assert.equal(result.state.status, 400)
  assert.equal(result.state.body.error, 'whatsapp is required')
  assert.equal(updateCalls, 0)
})

test('E-mail Marketing accepts a trimmed HTTP preview without files and rejects unsafe protocols', () => {
  const valid = createPostSchema.parse({
    title: 'Email',
    clientId: '00000000-0000-4000-8000-000000000001',
    channels: ['E-mail Marketing'],
    emailLink: '  https://example.test/preview  ',
  })
  assert.equal(valid.emailLink, 'https://example.test/preview')
  for (const emailLink of ['', 'javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test']) {
    assert.equal(createPostSchema.safeParse({
      title: 'Email',
      clientId: '00000000-0000-4000-8000-000000000001',
      channels: ['E-mail Marketing'],
      emailLink,
    }).success, false)
  }
})

test('new posts reject 3A3R while partial updates can preserve an unread legacy channel', () => {
  assert.equal(createPostSchema.safeParse({
    title: 'Legacy',
    clientId: '00000000-0000-4000-8000-000000000001',
    channels: ['3A3R'],
  }).success, false)
  assert.equal(updatePostSchema.safeParse({ channels: ['3A3R'] }).success, true)
})

test('post identity invariants require client, title and at least one channel', () => {
  const base = {
    title: 'Post valido',
    clientId: '00000000-0000-4000-8000-000000000001',
    channels: ['Instagram/Facebook'],
  }
  assert.equal(createPostSchema.safeParse(base).success, true)
  assert.equal(createPostSchema.safeParse({ ...base, channels: [] }).success, false)
  assert.equal(createPostSchema.safeParse({ ...base, channels: undefined }).success, false)
  assert.equal(createPostSchema.safeParse({ ...base, title: '' }).success, false)
  assert.equal(createPostSchema.safeParse({ ...base, clientId: undefined }).success, false)
  assert.equal(updatePostSchema.safeParse({ channels: [] }).success, false)
})

test('portal queue orders scheduled dates first, then creation and stable id, with undated posts last', async () => {
  const { comparePortalQueueItems, normalizePortalEmailLink } = await import('../portal/infrastructure/repositories/PortalRepository')
  const posts = [
    { id: 'd', scheduledDate: null, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'c', scheduledDate: '2026-08-09', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', scheduledDate: '2026-08-08', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'a', scheduledDate: '2026-08-08', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'e', scheduledDate: null, createdAt: '2026-01-02T00:00:00Z' },
  ]
  assert.deepEqual(posts.sort(comparePortalQueueItems).map(post => post.id), ['a', 'b', 'c', 'd', 'e'])
  assert.equal(normalizePortalEmailLink(' https://example.test/email '), 'https://example.test/email')
  assert.equal(normalizePortalEmailLink('javascript:alert(1)'), null)
})

test('recoverable portal tokens are encrypted and authenticated', async () => {
  const { encryptPortalToken, decryptPortalToken } = await import('../portal/infrastructure/portalTokenCipher')
  const token = 'private-portal-token-value'
  const encrypted = encryptPortalToken(token)
  assert.notEqual(encrypted.includes(token), true)
  assert.equal(decryptPortalToken(encrypted), token)
  const replacement = encrypted.endsWith('x') ? 'y' : 'x'
  assert.equal(decryptPortalToken(`${encrypted.slice(0, -1)}${replacement}`), null)
})

test('initial portal link is issued once and administrative recovery returns the same token', async () => {
  const poolModule = await import('../../shared/database/pool')
  const { PortalRepository } = await import('../portal/infrastructure/repositories/PortalRepository')
  const originalConnect = poolModule.pool.connect.bind(poolModule.pool)
  let insertedCiphertext = ''
  let insertions = 0
  ;(poolModule.pool as any).connect = async () => ({
    async query(sql: string, params?: any[]) {
      if (sql.includes('SELECT id, company_id FROM clients')) return { rows: [{ id: 'client-1', company_id: 'company-1' }] }
      if (sql.includes('SELECT id, expires_at')) return { rows: [] }
      if (sql.includes('INSERT INTO client_portal_tokens')) {
        insertions += 1
        insertedCiphertext = params?.[3]
        return { rows: [{ id: 'token-1', created_at: '2026-08-06', expires_at: '2026-08-21' }] }
      }
      return { rows: [] }
    },
    release() {},
  })
  try {
    const repository = new PortalRepository()
    const issued = await repository.createToken({ clientId: 'client-1', companyId: 'company-1' })
    assert.equal(issued?.existing, false)
    assert.ok(issued && 'token' in issued)
    const originalToken = issued && 'token' in issued ? issued.token : ''

    ;(poolModule.pool as any).connect = async () => ({
      async query(sql: string) {
        if (sql.includes('SELECT t.id, t.expires_at')) {
          return { rows: [{ id: 'token-1', created_at: '2026-08-06', expires_at: '2026-08-21', token_ciphertext: insertedCiphertext }] }
        }
        return { rows: [] }
      },
      release() {},
    })
    const recovered = await repository.getActiveToken({ clientId: 'client-1', companyId: 'company-1' })
    assert.equal(recovered?.token, originalToken)
    assert.equal(insertions, 1)
  } finally {
    ;(poolModule.pool as any).connect = originalConnect
  }
})

test('portal link replacement rolls back revocation when insertion fails', async () => {
  const poolModule = await import('../../shared/database/pool')
  const { PortalRepository } = await import('../portal/infrastructure/repositories/PortalRepository')
  const originalConnect = poolModule.pool.connect.bind(poolModule.pool)
  const statements: string[] = []
  ;(poolModule.pool as any).connect = async () => ({
    async query(sql: string) {
      statements.push(sql)
      if (sql.includes('SELECT id, company_id FROM clients')) return { rows: [{ id: 'client-1', company_id: 'company-1' }] }
      if (sql.includes('SELECT id, expires_at')) return { rows: [{ id: 'old-token' }] }
      if (sql.includes('INSERT INTO client_portal_tokens')) throw new Error('simulated insertion failure')
      return { rows: [] }
    },
    release() {},
  })
  try {
    await assert.rejects(() => new PortalRepository().replaceToken({ clientId: 'client-1', companyId: 'company-1' }))
    assert.ok(statements.some(sql => sql === 'ROLLBACK'))
    assert.ok(statements.some(sql => sql.includes('SET revoked_at = NOW()')))
    assert.equal(statements.some(sql => sql === 'COMMIT'), false)
  } finally {
    ;(poolModule.pool as any).connect = originalConnect
  }
})

test('client list and detail preserve official document fields for legacy and current clients', async () => {
  const legacy = {
    id: 'legacy',
    document_type: null,
    document_number: null,
    deadline_days: 7,
  }
  const current = {
    id: 'current',
    document_type: 'cpf',
    document_number: '52998224725',
    deadline_days: 12,
  }
  const controller = await createController({
    async findAll() {
      return { clients: [legacy, current], total: 2 }
    },
    async findById() {
      return current
    },
  })

  const list = createResponse()
  await controller.list({ query: {} } as any, list.response as any)
  assert.deepEqual(list.state.body.data, [legacy, current])

  const detail = createResponse()
  await controller.getById({ params: { id: 'current' } } as any, detail.response as any)
  assert.deepEqual(detail.state.body.data, current)
})

test('repository and idempotent migration cover persistence without document uniqueness or snapshots', () => {
  const repository = readFileSync(
    path.resolve(process.cwd(), 'src/modules/clients/infrastructure/repositories/ClientRepository.ts'),
    'utf8',
  )
  const migration = readFileSync(
    path.resolve(process.cwd(), '../database/migrations/016_client_documents.sql'),
    'utf8',
  )

  assert.match(repository, /INSERT INTO clients[\s\S]*document_type, document_number/)
  assert.match(repository, /document_type = \$\$\{paramIndex\}/)
  assert.match(repository, /RETURNING[\s\S]*document_type, document_number/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS document_type VARCHAR\(4\)/)
  assert.match(migration, /IF NOT EXISTS \([\s\S]*clients_document_pair_check/)
  assert.match(migration, /document_number ~ '\^\[0-9\]\{11\}\$'/)
  assert.match(migration, /document_number ~ '\^\[0-9\]\{14\}\$'/)
  assert.doesNotMatch(migration, /UNIQUE/i)
  assert.doesNotMatch(repository, /snapshot/i)
})

test('migration 018 is additive and defaults old clients to the simplified portal', () => {
  const migration = readFileSync(
    path.resolve(process.cwd(), '../database/migrations/018_client_portal_preferences_and_recoverable_links.sql'),
    'utf8',
  )
  assert.match(migration, /ADD COLUMN IF NOT EXISTS portal_detailed_view BOOLEAN NOT NULL DEFAULT FALSE/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS token_ciphertext TEXT/)
  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|TRUNCATE)\b/i)
})

test('portal decisions conditionally include soundtrack state without removing its infrastructure', () => {
  const portalRepository = readFileSync(
    path.resolve(process.cwd(), 'src/modules/portal/infrastructure/repositories/PortalRepository.ts'),
    'utf8',
  )
  const soundtrackRepository = readFileSync(
    path.resolve(process.cwd(), 'src/modules/soundtracks/infrastructure/repositories/SoundtrackRepository.ts'),
    'utf8',
  )
  assert.match(portalRepository, /includeSoundtrack: settings\.features\.soundtrack/)
  assert.match(soundtrackRepository, /options\.includeSoundtrack === false/)
  assert.match(soundtrackRepository, /post_soundtrack_versions/)
  assert.match(soundtrackRepository, /post_soundtrack_decisions/)
})
