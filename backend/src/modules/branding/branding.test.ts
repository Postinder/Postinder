import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readdir, unlink } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_branding'
process.env.JWT_SECRET = 'branding-test-secret-not-for-production'
process.env.LOG_LEVEL = 'error'

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const buffer = overrides.buffer || Buffer.from('branding-service-test')
  return {
    fieldname: 'file', originalname: 'logo.png', encoding: '7bit', mimetype: 'image/png',
    size: overrides.size ?? buffer.length, destination: '', filename: '', path: '', buffer, stream: null as any,
    ...overrides,
  }
}

async function validImage(format: 'png' | 'jpeg' | 'webp') {
  const image = sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 125, g: 0, b: 56, alpha: 1 },
    },
  })
  return format === 'png'
    ? image.png().toBuffer()
    : format === 'jpeg'
      ? image.jpeg().toBuffer()
      : image.webp().toBuffer()
}

type BinaryChunk = { type: string; offset: number; dataStart: number; dataEnd: number; end: number }

function pngChunks(content: Buffer) {
  const chunks: BinaryChunk[] = []
  for (let offset = 8; offset + 12 <= content.length;) {
    const length = content.readUInt32BE(offset)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const end = dataEnd + 4
    chunks.push({ type: content.subarray(offset + 4, dataStart).toString('ascii'), offset, dataStart, dataEnd, end })
    offset = end
  }
  return chunks
}

function createPngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])) >>> 0, 8 + data.length)
  return chunk
}

function createValidSingleFrameApng(png: Buffer) {
  const chunks = pngChunks(png)
  const ihdr = chunks.find(chunk => chunk.type === 'IHDR')!
  const firstIdat = chunks.find(chunk => chunk.type === 'IDAT')!
  const animationControl = Buffer.alloc(8)
  animationControl.writeUInt32BE(1, 0)
  animationControl.writeUInt32BE(0, 4)
  const frameControl = Buffer.alloc(26)
  frameControl.writeUInt32BE(0, 0)
  frameControl.writeUInt32BE(png.readUInt32BE(ihdr.dataStart), 4)
  frameControl.writeUInt32BE(png.readUInt32BE(ihdr.dataStart + 4), 8)
  frameControl.writeUInt16BE(1, 20)
  frameControl.writeUInt16BE(10, 22)
  return Buffer.concat([
    png.subarray(0, firstIdat.offset),
    createPngChunk('acTL', animationControl),
    createPngChunk('fcTL', frameControl),
    png.subarray(firstIdat.offset),
  ])
}

function riffChunks(content: Buffer, start = 12, end = content.length) {
  const chunks: BinaryChunk[] = []
  for (let offset = start; offset + 8 <= end;) {
    const length = content.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    chunks.push({ type: content.subarray(offset, offset + 4).toString('ascii'), offset, dataStart, dataEnd, end: dataEnd + (length % 2) })
    offset = dataEnd + (length % 2)
  }
  return chunks
}

async function animatedWebp(corruptSecondFrame = false) {
  const [first, second] = await Promise.all([
    sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(),
    sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toBuffer(),
  ])
  const animated = await sharp([first, second], { join: { animated: true } })
    .webp({ loop: 0, delay: [100, 100], lossless: true })
    .toBuffer()
  if (!corruptSecondFrame) return animated

  const frames = riffChunks(animated).filter(chunk => chunk.type === 'ANMF')
  assert.equal(frames.length, 2)
  const secondFrameChunks = riffChunks(animated, frames[1].dataStart + 16, frames[1].dataEnd)
  const imageData = secondFrameChunks.find(chunk => chunk.type === 'VP8L' || chunk.type === 'VP8 ')!
  const corrupt = Buffer.from(animated)
  corrupt[imageData.dataStart] = 0
  await assert.rejects(() => sharp(corrupt, { animated: true, failOn: 'warning' }).raw().toBuffer())
  return corrupt
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
  assert.ok(files.includes('017_platform_branding.sql'))
  assert.equal(files[files.length - 1], '024_portal_positive_reaction.sql')
  const sql = readFileSync(path.resolve(process.cwd(), '..', 'database', 'migrations', '017_platform_branding.sql'), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS platform_branding/)
  assert.match(sql, /logo_bucket TEXT/)
  assert.match(sql, /logo_storage_path TEXT/)
  assert.match(sql, /logo_version BIGINT NOT NULL DEFAULT 0/)
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE FROM|DROP|TRUNCATE)\s+(?:posts|clients|files|activity_events)\b/i)
})

test('branding content validation accepts only complete static PNG, JPEG and WebP images', async () => {
  const { assertBrandingLogoFile, MAX_BRANDING_LOGO_SIZE } = await import('../../shared/upload/multer')
  const [png, jpeg, webp] = await Promise.all([validImage('png'), validImage('jpeg'), validImage('webp')])
  await assert.doesNotReject(() => assertBrandingLogoFile(file({ buffer: png, originalname: 'Lógó.PNG', mimetype: 'image/png' })))
  await assert.doesNotReject(() => assertBrandingLogoFile(file({ buffer: jpeg, originalname: 'logo.JPEG', mimetype: 'image/jpeg' })))
  await assert.doesNotReject(() => assertBrandingLogoFile(file({ buffer: webp, originalname: 'logo.webp', mimetype: 'image/webp' })))
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
  await assert.rejects(
    () => assertBrandingLogoFile(file({ buffer: png, originalname: 'logo.jpg', mimetype: 'image/jpeg' })),
    (error: any) => error.code === 'INVALID_BRANDING_CONTENT',
  )

  const chunks = pngChunks(png)
  const ihdr = chunks.find(chunk => chunk.type === 'IHDR')!
  const idat = chunks.find(chunk => chunk.type === 'IDAT')!
  const iend = chunks.find(chunk => chunk.type === 'IEND')!
  const pngSignature = png.subarray(0, 8)
  const truncatedPngHeader = png.subarray(0, 20)
  const oversizedPngChunk = Buffer.from(png)
  oversizedPngChunk.writeUInt32BE(0xffffffff, idat.offset)
  const pngWithBadIhdrCrc = Buffer.from(png)
  pngWithBadIhdrCrc[ihdr.dataEnd] ^= 1
  const pngWithBadIdatCrc = Buffer.from(png)
  pngWithBadIdatCrc[idat.dataEnd] ^= 1
  const pngWithBadIendCrc = Buffer.from(png)
  pngWithBadIendCrc[iend.dataEnd] ^= 1
  const pngWithoutEnd = png.subarray(0, iend.offset)
  const pngWithTrailingData = Buffer.concat([png, Buffer.from('trailing-data')])
  const apng = createValidSingleFrameApng(png)
  const [validAnimatedWebp, corruptAnimatedWebp] = await Promise.all([animatedWebp(), animatedWebp(true)])
  const minimalJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const truncatedJpeg = jpeg.subarray(0, Math.max(4, jpeg.length - 10))
  const incompleteWebp = webp.subarray(0, 16)
  const mismatchedWebpSize = Buffer.from(webp)
  mismatchedWebpSize.writeUInt32LE(webp.length + 32, 4)

  for (const [name, invalid] of [
    ['PNG signature only', file({ buffer: pngSignature, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG truncated IHDR', file({ buffer: truncatedPngHeader, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG chunk beyond input', file({ buffer: oversizedPngChunk, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG invalid IHDR CRC', file({ buffer: pngWithBadIhdrCrc, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG invalid IDAT CRC', file({ buffer: pngWithBadIdatCrc, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG invalid IEND CRC', file({ buffer: pngWithBadIendCrc, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG without IEND', file({ buffer: pngWithoutEnd, originalname: 'logo.png', mimetype: 'image/png' })],
    ['PNG trailing data', file({ buffer: pngWithTrailingData, originalname: 'logo.png', mimetype: 'image/png' })],
    ['APNG', file({ buffer: apng, originalname: 'logo.png', mimetype: 'image/png' })],
    ['JPEG markers only', file({ buffer: minimalJpeg, originalname: 'logo.jpg', mimetype: 'image/jpeg' })],
    ['JPEG truncated segment', file({ buffer: truncatedJpeg, originalname: 'logo.jpeg', mimetype: 'image/jpeg' })],
    ['WebP incomplete RIFF', file({ buffer: incompleteWebp, originalname: 'logo.webp', mimetype: 'image/webp' })],
    ['WebP mismatched RIFF size', file({ buffer: mismatchedWebpSize, originalname: 'logo.webp', mimetype: 'image/webp' })],
    ['animated WebP', file({ buffer: validAnimatedWebp, originalname: 'logo.webp', mimetype: 'image/webp' })],
    ['animated WebP with corrupt later frame', file({ buffer: corruptAnimatedWebp, originalname: 'logo.webp', mimetype: 'image/webp' })],
  ] as const) {
    await assert.rejects(
      () => assertBrandingLogoFile(invalid),
      (error: any) => error.code === 'INVALID_BRANDING_CONTENT' && error.statusCode === 415,
      name,
    )
  }

  const tooManyPixels = await sharp({
    create: { width: 4097, height: 4097, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png({ compressionLevel: 9 }).toBuffer()
  assert.ok(tooManyPixels.length < MAX_BRANDING_LOGO_SIZE)
  await assert.rejects(
    () => assertBrandingLogoFile(file({ buffer: tooManyPixels, originalname: 'large.png', mimetype: 'image/png' })),
    (error: any) => error.code === 'INVALID_BRANDING_CONTENT' && error.statusCode === 415,
  )
})

test('branding metadata accepts absent or single pages and rejects multi-page metadata', async () => {
  const { hasSingleStaticPage } = await import('../../shared/upload/multer')
  assert.equal(hasSingleStaticPage({ format: 'png', width: 1, height: 1 }), true)
  assert.equal(hasSingleStaticPage({ format: 'png', width: 1, height: 1, pages: 1 }), true)
  assert.equal(hasSingleStaticPage({ format: 'webp', width: 1, height: 1, pages: 2 }), false)
  assert.equal(hasSingleStaticPage({ format: 'webp', width: 1, height: 1, pages: 0 }), false)
})

test('branding decode concurrency is bounded and always releases its slots', async () => {
  const { runWithBrandingDecodeSlot } = await import('../../shared/upload/multer')
  let release!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  let started = 0
  const occupy = () => runWithBrandingDecodeSlot(async () => {
    started += 1
    await hold
  })
  const first = occupy()
  const second = occupy()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(started, 2)
  try {
    await assert.rejects(
      () => runWithBrandingDecodeSlot(async () => {}),
      (error: any) => error.code === 'BRANDING_VALIDATION_BUSY' && error.statusCode === 503,
    )
  } finally {
    release()
    await Promise.all([first, second])
  }
  await assert.doesNotReject(() => runWithBrandingDecodeSlot(async () => {}))
  await assert.rejects(() => runWithBrandingDecodeSlot(async () => { throw new Error('expected operation failure') }), /expected operation failure/)
  await assert.doesNotReject(() => runWithBrandingDecodeSlot(async () => {}))
})

test('real multipart branding upload validates before the service and never leaves rejected temporary files', async () => {
  const [{ createApp }, { env }, { JwtProvider }, { BrandingController }] = await Promise.all([
    import('../../app'),
    import('../../config/environment'),
    import('../auth/infrastructure/JwtProvider'),
    import('./presentation/controllers/BrandingController'),
  ])
  const uploadsDirectory = path.resolve(process.cwd(), 'uploads')
  const rootUploadFiles = async () => (await readdir(uploadsDirectory, { withFileTypes: true }).catch(() => []))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort()

  let serviceCalls = 0
  const service = {
    async getPublicBranding() {
      return { institutional_name: 'Postinder', logo_url: null, logo_configured: false, logo_version: 0, updated_at: null }
    },
    async replaceLogo(uploaded: Express.Multer.File) {
      serviceCalls += 1
      if (uploaded.path) await unlink(uploaded.path).catch(() => {})
      return { institutional_name: 'Postinder', logo_url: '/uploads/logo', logo_configured: true, logo_version: serviceCalls, updated_at: null }
    },
    async removeLogo() {
      return { institutional_name: 'Postinder', logo_url: null, logo_configured: false, logo_version: 1, updated_at: null }
    },
  }
  const app = createApp({
    runtimeEnvironment: env,
    brandingController: new BrandingController(service as any),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const token = new JwtProvider().sign({
    type: 'admin', userId: 'admin-id', email: 'admin@test.invalid', role: 'admin', permissions: [],
  }, '5m')

  async function upload(buffer: Buffer, name: string, type: string) {
    const body = new FormData()
    body.append('file', new Blob([buffer], { type }), name)
    return fetch(`${baseUrl}/api/v1/branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
  }

  async function uploadWithNestedField(buffer: Buffer) {
    const body = new FormData()
    body.append('metadata[deep][value]', 'must-not-be-parsed')
    body.append('file', new Blob([buffer], { type: 'image/png' }), 'logo.png')
    return fetch(`${baseUrl}/api/v1/branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
  }

  async function abortMultipartUpload() {
    const boundary = `postinder-abort-${Date.now()}`
    const partialFile = Buffer.concat([
      Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
      Buffer.alloc(128 * 1024, 0x41),
    ])
    const prefix = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="aborted.png"\r\n`
        + 'Content-Type: image/png\r\n\r\n',
      ),
      partialFile,
    ])

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let abortTimer: NodeJS.Timeout
      const safetyTimer = setTimeout(() => {
        request.destroy()
        finish(new Error('aborted multipart request did not close'))
      }, 2_000)
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(abortTimer)
        clearTimeout(safetyTimer)
        if (error) reject(error)
        else resolve()
      }
      const request = httpRequest(`${baseUrl}/api/v1/branding/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': prefix.length + 4_096,
        },
      })
      request.on('error', () => finish())
      request.on('close', () => finish())
      request.write(prefix)
      abortTimer = setTimeout(() => request.destroy(), 40)
    })
    await new Promise(resolve => setTimeout(resolve, 80))
  }

  try {
    const validCases = [
      [await validImage('png'), 'Lógó.PNG', 'image/png'],
      [await validImage('jpeg'), 'logo.jpeg', 'image/jpeg'],
      [await validImage('webp'), 'logo.webp', 'image/webp'],
    ] as const
    for (const [buffer, name, type] of validCases) {
      const response = await upload(buffer, name, type)
      assert.equal(response.status, 200)
      assert.equal(((await response.json()) as any).logo_configured, true)
    }

    const beforeRejected = await rootUploadFiles()
    const png = await validImage('png')
    const iend = pngChunks(png).find(chunk => chunk.type === 'IEND')!
    const invalidCrc = Buffer.from(png)
    invalidCrc[iend.dataEnd] ^= 1
    const rejectedCases = [
      [png.subarray(0, 20), 'truncated PNG', 'image/png'],
      [invalidCrc, 'invalid CRC PNG', 'image/png'],
      [createValidSingleFrameApng(png), 'animated APNG', 'image/png'],
      [await animatedWebp(), 'animated WebP', 'image/webp'],
      [await animatedWebp(true), 'corrupt animated WebP', 'image/webp'],
    ] as const
    for (const [buffer, name, type] of rejectedCases) {
      const rejected = await upload(buffer, type === 'image/webp' ? `${name}.webp` : `${name}.png`, type)
      assert.equal(rejected.status, 415, name)
      const rejectedBody = (await rejected.json()) as any
      assert.equal(rejectedBody.code, 'INVALID_BRANDING_CONTENT', name)
      assert.deepEqual(Object.keys(rejectedBody).sort(), ['code', 'error'], name)
    }

    const nested = await uploadWithNestedField(png)
    assert.equal(nested.status, 400)
    assert.match(((await nested.json()) as any).code, /^LIMIT_FIELD_(?:COUNT|NESTING)$/)

    await abortMultipartUpload()

    const oversized = await upload(Buffer.alloc(2 * 1024 * 1024 + 1), 'logo.png', 'image/png')
    assert.equal(oversized.status, 413)
    assert.equal(((await oversized.json()) as any).code, 'FILE_TOO_LARGE')
    assert.equal(serviceCalls, 3)
    assert.deepEqual(await rootUploadFiles(), beforeRejected)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
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
  assert.deepEqual(responses[0], { institutional_name: 'Postinder', logo_url: null, logo_configured: false, logo_version: 0, updated_at: null })
  assert.deepEqual(responses[1], responses[0])
  assert.equal(responses[2].logo_url, 'https://cdn.test/logo-v3.png')
  assert.equal(responses[2].logo_configured, true)
  assert.equal(responses[2].logo_version, 3)
  assert.doesNotMatch(JSON.stringify(responses[2]), /bucket|storage|secret-object/)

  const unavailable = new BrandingService({ find: async () => record({ logoBucket: 'bucket', logoStoragePath: 'path' }) } as any, {
    store: async () => assert.fail(), remove: async () => assert.fail(),
    publicUrl: () => { throw new Error('storage unavailable') },
  })
  const unavailableResponse = await unavailable.getPublicBranding()
  assert.equal(unavailableResponse.logo_url, null)
  assert.equal(unavailableResponse.logo_configured, true)
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
  assert.equal(response.logo_configured, false)
  assert.equal(response.logo_version, 4)
})
