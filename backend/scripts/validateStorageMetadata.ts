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

  const [{ pool }, { storeUploadedFile }, { PostRepository }, { PostsController }] = await Promise.all([
    import('../src/shared/database/pool'),
    import('../src/shared/upload/storage'),
    import('../src/modules/posts/infrastructure/repositories/PostRepository'),
    import('../src/modules/posts/presentation/controllers/PostsController'),
  ])

  const uploadDirectory = path.join(process.cwd(), 'uploads')
  const testId = randomUUID()
  const postRepository = new PostRepository()
  const createdPaths: string[] = []

  async function createLocalUpload(name: string, content: string) {
    const filename = `${testId}-${name}.txt`
    const fullPath = path.join(uploadDirectory, filename)
    await fs.mkdir(uploadDirectory, { recursive: true })
    await fs.writeFile(fullPath, content)
    createdPaths.push(fullPath)
    return storeUploadedFile({
      filename,
      originalname: `${name}.txt`,
      mimetype: 'text/plain',
      size: Buffer.byteLength(content),
    } as Express.Multer.File)
  }

  try {
    const client = await pool.query(
      `INSERT INTO clients (name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      ['Storage validation client', `${testId}@test.invalid`, 'validation-password'],
    )
    const post = await pool.query(
      `INSERT INTO posts (client_id, title, status)
       VALUES ($1, $2, 'draft')
       RETURNING id`,
      [client.rows[0].id, 'Storage validation post'],
    )
    const postId = post.rows[0].id

    const simple = await createLocalUpload('simple', 'simple upload')
    const simpleRows = await postRepository.addFiles(postId, [{
      url: simple.publicUrl,
      bucket: simple.bucket,
      storagePath: simple.storagePath,
      mimeType: simple.mimeType,
      sizeBytes: simple.sizeBytes,
      originalName: 'simple.txt',
      fileType: 'FILE',
    }])
    if (!simpleRows?.[0]) throw new Error('Simple upload was not persisted')

    const persisted = await pool.query(
      'SELECT bucket, storage_path, mime_type, size_bytes FROM files WHERE id = $1',
      [simpleRows[0].id],
    )
    const row = persisted.rows[0]
    if (row.bucket !== 'local' || row.storage_path !== simple.storagePath || row.mime_type !== 'text/plain' || Number(row.size_bytes) !== simple.sizeBytes) {
      throw new Error('Simple upload metadata was not persisted correctly')
    }

    const multiple = await Promise.all([
      createLocalUpload('multiple-a', 'multiple a'),
      createLocalUpload('multiple-b', 'multiple b'),
    ])
    const multipleRows = await postRepository.addFiles(postId, multiple.map((storedFile, index) => ({
      url: storedFile.publicUrl,
      bucket: storedFile.bucket,
      storagePath: storedFile.storagePath,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      originalName: `multiple-${index}.txt`,
      fileType: 'FILE',
    })))
    if (multipleRows?.length !== 2) throw new Error('Multiple upload was not persisted atomically')

    await pool.query("UPDATE files SET status = 'rejected' WHERE id = $1", [simpleRows[0].id])
    const replacement = await createLocalUpload('replacement', 'replacement')
    const replaced = await postRepository.replaceFile(postId, simpleRows[0].id, {
      url: replacement.publicUrl,
      bucket: replacement.bucket,
      storagePath: replacement.storagePath,
      mimeType: replacement.mimeType,
      sizeBytes: replacement.sizeBytes,
      originalName: 'replacement.txt',
      fileType: 'FILE',
    })
    if (!replaced) throw new Error('Replacement did not persist')
    await fs.access(path.join(uploadDirectory, replacement.storagePath))
    await fs.access(path.join(uploadDirectory, simple.storagePath)).then(
      () => { throw new Error('Unshared replaced object was not removed') },
      () => undefined,
    )

    const removed = await postRepository.removeFile(postId, multipleRows[0].id)
    if (!removed) throw new Error('File removal did not persist')
    await fs.access(path.join(uploadDirectory, multiple[0].storagePath)).then(
      () => { throw new Error('Unshared removed object was not removed') },
      () => undefined,
    )

    const failedUploadNames = ['compensation-a', 'compensation-b']
    const failedUploads = await Promise.all(failedUploadNames.map(async name => {
      const filename = `${testId}-${name}.txt`
      const fullPath = path.join(uploadDirectory, filename)
      await fs.writeFile(fullPath, name)
      createdPaths.push(fullPath)
      return {
        filename,
        originalname: `${name}.txt`,
        mimetype: 'text/plain',
        size: Buffer.byteLength(name),
      } as Express.Multer.File
    }))
    const failingRepository = {
      getMutationState: async () => ({ allowed: true }),
      addFiles: async () => { throw new Error('Simulated database failure') },
    }
    const controller = new PostsController(null as any, null as any, null as any, failingRepository as any)
    const response = {
      status: () => response,
      json: () => response,
    }
    await controller.uploadFiles({
      params: { id: postId },
      files: failedUploads,
      body: {},
    } as any, response as any).then(
      () => { throw new Error('Compensation scenario should have failed') },
      () => undefined,
    )
    await Promise.all(failedUploads.map(upload => fs.access(path.join(uploadDirectory, upload.filename)).then(
      () => { throw new Error('Compensation did not remove an uploaded object') },
      () => undefined,
    )))

    console.log('Storage metadata validation completed successfully.')
  } finally {
    await pool.end()
    await Promise.all(createdPaths.map(filePath => fs.unlink(filePath).catch(() => {})))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
