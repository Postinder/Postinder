import { pool } from '../../../../shared/database/pool'
import { removeStoredFile, StorageObjectReference, StorageRemovalResult } from '../../../../shared/upload/storage'
import { logger } from '../../../../shared/utils/Logger'

type StorageRemoval = (reference: StorageObjectReference) => Promise<StorageRemovalResult>

export type StorageRetentionCleanupResult = {
  candidates: number
  storageObjectsDeleted: number
  fileRecordsMarked: number
  failures: number
  skippedSharedReferences: number
}

type CleanupOutcome = {
  kind: 'deleted' | 'failed' | 'shared' | 'skipped'
  fileRecordsMarked?: number
}

export class StorageRetentionCleanupService {
  constructor(private readonly removeStorageObject: StorageRemoval = removeStoredFile) {}

  async execute(batchSize = 50): Promise<StorageRetentionCleanupResult> {
    const limit = Math.min(Math.max(Math.trunc(batchSize) || 50, 1), 200)
    const fileCandidates = await pool.query(
      `SELECT f.id
       FROM files f
       JOIN posts p ON p.id = f.post_id
       WHERE p.status = 'executed'
         AND p.executed_at IS NOT NULL
         AND p.files_delete_after IS NOT NULL
         AND p.files_delete_after <= NOW()
         AND p.files_delete_after >= p.executed_at
         AND f.storage_deleted_at IS NULL
       ORDER BY p.files_delete_after, f.created_at, f.id
       LIMIT $1`, [limit],
    )
    const remaining = limit - fileCandidates.rows.length
    const soundtrackCandidates = remaining > 0 ? await pool.query(
      `SELECT ps.id
       FROM post_soundtracks ps
       JOIN posts p ON p.id = ps.post_id
       WHERE p.status = 'executed'
         AND p.executed_at IS NOT NULL
         AND p.files_delete_after IS NOT NULL
         AND p.files_delete_after <= NOW()
         AND p.files_delete_after >= p.executed_at
         AND ps.storage_path IS NOT NULL
         AND ps.storage_deleted_at IS NULL
         AND ps.deleted_at IS NULL
       ORDER BY p.files_delete_after, ps.created_at, ps.id
       LIMIT $1`, [remaining],
    ) : { rows: [] }

    const result: StorageRetentionCleanupResult = {
      candidates: fileCandidates.rows.length + soundtrackCandidates.rows.length,
      storageObjectsDeleted: 0,
      fileRecordsMarked: 0,
      failures: 0,
      skippedSharedReferences: 0,
    }

    for (const candidate of fileCandidates.rows) {
      const outcome = await this.cleanupFile(candidate.id)
      if (outcome.kind === 'deleted') {
        result.storageObjectsDeleted += 1
        result.fileRecordsMarked += outcome.fileRecordsMarked || 0
      } else if (outcome.kind === 'failed') {
        result.failures += 1
      } else if (outcome.kind === 'shared') {
        result.skippedSharedReferences += 1
      }
    }

    for (const candidate of soundtrackCandidates.rows) {
      const outcome = await this.cleanupSoundtrack(candidate.id)
      if (outcome.kind === 'deleted') {
        result.storageObjectsDeleted += 1
        result.fileRecordsMarked += outcome.fileRecordsMarked || 0
      } else if (outcome.kind === 'failed') {
        result.failures += 1
      } else if (outcome.kind === 'shared') {
        result.skippedSharedReferences += 1
      }
    }

    return result
  }

  private async cleanupFile(fileId: string): Promise<CleanupOutcome> {
    const client = await pool.connect()
    let transactionStarted = false

    try {
      await client.query('BEGIN')
      transactionStarted = true
      const identityResult = await client.query(
        `SELECT f.bucket, f.storage_path
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE f.id = $1
           AND p.status = 'executed'
           AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
           AND f.storage_deleted_at IS NULL`,
        [fileId],
      )
      const identity = identityResult.rows[0]
      if (!identity) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return { kind: 'skipped' }
      }
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [identity.bucket && identity.storage_path ? `${identity.bucket}:${identity.storage_path}` : `file:${fileId}`],
      )
      const locked = await client.query(
        `SELECT f.id, f.bucket, f.storage_path
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE f.id = $1
           AND p.status = 'executed'
           AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
           AND f.storage_deleted_at IS NULL
         FOR UPDATE OF f SKIP LOCKED`,
        [fileId],
      )
      const file = locked.rows[0]
      if (!file) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return { kind: 'skipped' }
      }

      if (!file.bucket || !file.storage_path) {
        await client.query(
          `UPDATE files
           SET storage_delete_error = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [file.id, 'Storage object identity is missing'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        return { kind: 'failed' }
      }

      const activeReference = await client.query(
        `SELECT 1 FROM (
           SELECT other_file.bucket, other_file.storage_path
           FROM files other_file
           JOIN posts other_post ON other_post.id = other_file.post_id
           WHERE other_file.bucket = $1
             AND other_file.storage_path = $2
             AND other_file.storage_deleted_at IS NULL
             AND (other_post.status <> 'executed' OR other_post.executed_at IS NULL
               OR other_post.files_delete_after IS NULL OR other_post.files_delete_after > NOW()
               OR other_post.files_delete_after < other_post.executed_at)
           UNION ALL
           SELECT other_soundtrack.bucket, other_soundtrack.storage_path
           FROM post_soundtracks other_soundtrack
           JOIN posts other_post ON other_post.id = other_soundtrack.post_id
           WHERE other_soundtrack.bucket = $1
             AND other_soundtrack.storage_path = $2
             AND other_soundtrack.storage_deleted_at IS NULL
             AND other_soundtrack.deleted_at IS NULL
             AND (other_post.status <> 'executed' OR other_post.executed_at IS NULL
               OR other_post.files_delete_after IS NULL OR other_post.files_delete_after > NOW()
               OR other_post.files_delete_after < other_post.executed_at)
         ) active_references LIMIT 1`,
        [file.bucket, file.storage_path],
      )
      if (activeReference.rows[0]) {
        await client.query(
          `UPDATE files
           SET storage_delete_error = $3,
               updated_at = NOW()
           WHERE id = $1
             AND bucket = $2
             AND storage_deleted_at IS NULL`,
          [file.id, file.bucket, 'Storage object remains referenced by a file outside its retention window'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        return { kind: 'shared' }
      }

      const removal = await this.removeStorageObject({ bucket: file.bucket, storagePath: file.storage_path })
      if (!removal.removed) {
        await client.query(
          `UPDATE files
           SET storage_delete_error = $3,
               updated_at = NOW()
           WHERE id = $1
             AND bucket = $2
             AND storage_deleted_at IS NULL`,
          [file.id, file.bucket, 'Storage deletion failed; retry pending'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        logger.error('Storage retention cleanup failed', {
          fileId: file.id,
          error: 'Storage deletion failed; retry pending',
        })
        return { kind: 'failed' }
      }

      const marked = await client.query(
        `UPDATE files f
         SET storage_deleted_at = NOW(),
             storage_delete_error = NULL,
             updated_at = NOW()
         FROM posts p
         WHERE f.post_id = p.id
           AND f.bucket = $1
           AND f.storage_path = $2
           AND f.storage_deleted_at IS NULL
           AND p.status = 'executed' AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
         RETURNING f.id`,
        [file.bucket, file.storage_path],
      )
      const markedSoundtracks = await client.query(
        `UPDATE post_soundtracks ps
         SET storage_deleted_at = NOW(), storage_delete_error = NULL, updated_at = NOW()
         FROM posts p
         WHERE ps.post_id = p.id AND ps.bucket = $1 AND ps.storage_path = $2
           AND ps.storage_deleted_at IS NULL AND ps.deleted_at IS NULL
           AND p.status = 'executed' AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
         RETURNING ps.id`,
        [file.bucket, file.storage_path],
      )
      await client.query('COMMIT')
      transactionStarted = false
      const markedRecords = marked.rows.length + markedSoundtracks.rows.length
      return markedRecords
        ? { kind: 'deleted', fileRecordsMarked: markedRecords }
        : { kind: 'skipped' }
    } catch (error: any) {
      if (transactionStarted) await client.query('ROLLBACK')
      logger.error('Unexpected storage retention cleanup failure', {
        fileId,
        error: 'Unexpected cleanup failure; retry pending',
      })
      await pool.query(
        `UPDATE files
         SET storage_delete_error = $2,
             updated_at = NOW()
         WHERE id = $1
           AND storage_deleted_at IS NULL`,
        [fileId, 'Unexpected cleanup failure; retry pending'],
      ).catch(() => logger.error('Failed to record retention cleanup error', { fileId }))
      return { kind: 'failed' }
    } finally {
      client.release()
    }
  }

  private async cleanupSoundtrack(soundtrackId: string): Promise<CleanupOutcome> {
    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      const identityResult = await client.query(
        `SELECT ps.bucket, ps.storage_path
         FROM post_soundtracks ps
         JOIN posts p ON p.id = ps.post_id
         WHERE ps.id = $1
           AND ps.deleted_at IS NULL
           AND p.status = 'executed'
           AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
           AND ps.storage_deleted_at IS NULL`,
        [soundtrackId],
      )
      const identity = identityResult.rows[0]
      if (!identity) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return { kind: 'skipped' }
      }
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [identity.bucket && identity.storage_path ? `${identity.bucket}:${identity.storage_path}` : `soundtrack:${soundtrackId}`],
      )
      const locked = await client.query(
        `SELECT ps.id, ps.bucket, ps.storage_path
         FROM post_soundtracks ps
         JOIN posts p ON p.id = ps.post_id
         WHERE ps.id = $1
           AND ps.deleted_at IS NULL
           AND p.status = 'executed'
           AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
           AND ps.storage_deleted_at IS NULL
         FOR UPDATE OF ps SKIP LOCKED`,
        [soundtrackId],
      )
      const soundtrack = locked.rows[0]
      if (!soundtrack) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return { kind: 'skipped' }
      }
      if (!soundtrack.bucket || !soundtrack.storage_path) {
        await client.query(
          `UPDATE post_soundtracks SET storage_delete_error = $2, updated_at = NOW() WHERE id = $1`,
          [soundtrack.id, 'Storage object identity is missing'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        return { kind: 'failed' }
      }

      const activeReference = await client.query(
        `SELECT 1 FROM (
           SELECT f.bucket, f.storage_path
           FROM files f
           JOIN posts p ON p.id = f.post_id
           WHERE f.bucket = $1 AND f.storage_path = $2 AND f.storage_deleted_at IS NULL
             AND (p.status <> 'executed' OR p.executed_at IS NULL
               OR p.files_delete_after IS NULL OR p.files_delete_after > NOW()
               OR p.files_delete_after < p.executed_at)
           UNION ALL
           SELECT ps.bucket, ps.storage_path
           FROM post_soundtracks ps
           JOIN posts p ON p.id = ps.post_id
           WHERE ps.bucket = $1 AND ps.storage_path = $2 AND ps.storage_deleted_at IS NULL
             AND ps.deleted_at IS NULL AND ps.id <> $3
             AND (p.status <> 'executed' OR p.executed_at IS NULL
               OR p.files_delete_after IS NULL OR p.files_delete_after > NOW()
               OR p.files_delete_after < p.executed_at)
         ) active_references LIMIT 1`,
        [soundtrack.bucket, soundtrack.storage_path, soundtrack.id],
      )
      if (activeReference.rows[0]) {
        await client.query(
          `UPDATE post_soundtracks SET storage_delete_error = $2, updated_at = NOW() WHERE id = $1`,
          [soundtrack.id, 'Storage object remains referenced outside its retention window'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        return { kind: 'shared' }
      }

      const removal = await this.removeStorageObject({ bucket: soundtrack.bucket, storagePath: soundtrack.storage_path })
      if (!removal.removed) {
        await client.query(
          `UPDATE post_soundtracks SET storage_delete_error = $2, updated_at = NOW() WHERE id = $1`,
          [soundtrack.id, 'Storage deletion failed; retry pending'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        logger.error('Soundtrack retention cleanup failed', {
          soundtrackId: soundtrack.id,
          error: 'Storage deletion failed; retry pending',
        })
        return { kind: 'failed' }
      }

      const marked = await client.query(
        `UPDATE post_soundtracks ps
         SET storage_deleted_at = NOW(), storage_delete_error = NULL, updated_at = NOW()
         FROM posts p
         WHERE ps.post_id = p.id AND ps.bucket = $1 AND ps.storage_path = $2
           AND ps.storage_deleted_at IS NULL AND ps.deleted_at IS NULL
           AND p.status = 'executed' AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
         RETURNING ps.id`,
        [soundtrack.bucket, soundtrack.storage_path],
      )
      const markedFiles = await client.query(
        `UPDATE files f
         SET storage_deleted_at = NOW(), storage_delete_error = NULL, updated_at = NOW()
         FROM posts p
         WHERE f.post_id = p.id AND f.bucket = $1 AND f.storage_path = $2
           AND f.storage_deleted_at IS NULL
           AND p.status = 'executed' AND p.executed_at IS NOT NULL
           AND p.files_delete_after IS NOT NULL AND p.files_delete_after <= NOW()
           AND p.files_delete_after >= p.executed_at
         RETURNING f.id`,
        [soundtrack.bucket, soundtrack.storage_path],
      )
      await client.query('COMMIT')
      transactionStarted = false
      const markedRecords = marked.rows.length + markedFiles.rows.length
      return markedRecords
        ? { kind: 'deleted', fileRecordsMarked: markedRecords }
        : { kind: 'skipped' }
    } catch (error: any) {
      if (transactionStarted) await client.query('ROLLBACK')
      logger.error('Unexpected soundtrack retention cleanup failure', {
        soundtrackId,
        error: 'Unexpected cleanup failure; retry pending',
      })
      await pool.query(
        `UPDATE post_soundtracks SET storage_delete_error = $2, updated_at = NOW()
         WHERE id = $1 AND storage_deleted_at IS NULL`,
        [soundtrackId, 'Unexpected cleanup failure; retry pending'],
      ).catch(() => {})
      return { kind: 'failed' }
    } finally {
      client.release()
    }
  }
}
