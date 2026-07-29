import { PoolClient } from 'pg'
import { pool, query } from '../../../../shared/database/pool'
import { AppException } from '../../../../shared/exceptions/AppException'
import { removeStoredFile, StoredFile } from '../../../../shared/upload/storage'
import { logger } from '../../../../shared/utils/Logger'
import { derivePostApprovalStatus, SoundtrackApprovalStatus, SoundtrackInput } from '../../domain/Soundtrack'

type Actor = {
  id?: string
  role?: string
  companyId?: string
}

type SoundtrackScope = {
  clientId: string
  companyId?: string
}

type PreviousStorageReference = {
  bucket?: string | null
  storagePath?: string | null
  soundtrackId?: string
  versionId?: string
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function mapSoundtrack(row: any, history?: { versions?: any[]; decisions?: any[] }) {
  if (!row) return null
  return {
    id: row.id,
    postId: row.post_id,
    post_id: row.post_id,
    mode: row.mode,
    sourceMediaId: row.source_media_id,
    source_media_id: row.source_media_id,
    sourceMediaName: row.source_media_name || null,
    trackName: row.track_name,
    track_name: row.track_name,
    artist: row.artist,
    externalUrl: row.external_url,
    external_url: row.external_url,
    platform: row.platform,
    startTimeSeconds: Number(row.start_time_seconds || 0),
    start_time_seconds: Number(row.start_time_seconds || 0),
    usageSource: row.usage_source,
    usage_source: row.usage_source,
    usageNotes: row.usage_notes,
    usage_notes: row.usage_notes,
    rightsNotes: row.rights_notes,
    rights_notes: row.rights_notes,
    approvalStatus: row.approval_status,
    approval_status: row.approval_status,
    approvedAt: row.approved_at,
    approved_at: row.approved_at,
    adjustmentRequestedAt: row.adjustment_requested_at,
    adjustment_requested_at: row.adjustment_requested_at,
    adjustmentComment: row.adjustment_comment,
    adjustment_comment: row.adjustment_comment,
    revisionNumber: Number(row.revision_number || 1),
    revision_number: Number(row.revision_number || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audioFile: row.storage_path ? {
      url: row.audio_url,
      storage_url: row.audio_url,
      bucket: row.bucket,
      storagePath: row.storage_path,
      storage_path: row.storage_path,
      mimeType: row.mime_type,
      mime_type: row.mime_type,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
      originalName: row.original_name,
      original_name: row.original_name,
      storageDeletedAt: row.storage_deleted_at,
      storage_deleted_at: row.storage_deleted_at,
      storageDeleteError: row.storage_delete_error,
      storage_delete_error: row.storage_delete_error,
    } : null,
    history: history || { versions: [], decisions: [] },
  }
}

function snapshot(row: any) {
  const mapped = mapSoundtrack(row)
  if (!mapped) return {}
  const { history: _history, ...value } = mapped
  return value
}

export class SoundtrackRepository {
  async findByPostId(postId: string, companyId?: string) {
    if (companyId) {
      const scoped = await query(
        `SELECT id FROM posts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
        [postId, companyId],
      )
      if (!scoped.rows[0]) return null
    }
    const map = await this.findByPostIds([postId])
    return map.get(postId) || null
  }

  async findByPostIds(postIds: string[]) {
    const uniqueIds = Array.from(new Set(postIds.filter(Boolean)))
    const result = new Map<string, any>()
    if (!uniqueIds.length) return result

    const [soundtracks, versions, decisions] = await Promise.all([
      query(
        `SELECT ps.*, f.original_name AS source_media_name
         FROM post_soundtracks ps
         LEFT JOIN files f ON f.id = ps.source_media_id
         WHERE ps.post_id = ANY($1::uuid[])
           AND ps.deleted_at IS NULL`,
        [uniqueIds],
      ),
      query(
        `SELECT id, soundtrack_id, post_id, revision_number, reason, snapshot, actor_id, actor_role, created_at
         FROM post_soundtrack_versions
         WHERE post_id = ANY($1::uuid[])
         ORDER BY created_at, id`,
        [uniqueIds],
      ),
      query(
        `SELECT id, soundtrack_id, post_id, revision_number, decision, comment, actor_id, actor_role, created_at
         FROM post_soundtrack_decisions
         WHERE post_id = ANY($1::uuid[])
         ORDER BY created_at, id`,
        [uniqueIds],
      ),
    ])

    const versionsByPost = new Map<string, any[]>()
    versions.rows.forEach(row => versionsByPost.set(row.post_id, [...(versionsByPost.get(row.post_id) || []), row]))
    const decisionsByPost = new Map<string, any[]>()
    decisions.rows.forEach(row => decisionsByPost.set(row.post_id, [...(decisionsByPost.get(row.post_id) || []), row]))

    soundtracks.rows.forEach(row => {
      result.set(row.post_id, mapSoundtrack(row, {
        versions: versionsByPost.get(row.post_id) || [],
        decisions: decisionsByPost.get(row.post_id) || [],
      }))
    })
    return result
  }

  async isEmbeddedSource(postId: string, fileId: string) {
    const result = await query(
      `SELECT 1 FROM post_soundtracks
       WHERE post_id = $1 AND source_media_id = $2 AND mode = 'embedded' AND deleted_at IS NULL`,
      [postId, fileId],
    )
    return Boolean(result.rows[0])
  }

  async invalidateEmbeddedSource(postId: string, fileId: string, actor: Actor) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE post_soundtracks
         SET approval_status = 'pending', approved_at = NULL,
             adjustment_requested_at = NULL, adjustment_comment = NULL,
             revision_number = revision_number + 1, updated_at = NOW()
         WHERE post_id = $1 AND source_media_id = $2
           AND mode = 'embedded' AND deleted_at IS NULL
         RETURNING *`,
        [postId, fileId],
      )
      if (result.rows[0]) {
        await this.createVersion(client, result.rows[0], 'source_media_replaced', actor)
      }
      await client.query('COMMIT')
      return Boolean(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  private async lockMutablePost(client: PoolClient, postId: string, companyId?: string) {
    const params: any[] = [postId]
    const conditions = ['id = $1', 'deleted_at IS NULL']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }
    const result = await client.query(
      `SELECT id, client_id, company_id, status FROM posts
       WHERE ${conditions.join(' AND ')} FOR UPDATE`,
      params,
    )
    if (!result.rows[0]) throw new AppException('Postagem nao encontrada', 404, 'POST_NOT_FOUND')
    if (result.rows[0].status === 'executed') {
      throw new AppException('Postagens executadas nao podem ter o fundo sonoro alterado', 409, 'EXECUTED_POST_IMMUTABLE')
    }
    return result.rows[0]
  }

  private async resolveEmbeddedSource(client: PoolClient, postId: string, requestedId?: string | null) {
    const files = await client.query(
      `SELECT id, original_name
       FROM files
       WHERE post_id = $1
         AND storage_deleted_at IS NULL
         AND (UPPER(COALESCE(file_type, '')) = 'VIDEO' OR LOWER(COALESCE(mime_type, '')) LIKE 'video/%')
       ORDER BY COALESCE(sort_order, 999999), created_at, id`,
      [postId],
    )

    if (requestedId) {
      const selected = files.rows.find(file => file.id === requestedId)
      if (!selected) {
        throw new AppException('O video indicado nao pertence a esta postagem ou nao e compativel', 400, 'INVALID_SOUNDTRACK_SOURCE_MEDIA')
      }
      return selected.id
    }

    if (files.rows.length === 1) return files.rows[0].id
    if (!files.rows.length) {
      throw new AppException('Adicione um video compativel antes de marcar o audio como incorporado', 400, 'EMBEDDED_SOUNDTRACK_REQUIRES_VIDEO')
    }
    throw new AppException('Selecione qual video contem o fundo sonoro', 400, 'EMBEDDED_SOUNDTRACK_REQUIRES_SOURCE')
  }

  private async createVersion(client: PoolClient, row: any, reason: string, actor: Actor) {
    const result = await client.query(
      `INSERT INTO post_soundtrack_versions (
         soundtrack_id, post_id, revision_number, reason, snapshot, actor_id, actor_role
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (soundtrack_id, revision_number) DO NOTHING
       RETURNING id`,
      [
        row.id,
        row.post_id,
        row.revision_number,
        reason,
        JSON.stringify(snapshot(row)),
        actor.id || null,
        actor.role || null,
      ],
    )
    return result.rows[0]?.id
  }

  private async markPostForReview(client: PoolClient, postId: string, mode: string) {
    if (mode === 'none') {
      await this.recalculatePostStatusWithClient(client, postId)
      return
    }
    await client.query(
      `UPDATE posts
       SET status = CASE
             WHEN status IN ('sent', 'pending_approval', 'rejected', 'approved') THEN 'pending_approval'
             ELSE status
           END,
           approved_at = CASE WHEN status = 'approved' THEN NULL ELSE approved_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [postId],
    )
  }

  async save(postId: string, input: SoundtrackInput, actor: Actor, uploadedFile?: StoredFile & { originalName: string }) {
    const client = await pool.connect()
    let previousReference: PreviousStorageReference | null = null
    let saved: any = null
    try {
      await client.query('BEGIN')
      await this.lockMutablePost(client, postId, actor.companyId)
      const currentResult = await client.query(
        `SELECT * FROM post_soundtracks WHERE post_id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [postId],
      )
      const current = currentResult.rows[0]
      const currentVersion = current ? await client.query(
        `SELECT id FROM post_soundtrack_versions
         WHERE soundtrack_id = $1 AND revision_number = $2`,
        [current.id, current.revision_number],
      ) : null

      if (input.mode === 'none') {
        if (current) {
          previousReference = {
            bucket: current.bucket,
            storagePath: current.storage_path,
            soundtrackId: current.id,
            versionId: currentVersion?.rows[0]?.id,
          }
          const cleared = await client.query(
            `UPDATE post_soundtracks
             SET mode = 'none', source_media_id = NULL, track_name = NULL, artist = NULL,
                 external_url = NULL, platform = NULL, start_time_seconds = 0,
                 usage_source = NULL, usage_notes = NULL, rights_notes = NULL,
                 audio_url = NULL, bucket = NULL, storage_path = NULL, mime_type = NULL,
                 size_bytes = NULL, original_name = NULL, approval_status = 'pending',
                 approved_at = NULL, adjustment_requested_at = NULL, adjustment_comment = NULL,
                 revision_number = revision_number + 1, deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [current.id],
          )
          await this.createVersion(client, cleared.rows[0], 'disabled', actor)
        }
        await this.markPostForReview(client, postId, 'none')
        await client.query('COMMIT')
        saved = null
      } else {
        let sourceMediaId: string | null = null
        if (input.mode === 'embedded') {
          sourceMediaId = await this.resolveEmbeddedSource(client, postId, input.sourceMediaId)
        }

        if (input.mode === 'uploaded' && !uploadedFile && !current?.storage_path) {
          throw new AppException('Envie um arquivo de audio para esta modalidade', 400, 'SOUNDTRACK_FILE_REQUIRED')
        }

        if (current?.storage_path && (
          uploadedFile
          || input.mode !== 'uploaded'
        )) {
          previousReference = {
            bucket: current.bucket,
            storagePath: current.storage_path,
            soundtrackId: current.id,
            versionId: currentVersion?.rows[0]?.id,
          }
        }

        const audio = input.mode === 'uploaded'
          ? uploadedFile || {
              publicUrl: current?.audio_url,
              bucket: current?.bucket,
              storagePath: current?.storage_path,
              mimeType: current?.mime_type,
              sizeBytes: current?.size_bytes === null ? 0 : Number(current?.size_bytes || 0),
              originalName: current?.original_name,
            }
          : null

        const values = [
          input.mode,
          sourceMediaId,
          cleanText(input.trackName),
          cleanText(input.artist),
          cleanText(input.externalUrl),
          cleanText(input.platform),
          Number(input.startTimeSeconds || 0),
          input.usageSource || null,
          cleanText(input.usageNotes),
          cleanText(input.rightsNotes),
          audio?.publicUrl || null,
          audio?.bucket || null,
          audio?.storagePath || null,
          audio?.mimeType || null,
          audio?.sizeBytes ?? null,
          audio?.originalName || null,
        ]

        let row: any
        let reason: string
        if (current) {
          const updated = await client.query(
            `UPDATE post_soundtracks SET
               mode = $2, source_media_id = $3, track_name = $4, artist = $5,
               external_url = $6, platform = $7, start_time_seconds = $8,
               usage_source = $9, usage_notes = $10, rights_notes = $11,
               audio_url = $12, bucket = $13, storage_path = $14, mime_type = $15,
               size_bytes = $16, original_name = $17, approval_status = 'pending',
               approved_at = NULL, adjustment_requested_at = NULL, adjustment_comment = NULL,
               revision_number = revision_number + 1, storage_deleted_at = NULL,
               storage_delete_error = NULL, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [current.id, ...values],
          )
          row = updated.rows[0]
          reason = uploadedFile ? 'audio_replaced' : 'updated'
        } else {
          const created = await client.query(
            `INSERT INTO post_soundtracks (
               post_id, mode, source_media_id, track_name, artist, external_url, platform,
               start_time_seconds, usage_source, usage_notes, rights_notes, audio_url,
               bucket, storage_path, mime_type, size_bytes, original_name
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING *`,
            [postId, ...values],
          )
          row = created.rows[0]
          reason = 'created'
        }
        previousReference = previousReference || null
        await this.createVersion(client, row, reason, actor)
        await this.markPostForReview(client, postId, input.mode)
        await client.query('COMMIT')
        saved = row
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }

    if (previousReference?.bucket && previousReference.storagePath) {
      const sameAsCurrent = saved
        && saved.bucket === previousReference.bucket
        && saved.storage_path === previousReference.storagePath
      if (!sameAsCurrent) await this.removePreviousStorage(previousReference)
    }

    return saved ? this.findByPostId(postId) : null
  }

  private async removePreviousStorage(reference: PreviousStorageReference) {
    const active = await query(
      `SELECT 1 FROM (
         SELECT bucket, storage_path FROM files WHERE bucket = $1 AND storage_path = $2
         UNION ALL
         SELECT bucket, storage_path FROM post_soundtracks
          WHERE bucket = $1 AND storage_path = $2 AND deleted_at IS NULL
       ) active_references LIMIT 1`,
      [reference.bucket, reference.storagePath],
    )
    if (active.rows[0]) return

    const removal = await removeStoredFile({ bucket: reference.bucket, storagePath: reference.storagePath })
    if (!removal.removed) {
      logger.error('Failed to remove replaced soundtrack object', removal)
      if (reference.versionId) {
        await query(
          `UPDATE post_soundtrack_versions
           SET snapshot = snapshot || jsonb_build_object('storageDeleteError', $2)
           WHERE id = $1`,
          [reference.versionId, removal.error || 'Storage deletion failed'],
        ).catch(() => {})
      }
    }
  }

  async decide(postId: string, decision: 'approved' | 'adjustment_requested', comment: string | null, scope: SoundtrackScope, actorRole: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, scope.clientId]
      const conditions = [
        'ps.post_id = $1',
        'p.client_id = $2',
        'p.deleted_at IS NULL',
        "p.status IN ('sent', 'pending_approval', 'rejected')",
        'ps.deleted_at IS NULL',
        "ps.mode <> 'none'",
      ]
      if (scope.companyId) {
        params.push(scope.companyId)
        conditions.push(`p.company_id = $${params.length}`)
      }
      const locked = await client.query(
        `SELECT ps.* FROM post_soundtracks ps
         JOIN posts p ON p.id = ps.post_id
         WHERE ${conditions.join(' AND ')} FOR UPDATE OF ps, p`,
        params,
      )
      const soundtrack = locked.rows[0]
      if (!soundtrack) {
        await client.query('ROLLBACK')
        return null
      }
      if (decision === 'adjustment_requested' && !cleanText(comment)) {
        throw new AppException('O comentario do ajuste e obrigatorio', 400, 'SOUNDTRACK_ADJUSTMENT_COMMENT_REQUIRED')
      }

      await client.query(
        `UPDATE post_soundtracks SET
           approval_status = $2::text,
           approved_at = CASE WHEN $2::text = 'approved' THEN NOW() ELSE NULL END,
           adjustment_requested_at = CASE WHEN $2::text = 'adjustment_requested' THEN NOW() ELSE NULL END,
           adjustment_comment = CASE WHEN $2::text = 'adjustment_requested' THEN $3::text ELSE NULL END,
           updated_at = NOW()
         WHERE id = $1`,
        [soundtrack.id, decision, cleanText(comment)],
      )
      await client.query(
        `INSERT INTO post_soundtrack_decisions (
           soundtrack_id, post_id, revision_number, decision, comment, actor_id, actor_role
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [soundtrack.id, postId, soundtrack.revision_number, decision, cleanText(comment), scope.clientId, actorRole],
      )
      await this.recalculatePostStatusWithClient(client, postId)
      await client.query('COMMIT')
      return this.findByPostId(postId)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async resetDecision(postId: string, scope: SoundtrackScope) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, scope.clientId]
      const conditions = [
        'ps.post_id = $1', 'p.client_id = $2', 'p.deleted_at IS NULL',
        "p.status IN ('sent', 'pending_approval', 'rejected')", 'ps.deleted_at IS NULL',
        "ps.approval_status IN ('approved', 'adjustment_requested')",
      ]
      if (scope.companyId) {
        params.push(scope.companyId)
        conditions.push(`p.company_id = $${params.length}`)
      }
      const result = await client.query(
        `UPDATE post_soundtracks ps SET
           approval_status = 'pending', approved_at = NULL, adjustment_requested_at = NULL,
           adjustment_comment = NULL, updated_at = NOW()
         FROM posts p
         WHERE ps.post_id = p.id AND ${conditions.join(' AND ')}
         RETURNING ps.id`,
        params,
      )
      if (!result.rows[0]) {
        await client.query('ROLLBACK')
        return false
      }
      await this.recalculatePostStatusWithClient(client, postId)
      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async recalculatePostStatus(postId: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await this.recalculatePostStatusWithClient(client, postId)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async recalculatePostStatusWithClient(client: PoolClient, postId: string) {
    const state = await client.query(
      `SELECT
         COUNT(f.id) FILTER (WHERE LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent')) AS pending_files,
         COUNT(f.id) FILTER (WHERE LOWER(COALESCE(f.status, '')) = 'rejected') AS rejected_files,
         COUNT(f.id) AS total_files,
         MAX(CASE WHEN ps.deleted_at IS NULL AND ps.mode <> 'none' THEN ps.approval_status END) AS soundtrack_status
       FROM posts p
       LEFT JOIN files f ON f.post_id = p.id
       LEFT JOIN post_soundtracks ps ON ps.post_id = p.id AND ps.deleted_at IS NULL
       WHERE p.id = $1
       GROUP BY p.id`,
      [postId],
    )
    const row = state.rows[0]
    if (!row) return
    const status = derivePostApprovalStatus({
      pendingFiles: Number(row.pending_files || 0),
      rejectedFiles: Number(row.rejected_files || 0),
      totalFiles: Number(row.total_files || 0),
      soundtrackStatus: row.soundtrack_status as SoundtrackApprovalStatus | null,
    })
    if (!status) return
    await client.query(
      `UPDATE posts SET
         status = $2::text,
         approved_at = CASE WHEN $2::text = 'approved' THEN COALESCE(approved_at, NOW()) ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1 AND status <> 'executed'`,
      [postId, status],
    )
  }
}

export { mapSoundtrack }
