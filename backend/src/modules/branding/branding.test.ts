import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_branding'
process.env.JWT_SECRET = 'branding-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const png = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
  png.write('IHDR', 12, 'ascii')
  png.writeUInt32BE(1, 16)
  png.writeUInt32BE(1, 20)
  return {
    fieldname: 'file', originalname: 'logo.png', encoding: '7bit', mimetype: 'image/png',
    size: png.length, destination: '', filename: '', path: '', buffer: png, stream: null as any,
    ...overrides,
  }
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    institutionalName: 'Postinder', logoBucket: null, logoStoragePath: null,
    logoMimeType: null, logoSizeBytes: null, logoVersion: 0, updatedAt: null,
    ...overrides,
  }
}

test('the official migrator discovers the additive branding migration without touching business records', async () => {
  const { listStructuralMigrationFiles } = await import('../../shared/database/migrationCatalog')
  const files = await listStructuralMigrationFiles()
  assert.equal(files[files.length - 1], '017_platform_branding.sql')
  const sql = readFileSync(path.resolve(process.cwd(), '..', 'database', 'migrations', '017_platform_branding.sql'), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS platform_branding/)
  assert.match(sql, /logo_bucket TEXT/)
  assert.match(sql, /logo_storage_path TEXT/)
  assert.match(sql, /logo_version BIGINT NOT NULL DEFAULT 0/)
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE FROM|DROP|TRUNCATE)\s+(?:posts|clients|files|activity_events)\b/i)
})

test('branding content validation accepts PNG and rejects MIME, size, empty and corrupt files', async () => {
  const { assertBrandingLogoFile, MAX_BRANDING_LOGO_SIZE } = await import('../../shared/upload/multer')
  await assert.doesNotReject(() => assertBrandingLogoFile(file()))
  await assert.rejects(
    () => assertBrandingLogoFile(file({ originalname: 'logo.svg', mimetype: 'image/svg+xml' })),
    (error: any) => error.code === 'UNSUPPORTED_BRANDING_TYPE' && error.statusCode === 415,
  )
  await assert.rejects(
    () => assertBrandingLogoFile(file({ originalname: 'logo.png', mimetype: 'image/jpeg' })),
    (error: any) => error.code === 'UNSUPPORTED_BRANDING_TYPE',
  )
  await assert.rejects(
    () => assertBrandingLogoFile(file({ size: MAX_BRANDING_LOGO_SIZE + 1 })),
    (error: any) => error.code === 'BRANDING_FILE_TOO_LARGE' && error.statusCode === 413,
  )
  await assert.rejects(
    () => assertBrandingLogoFile(file({ size: 0, buffer: Buffer.alloc(0) })),
    (error: any) => error.code === 'EMPTY_BRANDING_FILE',
  )
  await assert.rejects(
    () => assertBrandingLogoFile(file({ buffer: Buffer.from('not-an-image'), size: 12 })),
    (error: any) => error.code === 'INVALID_BRANDING_CONTENT',
  )
})

test('public branding supports empty, configured, legacy and unavailable-storage states without leaking identity', async () => {
  const { BrandingService } = await import('./application/BrandingService')
  const responses = []
  for (const storedRecord of [
    null,
    record(),
    record({
      logoBucket: 'private-internal-bucket-name', logoStoragePath: 'branding/logo/secret-object.png',
      logoMimeType: 'image/png', logoSizeBytes: 128, logoVersion: 3,
      updatedAt: '2026-08-05T12:00:00.000Z',
    }),
  ]) {
    const service = new BrandingService({ find: async () => storedRecord } as any, {
      store: async () => assert.fail('read must not upload'),
      remove: async () => assert.fail('read must not remove'),
      publicUrl: () => storedRecord?.logoStoragePath ? 'https://cdn.test/logo-v3.png' : null,
    })
    responses.push(await service.getPublicBranding())
  }
  assert.deepEqual(responses[0], { institutional_name: 'Postinder', logo_url: null, logo_version: 0, updated_at: null })
  assert.deepEqual(responses[1], responses[0])
  assert.equal(responses[2].logo_url, 'https://cdn.test/logo-v3.png')
  assert.equal(responses[2].logo_version, 3)
  assert.doesNotMatch(JSON.stringify(responses[2]), /bucket|storage|secret-object/)

  const unavailable = new BrandingService({ find: async () => record({ logoBucket: 'bucket', logoStoragePath: 'path' }) } as any, {
    store: async () => assert.fail(), remove: async () => assert.fail(),
    publicUrl: () => { throw new Error('storage unavailable') },
  })
  assert.equal((await unavailable.getPublicBranding()).logo_url, null)
})

test('replacement persists the new reference before removing the previous object', async () => {
  const { BrandingService } = await import('./application/BrandingService')
  const events: string[] = []
  const stored = { bucket: 'bucket', storagePath: 'branding/logo/new.png', publicUrl: 'new-url', mimeType: 'image/png', sizeBytes: 24 }
  const service = new BrandingService({
    async find() { return null },
    async saveLogo() {
      events.push('persist-new')
      return {
        branding: record({ logoBucket: stored.bucket, logoStoragePath: stored.storagePath, logoMimeType: stored.mimeType, logoSizeBytes: stored.sizeBytes, logoVersion: 8 }),
        previous: { bucket: 'bucket', storagePath: 'branding/logo/old.png' },
      }
    },
  } as any, {
    store: async () => { events.push('upload-new'); return stored },
    remove: async reference => { events.push(`remove:${reference.storagePath}`); return { removed: true } },
    publicUrl: reference => `https://cdn.test/${reference.storagePath}`,
  })
  const response = await service.replaceLogo(file())
  assert.deepEqual(events, ['upload-new', 'persist-new', 'remove:branding/logo/old.png'])
  assert.equal(response.logo_version, 8)
  assert.match(response.logo_url!, /new\.png/)
})

test('persistence failure removes only the new orphan and preserves the previous logo', async () => {
  const { BrandingService } = await import('./application/BrandingService')
  const removals: string[] = []
  const stored = { bucket: 'bucket', storagePath: 'branding/logo/new.png', publicUrl: 'new-url', mimeType: 'image/png', sizeBytes: 24 }
  const service = new BrandingService({
    async find() { return null }, async saveLogo() { throw new Error('database unavailable') },
  } as any, {
    store: async () => stored,
    remove: async reference => { removals.push(reference.storagePath!); return { removed: true } },
    publicUrl: () => null,
  })
  await assert.rejects(() => service.replaceLogo(file()), /database unavailable/)
  assert.deepEqual(removals, ['branding/logo/new.png'])
})

test('removal clears persistence before deleting the former object and tolerates a missing object', async () => {
  const { BrandingService } = await import('./application/BrandingService')
  const events: string[] = []
  const service = new BrandingService({
    async find() { return null },
    async clearLogo() {
      events.push('clear-persistence')
      return { branding: record({ logoVersion: 4 }), previous: { bucket: 'bucket', storagePath: 'branding/logo/old.png' } }
    },
  } as any, {
    store: async () => assert.fail(),
    remove: async () => { events.push('remove-old'); return { removed: false, error: 'not found' } },
    publicUrl: () => null,
  })
  const response = await service.removeLogo()
  assert.deepEqual(events, ['clear-persistence', 'remove-old'])
  assert.equal(response.logo_url, null)
  assert.equal(response.logo_version, 4)
})
