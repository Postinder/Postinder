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

async function createController(repository: Record<string, any>) {
  const { ClientsController } = await import('./presentation/controllers/ClientsController')
  return new ClientsController(repository as any, {
    async createForClient() {},
  } as any)
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

test('client creation persists valid formatted CPF and CNPJ as digits', async t => {
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
      assert.equal(received.document_type, item.type)
      assert.equal(received.document_number, item.digits)
    })
  }
})

test('client creation rejects an invalid document before repository access', async () => {
  let calls = 0
  const controller = await createController({
    async create() {
      calls += 1
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

  assert.equal(state.status, 400)
  assert.deepEqual(state.body, { error: 'Invalid client document' })
  assert.equal(calls, 0)
})

test('client update changes and explicitly removes a document and accepts legacy deadlineDays', async () => {
  const updates: any[] = []
  const controller = await createController({
    async update(_id: string, dto: any) {
      updates.push(dto)
      return { id: 'client-1', ...dto }
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
