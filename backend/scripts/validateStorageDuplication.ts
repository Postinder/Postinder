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

  const [{ pool }, { copyStoredFile, storeUploadedFile }, { PostDuplicationError, PostRepository }] = await Promise.all([
    import('../src/shared/database/pool'),
    import('../src/shared/upload/storage'),
    import('../src/modules/posts/infrastructure/repositories/PostRepository'),
  ])

  const testId = randomUUID()
  const uploadDirectory = path.join(process.cwd(), 'uploads')
  const repository = new PostRepository()
  let clientId: string | null = null
  const createdPaths = new Set<string>()
  const copiedPostDirectories = new Set<string>()

  async function createUpload(name: string, content: string) {
    const filename = `${testId}-${name}.txt`
    const fullPath = path.join(uploadDirectory, filename)
    await fs.mkdir(uploadDirectory, { recursive: true })
    await fs.writeFile(fullPath, content)
    createdPaths.add(filename)
    return storeUploadedFile({
      filename,
      originalname: `${name}.txt`,
      mimetype: 'text/plain',
      size: Buffer.byteLength(content),
    } as Express.Multer.File)
  }

  async function createPost(title: string) {
    const result = await pool.query(
      `INSERT INTO posts (client_id, title, status)
       VALUES ($1, $2, 'draft')
       RETURNING id`,
      [clientId, title],
    )
    return result.rows[0].id as string
  }

  try {
    const client = await pool.query(
      `INSERT INTO clients (name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      ['Storage duplication validation client', `${testId}@test.invalid`, 'validation-password'],
    )
    clientId = client.rows[0].id

    const originalPostId = await createPost('Storage duplication original')
    const originalUploads = await Promise.all([
      createUpload('original-a', 'original a'),
      createUpload('original-b', 'original b'),
    ])
    const originalFiles = await repository.addFiles(originalPostId, originalUploads.map((file, index) => ({
      url: file.publicUrl,
      bucket: file.bucket,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      originalName: `original-${index}.txt`,
      fileType: 'FILE',
      sortOrder: index + 1,
    })))
    if (originalFiles?.length !== 2) throw new Error('Could not prepare source files')

    const duplicate = await repository.duplicate(originalPostId)
    if (!duplicate || duplicate.duplicatedFileCount !== 2) throw new Error('Simple duplication did not copy every file')
    copiedPostDirectories.add(duplicate.id)
    const duplicateFiles = await pool.query(
      `SELECT id, bucket, storage_path, url, status, sort_order, rejection_reason, rejection_tags
       FROM files WHERE post_id = $1 ORDER BY sort_order`,
      [duplicate.id],
    )
    if (duplicateFiles.rows.length !== 2 || duplicateFiles.rows.some(file => file.status !== 'pending' || file.rejection_reason || file.rejection_tags)) {
      throw new Error('Duplicated file state was not reset')
    }
    duplicateFiles.rows.forEach((file, index) => {
      const original = originalFiles[index]
      if (file.bucket !== original.bucket || file.storage_path === original.storage_path || file.url === original.url || Number(file.sort_order) !== index + 1) {
        throw new Error('Duplicated file did not receive an independent identity')
      }
      createdPaths.add(file.storage_path)
    })
    await Promise.all(duplicateFiles.rows.map(file => fs.access(path.join(uploadDirectory, file.storage_path))))

    await repository.removeFile(duplicate.id, duplicateFiles.rows[0].id)
    await fs.access(path.join(uploadDirectory, originalFiles[0].storage_path))

    await pool.query("UPDATE files SET status = 'rejected' WHERE id = $1", [duplicateFiles.rows[1].id])
    const replacement = await createUpload('replacement', 'replacement copy')
    await repository.replaceFile(duplicate.id, duplicateFiles.rows[1].id, {
      url: replacement.publicUrl,
      bucket: replacement.bucket,
      storagePath: replacement.storagePath,
      mimeType: replacement.mimeType,
      sizeBytes: replacement.sizeBytes,
      originalName: 'replacement.txt',
      fileType: 'FILE',
    })
    await fs.access(path.join(uploadDirectory, originalFiles[1].storage_path))

    await repository.removeFile(originalPostId, originalFiles[1].id)
    await fs.access(path.join(uploadDirectory, replacement.storagePath))

    const failurePostId = await createPost('Storage duplication copy failure')
    const failureUploads = await Promise.all([createUpload('failure-a', 'failure a'), createUpload('failure-b', 'failure b')])
    await repository.addFiles(failurePostId, failureUploads.map((file, index) => ({
      url: file.publicUrl, bucket: file.bucket, storagePath: file.storagePath,
      mimeType: file.mimeType, sizeBytes: file.sizeBytes, originalName: `failure-${index}.txt`, fileType: 'FILE', sortOrder: index + 1,
    })))
    const copiedBeforeFailure: any[] = []
    let copyAttempts = 0
    const failingCopyRepository = new PostRepository(async (source, target) => {
      copiedPostDirectories.add(target.postId)
      copyAttempts += 1
      if (copyAttempts === 2) throw new Error('Simulated second copy failure')
      const copied = await copyStoredFile(source, target)
      copiedBeforeFailure.push(copied)
      return copied
    })
    await failingCopyRepository.duplicate(failurePostId).then(
      () => { throw new Error('Copy failure should reject duplication') },
      error => {
        if (!(error instanceof PostDuplicationError) || error.code !== 'storage_copy_failed') throw error
      },
    )
    await Promise.all(copiedBeforeFailure.map(file => fs.access(path.join(uploadDirectory, file.storagePath)).then(
      () => { throw new Error('Copied object was not compensated after copy failure') },
      () => undefined,
    )))

    const databaseFailurePostId = await createPost('Storage duplication database failure')
    const databaseFailureUpload = await createUpload('database-failure', 'database failure')
    await repository.addFiles(databaseFailurePostId, [{
      url: databaseFailureUpload.publicUrl, bucket: databaseFailureUpload.bucket, storagePath: databaseFailureUpload.storagePath,
      mimeType: databaseFailureUpload.mimeType, sizeBytes: databaseFailureUpload.sizeBytes, originalName: 'database-failure.txt', fileType: 'FILE', sortOrder: 1,
    }])
    const copiedBeforeDatabaseFailure: any[] = []
    const failingDatabaseRepository = new PostRepository(async (source, target) => {
      copiedPostDirectories.add(target.postId)
      const copied = await copyStoredFile(source, target)
      copiedBeforeDatabaseFailure.push(copied)
      return { ...copied, publicUrl: 'x'.repeat(600) }
    })
    await failingDatabaseRepository.duplicate(databaseFailurePostId).then(
      () => { throw new Error('Database failure should reject duplication') },
      error => {
        if (!(error instanceof PostDuplicationError) || error.code !== 'database_write_failed') throw error
      },
    )
    await Promise.all(copiedBeforeDatabaseFailure.map(file => fs.access(path.join(uploadDirectory, file.storagePath)).then(
      () => { throw new Error('Copied object was not compensated after database failure') },
      () => undefined,
    )))

    const legacyPostId = await createPost('Storage duplication legacy')
    await pool.query(
      `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order)
       VALUES ($1, '/uploads/legacy.txt', 'legacy.txt', 'FILE', 'pending', 1)`,
      [legacyPostId],
    )
    await repository.duplicate(legacyPostId).then(
      () => { throw new Error('Legacy file should block duplication') },
      error => {
        if (!(error instanceof PostDuplicationError) || error.code !== 'legacy_file_identity_missing') throw error
      },
    )

    console.log('Storage duplication validation completed successfully.')
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
    await Promise.all([...copiedPostDirectories].map(postId => fs.rmdir(path.join(uploadDirectory, 'posts', postId)).catch(() => {})))
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
