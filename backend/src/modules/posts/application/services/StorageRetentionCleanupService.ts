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

  async execute(): Promise<StorageRetentionCleanupResult> {
    const candidates = await pool.query(
      `SELECT f.id
       FROM files f
       JOIN posts p ON p.id = f.post_id
       WHERE p.files_delete_after IS NOT NULL
         AND p.files_delete_after <= NOW()
         AND f.storage_deleted_at IS NULL
       ORDER BY p.files_delete_after, f.created_at, f.id`,
    )

    const result: StorageRetentionCleanupResult = {
      candidates: candidates.rows.length,
      storageObjectsDeleted: 0,
      fileRecordsMarked: 0,
      failures: 0,
      skippedSharedReferences: 0,
    }

    for (const candidate of candidates.rows) {
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

    return result
  }

  private async cleanupFile(fileId: string): Promise<CleanupOutcome> {
    const client = await pool.connect()
    let transactionStarted = false

    try {
      await client.query('BEGIN')
      transactionStarted = true
      const locked = await client.query(
        `SELECT f.id, f.bucket, f.storage_path
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE f.id = $1
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
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

      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${file.bucket}:${file.storage_path}`])
      const activeReference = await client.query(
        `SELECT 1
         FROM files other_file
         JOIN posts other_post ON other_post.id = other_file.post_id
         WHERE other_file.bucket = $1
           AND other_file.storage_path = $2
           AND other_file.storage_deleted_at IS NULL
           AND (other_post.files_delete_after IS NULL OR other_post.files_delete_after > NOW())
         LIMIT 1`,
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
          [file.id, file.bucket, removal.error || 'Storage deletion failed'],
        )
        await client.query('COMMIT')
        transactionStarted = false
        logger.error('Storage retention cleanup failed', { fileId: file.id, ...removal })
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
           AND p.files_delete_after IS NOT NULL
           AND p.files_delete_after <= NOW()
         RETURNING f.id`,
        [file.bucket, file.storage_path],
      )
      await client.query('COMMIT')
      transactionStarted = false
      return marked.rows.length
        ? { kind: 'deleted', fileRecordsMarked: marked.rows.length }
        : { kind: 'skipped' }
    } catch (error: any) {
      if (transactionStarted) await client.query('ROLLBACK')
      logger.error('Unexpected storage retention cleanup failure', { fileId, error })
      await pool.query(
        `UPDATE files
         SET storage_delete_error = $2,
             updated_at = NOW()
         WHERE id = $1
           AND storage_deleted_at IS NULL`,
        [fileId, error?.message || 'Unexpected cleanup failure'],
      ).catch(updateError => logger.error('Failed to record retention cleanup error', { fileId, error: updateError }))
      return { kind: 'failed' }
    } finally {
      client.release()
    }
  }
}
