import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdir, rmdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_retention'
process.env.JWT_SECRET = 'storage-retention-test-secret'
process.env.LOG_LEVEL = 'error'

import { pool } from '../../shared/database/pool'
import { StorageRetentionCleanupService } from './application/services/StorageRetentionCleanupService'
import { removeStoredFile } from '../../shared/upload/storage'
import {
  STORAGE_RETENTION_SCAN_INTERVAL_MS,
  StorageRetentionScheduler,
} from './application/services/StorageRetentionScheduler'

test('eligibility queries require executed status, a canonical timestamp and an expired safe deadline', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'src/modules/posts/application/services/StorageRetentionCleanupService.ts'), 'utf8')
  const requiredPredicates = [
    /status = 'executed'/,
    /executed_at IS NOT NULL/,
    /files_delete_after IS NOT NULL/,
    /files_delete_after <= NOW\(\)/,
    /files_delete_after >= .*executed_at/,
    /storage_deleted_at IS NULL/,
  ]
  for (const predicate of requiredPredicates) assert.match(source, predicate)
  for (const status of ['draft', 'ready', 'pending_approval', 'approved', 'rejected']) {
    assert.doesNotMatch(source, new RegExp(`status = '${status}'`))
  }
})

test('cleanup deletes one eligible object, keeps its record and becomes a no-op on the next scan', async () => {
  const originalQuery = pool.query.bind(pool)
  const originalConnect = pool.connect.bind(pool)
  let scan = 0
  let removed = 0
  let marked = 0
  ;(pool as any).query = async (sql: string, params?: any[]) => {
    if (sql.includes('FROM files f')) {
      scan += 1
      assert.equal(params?.[0], 50)
      return { rows: scan === 1 ? [{ id: 'file-1' }] : [] }
    }
    if (sql.includes('FROM post_soundtracks ps')) return { rows: [] }
    return { rows: [] }
  }
  ;(pool as any).connect = async () => ({
    async query(sql: string) {
      if (sql.includes('SELECT f.bucket, f.storage_path')) return { rows: [{ bucket: 'local', storage_path: 'posts/post-1/file.png' }] }
      if (sql.includes('SELECT f.id, f.bucket')) return { rows: [{ id: 'file-1', bucket: 'local', storage_path: 'posts/post-1/file.png' }] }
      if (sql.includes(') active_references LIMIT 1')) return { rows: [] }
      if (sql.includes('UPDATE files f') && sql.includes('RETURNING f.id')) {
        marked += 1
        return { rows: [{ id: 'file-1' }] }
      }
      if (sql.includes('UPDATE post_soundtracks ps') && sql.includes('RETURNING ps.id')) return { rows: [] }
      return { rows: [] }
    },
    release() {},
  })
  try {
    const cleanup = new StorageRetentionCleanupService(async reference => {
      removed += 1
      assert.deepEqual(reference, { bucket: 'local', storagePath: 'posts/post-1/file.png' })
      return { ...reference, removed: true }
    })
    assert.deepEqual(await cleanup.execute(), {
      candidates: 1,
      storageObjectsDeleted: 1,
      fileRecordsMarked: 1,
      failures: 0,
      skippedSharedReferences: 0,
    })
    assert.deepEqual(await cleanup.execute(), {
      candidates: 0,
      storageObjectsDeleted: 0,
      fileRecordsMarked: 0,
      failures: 0,
      skippedSharedReferences: 0,
    })
    assert.equal(removed, 1)
    assert.equal(marked, 1)
  } finally {
    ;(pool as any).query = originalQuery
    ;(pool as any).connect = originalConnect
  }
})

test('storage failure is sanitized, does not mark purge and remains eligible for retry', async () => {
  const originalQuery = pool.query.bind(pool)
  const originalConnect = pool.connect.bind(pool)
  const statements: Array<{ sql: string; params?: any[] }> = []
  ;(pool as any).query = async (sql: string) => sql.includes('FROM files f')
    ? { rows: [{ id: 'file-failure' }] }
    : { rows: [] }
  ;(pool as any).connect = async () => ({
    async query(sql: string, params?: any[]) {
      statements.push({ sql, params })
      if (sql.includes('SELECT f.bucket, f.storage_path')) return { rows: [{ bucket: 'local', storage_path: 'private/path.png' }] }
      if (sql.includes('SELECT f.id, f.bucket')) return { rows: [{ id: 'file-failure', bucket: 'local', storage_path: 'private/path.png' }] }
      if (sql.includes(') active_references LIMIT 1')) return { rows: [] }
      return { rows: [] }
    },
    release() {},
  })
  try {
    const result = await new StorageRetentionCleanupService(async reference => ({
      ...reference,
      removed: false,
      error: 'provider secret and internal path',
    })).execute(1)
    assert.equal(result.failures, 1)
    assert.equal(result.storageObjectsDeleted, 0)
    assert.equal(statements.some(item => item.sql.includes('storage_deleted_at = NOW()')), false)
    const persisted = statements.find(item => item.sql.includes('storage_delete_error = $3'))
    assert.equal(persisted?.params?.[2], 'Storage deletion failed; retry pending')
    assert.equal(JSON.stringify(statements).includes('provider secret'), false)
  } finally {
    ;(pool as any).query = originalQuery
    ;(pool as any).connect = originalConnect
  }
})

test('local storage removal is idempotent and refuses identities outside the uploads root', async () => {
  const directoryName = `retention-test-${randomUUID()}`
  const directory = path.resolve(process.cwd(), 'uploads', directoryName)
  const storagePath = `${directoryName}/object.txt`
  await mkdir(directory, { recursive: false })
  await writeFile(path.join(directory, 'object.txt'), 'disposable retention test')
  try {
    assert.equal((await removeStoredFile({ bucket: 'local', storagePath })).removed, true)
    assert.equal((await removeStoredFile({ bucket: 'local', storagePath })).removed, true)
    assert.equal((await removeStoredFile({ bucket: 'wrong', storagePath })).removed, false)
    assert.equal((await removeStoredFile({ bucket: 'local', storagePath: '../outside.txt' })).removed, false)
  } finally {
    await rmdir(directory)
  }
})

test('Supabase adapter contract removes the exact persisted path as a one-item array', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'src/shared/upload/storage.ts'), 'utf8')
  assert.match(source, /supabase\.storage\.from\(bucket\)\.remove\(\[storagePath\]\)/)
})

test('cleanup batch is globally bounded across files and soundtracks', async () => {
  const originalQuery = pool.query.bind(pool)
  const limits: number[] = []
  ;(pool as any).query = async (_sql: string, params?: any[]) => {
    limits.push(params?.[0])
    return { rows: limits.length === 1 ? Array.from({ length: 7 }, (_, index) => ({ id: `file-${index}` })) : [] }
  }
  const originalConnect = pool.connect.bind(pool)
  ;(pool as any).connect = async () => ({
    async query(sql: string) {
      if (sql.includes('SELECT f.bucket, f.storage_path')) return { rows: [] }
      return { rows: [] }
    },
    release() {},
  })
  try {
    await new StorageRetentionCleanupService().execute(10)
    assert.deepEqual(limits, [10, 3])
  } finally {
    ;(pool as any).query = originalQuery
    ;(pool as any).connect = originalConnect
  }
})

test('internal scheduler runs at startup, avoids overlap, unreferences its timer and stops cleanly', async () => {
  assert.equal(STORAGE_RETENTION_SCAN_INTERVAL_MS, 60 * 60 * 1000)
  let executeCalls = 0
  let releaseFirst!: () => void
  const firstRun = new Promise<void>(resolve => { releaseFirst = resolve })
  const cleanup = {
    async execute(batchSize: number) {
      executeCalls += 1
      assert.equal(batchSize, 50)
      if (executeCalls === 1) await firstRun
      return { candidates: 0, storageObjectsDeleted: 0, fileRecordsMarked: 0, failures: 0, skippedSharedReferences: 0 }
    },
  }
  let callback: (() => void) | undefined
  let unrefCalls = 0
  let cancelled = false
  const timer = { unref() { unrefCalls += 1 } } as any
  const scheduler = new StorageRetentionScheduler(
    cleanup,
    1234,
    ((handler: () => void, interval: number) => {
      assert.equal(interval, 1234)
      callback = handler
      return timer
    }) as any,
    ((handle: any) => { assert.equal(handle, timer); cancelled = true }) as any,
  )
  scheduler.start()
  callback?.()
  await Promise.resolve()
  assert.equal(executeCalls, 1)
  assert.equal(unrefCalls, 1)
  releaseFirst()
  await new Promise(resolve => setImmediate(resolve))
  callback?.()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(executeCalls, 2)
  scheduler.stop()
  assert.equal(cancelled, true)
})
