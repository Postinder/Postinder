import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../src/shared/database/pool'
import { SoundtrackRepository } from '../src/modules/soundtracks/infrastructure/repositories/SoundtrackRepository'
import { PostRepository } from '../src/modules/posts/infrastructure/repositories/PostRepository'
import { StorageRetentionCleanupService } from '../src/modules/posts/application/services/StorageRetentionCleanupService'
import { PortalRepository } from '../src/modules/portal/infrastructure/repositories/PortalRepository'
import { PlatformSettingsService } from '../src/modules/platformSettings/application/PlatformSettingsService'

async function writeFixture(storagePath: string, data: Buffer) {
  const absolute = path.resolve(process.cwd(), 'uploads', storagePath)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, data)
}

async function main() {
  const marker = uuidv4()
  const clientId = uuidv4()
  const postId = uuidv4()
  const otherPostId = uuidv4()
  const videoId = uuidv4()
  const otherVideoId = uuidv4()
  const videoPath = `soundtrack-tests/${marker}/video.mp4`
  const otherVideoPath = `soundtrack-tests/${marker}/other.mp4`
  const audioPath = `soundtrack-tests/${marker}/track.mp3`
  const soundtrackRepository = new SoundtrackRepository()
  const postRepository = new PostRepository()
  const settingsService = new PlatformSettingsService()
  const portalRepository = new PortalRepository(settingsService)
  const scope = { clientId }
  let previousSettings: Awaited<ReturnType<PlatformSettingsService['get']>> | null = null

  const readExpectedRevision = async (id: string) => {
    const result = await pool.query(
      'SELECT content_revision FROM posts WHERE id = $1',
      [id],
    )
    const revision = Number(result.rows[0]?.content_revision)
    assert.ok(Number.isInteger(revision) && revision > 0, 'submitted post should expose a positive content revision')
    return revision
  }

  await writeFixture(videoPath, Buffer.from('video-fixture'))
  await writeFixture(otherVideoPath, Buffer.from('other-video-fixture'))
  await writeFixture(audioPath, Buffer.from('ID3soundtrack-fixture'))

  try {
    previousSettings = await settingsService.get()
    await settingsService.update({
      features: { soundtrack: true },
      portal: { approval_mode: 'content' },
    })
    await pool.query(
      `INSERT INTO clients (id, email, name, password_hash, is_active)
       VALUES ($1, $2, 'Soundtrack Test', 'test', true)`,
      [clientId, `soundtrack-${marker}@example.test`],
    )
    await pool.query(
      `INSERT INTO posts (id, client_id, title, status) VALUES
       ($1, $3, 'Soundtrack validation', 'draft'),
       ($2, $3, 'Other post', 'draft')`,
      [postId, otherPostId, clientId],
    )
    await pool.query(
      `INSERT INTO files (id, post_id, url, bucket, storage_path, mime_type, size_bytes, original_name, file_type, status, sort_order)
       VALUES
       ($1, $3, $4, 'local', $5, 'video/mp4', 13, 'video.mp4', 'VIDEO', 'approved', 1),
       ($2, $6, $7, 'local', $8, 'video/mp4', 19, 'other.mp4', 'VIDEO', 'pending', 1)`,
      [videoId, otherVideoId, postId, `/uploads/${videoPath}`, videoPath, otherPostId, `/uploads/${otherVideoPath}`, otherVideoPath],
    )

    const embedded = await soundtrackRepository.save(postId, {
      mode: 'embedded',
      sourceMediaId: null,
      trackName: 'Audio incorporado',
      startTimeSeconds: 3,
    }, { role: 'admin' })
    assert.equal(embedded?.sourceMediaId, videoId, 'single video should be selected automatically')
    assert.equal(embedded?.approvalStatus, 'pending')

    await assert.rejects(
      soundtrackRepository.save(postId, { mode: 'embedded', sourceMediaId: otherVideoId }, { role: 'admin' }),
      /nao pertence a esta postagem/i,
    )

    assert.equal(await postRepository.submitForApproval(postId), true)
    const contentRevision = await readExpectedRevision(postId)
    const approvedSoundtrack = await soundtrackRepository.decide(
      postId, 'approved', null, scope, 'client', contentRevision,
      { recalculatePostStatus: false },
    )
    assert.equal(approvedSoundtrack?.approvalStatus, 'approved')
    assert.deepEqual(await portalRepository.approvePost(postId, scope, contentRevision), {
      kind: 'completed', status: 'approved', positiveReaction: null, snapshot: [],
    })
    let post = await pool.query(`SELECT status FROM posts WHERE id = $1`, [postId])
    assert.equal(post.rows[0].status, 'approved', 'approved files and soundtrack should approve the post')

    assert.deepEqual(await portalRepository.reopenPost(postId, scope, contentRevision), { kind: 'reopened' })
    await assert.rejects(
      soundtrackRepository.decide(postId, 'adjustment_requested', ' ', scope, 'client', contentRevision),
      /comentario/i,
    )
    await soundtrackRepository.decide(
      postId, 'adjustment_requested', 'Trocar a trilha.', scope, 'client', contentRevision,
    )
    post = await pool.query(`SELECT status FROM posts WHERE id = $1`, [postId])
    assert.equal(post.rows[0].status, 'rejected')

    const uploaded = await soundtrackRepository.save(postId, {
      mode: 'uploaded',
      trackName: 'Faixa corrigida',
      artist: 'Producao propria',
      usageSource: 'original_production',
      startTimeSeconds: 5,
    }, { role: 'admin' }, {
      bucket: 'local',
      storagePath: audioPath,
      publicUrl: `/uploads/${audioPath}`,
      mimeType: 'audio/mpeg',
      sizeBytes: 21,
      originalName: 'track.mp3',
    })
    assert.equal(uploaded?.approvalStatus, 'pending', 'correction should invalidate the previous decision')
    const decisions = await pool.query(`SELECT decision FROM post_soundtrack_decisions WHERE post_id = $1 ORDER BY created_at, id`, [postId])
    assert.deepEqual(decisions.rows.map(row => row.decision), ['approved', 'adjustment_requested'])

    const duplicated = await postRepository.duplicate(postId)
    assert.ok(duplicated?.id)
    assert.equal(duplicated.duplicatedFileCount, 1)
    assert.equal(duplicated.duplicatedSoundtrack, true)
    const duplicatedStorage = await pool.query(
      `SELECT ps.storage_path AS soundtrack_path, f.storage_path AS file_path, ps.approval_status
       FROM post_soundtracks ps JOIN files f ON f.post_id = ps.post_id
       WHERE ps.post_id = $1 AND ps.deleted_at IS NULL`,
      [duplicated.id],
    )
    assert.notEqual(duplicatedStorage.rows[0].soundtrack_path, audioPath, 'soundtrack duplication must be physical')
    assert.notEqual(duplicatedStorage.rows[0].file_path, videoPath, 'attachment duplication must remain physical')
    assert.equal(duplicatedStorage.rows[0].approval_status, 'pending')

    await pool.query(
      `INSERT INTO files (
         post_id, url, bucket, storage_path, mime_type, size_bytes,
         original_name, file_type, status, sort_order
       ) VALUES ($1, $2, 'local', $3, 'audio/mpeg', 21, 'shared-reference.mp3', 'AUDIO', 'approved', 2)`,
      [duplicated.id, `/uploads/${duplicatedStorage.rows[0].soundtrack_path}`, duplicatedStorage.rows[0].soundtrack_path],
    )

    assert.equal(await postRepository.submitForApproval(duplicated.id), true)
    const duplicatedRevision = await readExpectedRevision(duplicated.id)
    await soundtrackRepository.decide(
      duplicated.id, 'approved', null, scope, 'client', duplicatedRevision,
      { recalculatePostStatus: false },
    )
    assert.deepEqual(await portalRepository.approvePost(duplicated.id, scope, duplicatedRevision), {
      kind: 'completed', status: 'approved', positiveReaction: null, snapshot: [],
    })
    const retentionHours = (await settingsService.get()).retention.executed_attachment_hours
    assert.equal(await postRepository.markExecuted(duplicated.id, retentionHours), true)
    await pool.query(
      `UPDATE posts
       SET executed_at = NOW() - INTERVAL '2 hours',
           files_delete_after = NOW() - INTERVAL '1 hour'
       WHERE id = $1`,
      [duplicated.id],
    )
    const cleanup = await new StorageRetentionCleanupService().execute()
    assert.ok(cleanup.storageObjectsDeleted >= 2, 'retention should process attachment and soundtrack')
    assert.ok(cleanup.fileRecordsMarked >= 3, 'shared attachment and soundtrack references should be audited together')
    const retained = await pool.query(
      `SELECT storage_deleted_at FROM post_soundtracks WHERE post_id = $1 AND deleted_at IS NULL`,
      [duplicated.id],
    )
    assert.ok(retained.rows[0].storage_deleted_at, 'soundtrack metadata should remain after physical retention')

    await assert.rejects(
      soundtrackRepository.save(duplicated.id, { mode: 'none' }, { role: 'admin' }),
      /executadas/i,
    )

    await soundtrackRepository.save(postId, { mode: 'none' }, { role: 'admin' })
    assert.equal(await soundtrackRepository.findByPostId(postId), null)
    const preserved = await pool.query(`SELECT COUNT(*)::int AS count FROM post_soundtrack_decisions WHERE post_id = $1`, [postId])
    assert.equal(preserved.rows[0].count, 2, 'disabling a soundtrack must preserve prior decisions')

    console.log(JSON.stringify({ success: true, cleanup, duplicatedPostId: duplicated.id }, null, 2))
  } finally {
    const storage = await pool.query(
      `SELECT bucket, storage_path FROM files WHERE post_id IN (SELECT id FROM posts WHERE client_id = $1)
       UNION
       SELECT bucket, storage_path FROM post_soundtracks WHERE post_id IN (SELECT id FROM posts WHERE client_id = $1)`,
      [clientId],
    ).catch(() => ({ rows: [] as any[] }))
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]).catch(() => {})
    await Promise.all(storage.rows
      .filter(row => row.bucket === 'local' && row.storage_path)
      .map(row => fs.unlink(path.resolve(process.cwd(), 'uploads', row.storage_path)).catch(() => {})))
    await fs.rm(path.resolve(process.cwd(), 'uploads', 'soundtrack-tests', marker), { recursive: true, force: true }).catch(() => {})
    if (previousSettings) {
      const { updated_at: _updatedAt, ...settings } = previousSettings
      await settingsService.update(settings)
    }
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
