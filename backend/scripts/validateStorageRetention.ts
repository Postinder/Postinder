import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

async function main() {
  const testDatabaseUrl = process.env.STORAGE_VALIDATION_TEST_DATABASE_URL
  if (!testDatabaseUrl) throw new Error('STORAGE_VALIDATION_TEST_DATABASE_URL is required')
  if (process.env.STORAGE_VALIDATION_TEST_CONFIRM !== 'RUN_ISOLATED_TESTS') {
    throw new Error('Set STORAGE_VALIDATION_TEST_CONFIRM=RUN_ISOLATED_TESTS to run this validation')
  }

  process.env.DATABASE_URL = testDatabaseUrl
  process.env.NODE_ENV = 'development'

  const [{ pool }, { storeUploadedFile }, { StorageRetentionCleanupService }, { PostRepository }] = await Promise.all([
    import('../src/shared/database/pool'),
    import('../src/shared/upload/storage'),
    import('../src/modules/posts/application/services/StorageRetentionCleanupService'),
    import('../src/modules/posts/infrastructure/repositories/PostRepository'),
  ])

  const testId = randomUUID()
  const uploadDirectory = path.join(process.cwd(), 'uploads')
  const createdPaths = new Set<string>()
  let clientId: string | null = null
  const postRepository = new PostRepository()

  async function createRetentionFile(policy: 'immediate' | '1d' | '7d' | '30d' | 'never') {
    const filename = `${testId}-${policy}-${randomUUID()}.txt`
    await fs.mkdir(uploadDirectory, { recursive: true })
    await fs.writeFile(path.join(uploadDirectory, filename), policy)
    createdPaths.add(filename)
    const stored = await storeUploadedFile({
      filename,
      originalname: `${policy}.txt`,
      mimetype: 'text/plain',
      size: Buffer.byteLength(policy),
    } as Express.Multer.File)
    const post = await pool.query(
      `INSERT INTO posts (client_id, title, status)
       VALUES ($1, $2, 'approved')
       RETURNING id`,
      [clientId, `Retention ${policy}`],
    )
    const file = await pool.query(
      `INSERT INTO files (post_id, url, bucket, storage_path, mime_type, size_bytes, original_name, file_type, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'FILE', 'approved', 1)
       RETURNING id, storage_path`,
      [post.rows[0].id, stored.publicUrl, stored.bucket, stored.storagePath, stored.mimeType, stored.sizeBytes, `${policy}.txt`],
    )
    const marked = await postRepository.markExecuted(post.rows[0].id, policy)
    if (!marked) throw new Error(`Could not mark ${policy} retention post as executed`)
    return { postId: post.rows[0].id as string, fileId: file.rows[0].id as string, storagePath: file.rows[0].storage_path as string }
  }

  try {
    const client = await pool.query(
      `INSERT INTO clients (name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      ['Storage retention validation client', `${testId}@test.invalid`, 'validation-password'],
    )
    clientId = client.rows[0].id

    const immediate = await createRetentionFile('immediate')
    const oneDay = await createRetentionFile('1d')
    const sevenDays = await createRetentionFile('7d')
    const thirtyDays = await createRetentionFile('30d')
    const never = await createRetentionFile('never')
    const policies = await pool.query(
      `SELECT id, files_retention_policy, files_delete_after
       FROM posts
       WHERE id = ANY($1::uuid[])`,
      [[immediate.postId, oneDay.postId, sevenDays.postId, thirtyDays.postId, never.postId]],
    )
    const policiesById = new Map(policies.rows.map(row => [row.id, row]))
    for (const [item, policy, hasDeadline] of [
      [immediate, 'immediate', true],
      [oneDay, '1d', true],
      [sevenDays, '7d', true],
      [thirtyDays, '30d', true],
      [never, 'never', false],
    ] as const) {
      const row = policiesById.get(item.postId)
      if (row?.files_retention_policy !== policy || Boolean(row.files_delete_after) !== hasDeadline) {
        throw new Error(`Retention policy ${policy} was not persisted correctly`)
      }
    }

    const firstRun = await new StorageRetentionCleanupService().execute()
    if (firstRun.storageObjectsDeleted !== 1 || firstRun.fileRecordsMarked !== 1) throw new Error('Immediate retention was not cleaned exactly once')
    const immediateState = await pool.query('SELECT storage_deleted_at, storage_delete_error FROM files WHERE id = $1', [immediate.fileId])
    if (!immediateState.rows[0].storage_deleted_at || immediateState.rows[0].storage_delete_error) throw new Error('Immediate cleanup audit fields are invalid')
    await fs.access(path.join(uploadDirectory, immediate.storagePath)).then(
      () => { throw new Error('Immediate storage object was not removed') },
      () => undefined,
    )

    const repeatedRun = await new StorageRetentionCleanupService().execute()
    if (repeatedRun.storageObjectsDeleted !== 0) throw new Error('Already deleted storage object was processed again')

    await pool.query(`UPDATE posts SET files_delete_after = NOW() - INTERVAL '1 minute' WHERE id = ANY($1::uuid[])`, [[oneDay.postId, sevenDays.postId, thirtyDays.postId]])
    const delayedRun = await new StorageRetentionCleanupService().execute()
    if (delayedRun.storageObjectsDeleted !== 3 || delayedRun.fileRecordsMarked !== 3) throw new Error('Delayed retention policies were not cleaned')
    const neverState = await pool.query('SELECT storage_deleted_at FROM files WHERE id = $1', [never.fileId])
    if (neverState.rows[0].storage_deleted_at) throw new Error('Never retention file was removed')
    await fs.access(path.join(uploadDirectory, never.storagePath))

    const failed = await createRetentionFile('immediate')
    const failingService = new StorageRetentionCleanupService(async reference => ({ ...reference, removed: false, error: 'Simulated storage failure' }))
    const failedRun = await failingService.execute()
    if (failedRun.failures !== 1) throw new Error('Simulated storage failure was not recorded')
    const failedState = await pool.query('SELECT storage_deleted_at, storage_delete_error FROM files WHERE id = $1', [failed.fileId])
    if (failedState.rows[0].storage_deleted_at || failedState.rows[0].storage_delete_error !== 'Simulated storage failure') {
      throw new Error('Storage failure audit fields are invalid')
    }
    await fs.access(path.join(uploadDirectory, failed.storagePath))

    const recoveryRun = await new StorageRetentionCleanupService().execute()
    if (recoveryRun.storageObjectsDeleted !== 1) throw new Error('Manual rerun did not clean the failed storage object')
    const recoveredState = await pool.query('SELECT storage_deleted_at, storage_delete_error FROM files WHERE id = $1', [failed.fileId])
    if (!recoveredState.rows[0].storage_deleted_at || recoveredState.rows[0].storage_delete_error) throw new Error('Successful cleanup did not clear storage error')

    console.log('Storage retention validation completed successfully.')
  } finally {
    if (clientId) {
      const paths = await pool.query(
        `SELECT f.storage_path
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE p.client_id = $1 AND f.bucket = 'local'`,
        [clientId],
      )
      paths.rows.forEach(row => createdPaths.add(row.storage_path))
      await pool.query('DELETE FROM clients WHERE id = $1', [clientId])
    }
    await Promise.all([...createdPaths].map(storagePath => fs.unlink(path.join(uploadDirectory, storagePath)).catch(() => {})))
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
