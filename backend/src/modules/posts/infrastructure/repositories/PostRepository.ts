import { pool, query } from '../../../../shared/database/pool'
import { Post } from '../../domain/Post.entity'
import { IPostRepository, FindPostsFilter, PaginationParams } from '../../domain/repositories/IPostRepository'
import { PostMapper } from '../mappers/PostMapper'
import { logger } from '../../../../shared/utils/Logger'
import { copyStoredFile, removeStoredFile, StoredFile } from '../../../../shared/upload/storage'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { AppException } from '../../../../shared/exceptions/AppException'

type PostMutationState = {
  allowed: boolean
  reason?: 'not_found' | 'executed'
}

type PostDeletionResult = {
  deleted: boolean
  reason?: 'not_found' | 'executed' | 'approved_requires_admin' | 'viewer_forbidden'
  post?: { id: string; clientId: string; title: string | null; status: string }
}

export class PostDuplicationError extends Error {
  constructor(public readonly code: 'legacy_file_identity_missing' | 'storage_copy_failed' | 'database_write_failed') {
    super(code)
  }
}

type StorageCopyFunction = typeof copyStoredFile

export class PostRepository implements IPostRepository {
  constructor(
    private readonly copyStorageObject: StorageCopyFunction = copyStoredFile,
    private readonly soundtrackRepository = new SoundtrackRepository(),
  ) {}

  private buildPostScope(id: string, companyId?: string, alias = '') {
    const params: any[] = [id]
    const prefix = alias ? `${alias}.` : ''
    const conditions = [`${prefix}id = $1`, `${prefix}deleted_at IS NULL`]

    if (companyId) {
      params.push(companyId)
      conditions.push(`${prefix}company_id = $${params.length}`)
    }

    return { params, conditions }
  }

  private async deletePostFiles(postId: string) {
    const files = await query(`SELECT id, bucket, storage_path FROM files WHERE post_id = $1`, [postId])
    const fileIds = files.rows.map(row => row.id)
    await Promise.all(files.rows.map(row => this.removeStorageObjectIfUnreferenced(
      { bucket: row.bucket, storagePath: row.storage_path },
      fileIds,
      'post',
    )))
    await query(`DELETE FROM files WHERE post_id = $1`, [postId])
  }

  private async removeStorageObjectIfUnreferenced(
    reference: { bucket?: string | null; storagePath?: string | null },
    excludedFileIds: string[] = [],
    context = 'file',
  ) {
    if (!reference.bucket || !reference.storagePath) {
      logger.warn('Storage object identity is missing; physical removal was skipped', { context, ...reference })
      return
    }

    const shared = await query(
      `SELECT 1 FROM (
         SELECT bucket, storage_path FROM files
         WHERE bucket = $1 AND storage_path = $2 AND NOT (id = ANY($3::uuid[]))
         UNION ALL
         SELECT bucket, storage_path FROM post_soundtracks
         WHERE bucket = $1 AND storage_path = $2 AND deleted_at IS NULL
       ) active_references LIMIT 1`,
      [reference.bucket, reference.storagePath, excludedFileIds],
    )
    if (shared.rows[0]) return

    const result = await removeStoredFile(reference)
    if (!result.removed) logger.error('Failed to remove storage object', { context, ...result })
  }

  async getMutationState(id: string, companyId?: string): Promise<PostMutationState> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const result = await query(
      `SELECT status FROM posts WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!result.rows[0]) return { allowed: false, reason: 'not_found' }
    if (result.rows[0].status === 'executed') return { allowed: false, reason: 'executed' }
    return { allowed: true }
  }

  async save(post: Post): Promise<Post> {
    try {
      const data = PostMapper.toPersistence(post)
      const result = await query(
        `INSERT INTO posts (
           id, client_id, company_id, title, description, status, channels, formats,
           scheduled_date, funnel_tag, email_link, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           channels = EXCLUDED.channels,
           formats = EXCLUDED.formats,
           scheduled_date = EXCLUDED.scheduled_date,
           funnel_tag = EXCLUDED.funnel_tag,
           email_link = EXCLUDED.email_link,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          data.id,
          data.client_id,
          data.company_id,
          data.title,
          data.description,
          data.status,
          data.channels,
          JSON.stringify(data.formats || {}),
          data.scheduled_date,
          data.funnel_tag,
          data.email_link,
          data.created_at,
          data.updated_at,
        ],
      )
      return PostMapper.toDomain(result.rows[0])
    } catch (error) {
      logger.error('Failed to save post', { error })
      throw new Error('Failed to save post')
    }
  }

  async findById(id: string, companyId?: string): Promise<Post | null> {
    try {
      const params: any[] = [id]
      const conditions = ['p.id = $1', 'p.deleted_at IS NULL']
      if (companyId) {
        params.push(companyId)
        conditions.push(`p.company_id = $${params.length}`)
      }

      const result = await query(
        `SELECT
           p.*,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', f.id,
                 'name', COALESCE(f.original_name, f.url),
                 'storage_url', CASE WHEN f.storage_deleted_at IS NULL THEN f.url ELSE NULL END,
                 'url', CASE WHEN f.storage_deleted_at IS NULL THEN f.url ELSE NULL END,
                 'file_type', f.file_type,
                 'mime_type', f.mime_type,
                 'size_bytes', f.size_bytes,
                 'status', f.status,
                 'sort_order', f.sort_order,
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags,
                 'created_at', f.created_at,
                 'updated_at', f.updated_at,
                 'storage_deleted_at', f.storage_deleted_at,
                 'storage_delete_error', f.storage_delete_error
               ) ORDER BY COALESCE(f.sort_order, 999999), f.created_at, f.id
             ) FILTER (WHERE f.id IS NOT NULL),
             '[]'
           ) AS files
         FROM posts p
         LEFT JOIN files f ON f.post_id = p.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY p.id`,
        params,
      )
      if (!result.rows[0]) return null
      const post = PostMapper.toDomainWithFiles(result.rows[0])
      ;(post as any).soundtrack = await this.soundtrackRepository.findByPostId(id)
      return post
    } catch (error) {
      logger.error('Failed to find post', { error })
      return null
    }
  }

  async findMany(filter: FindPostsFilter, pagination: PaginationParams) {
    try {
      const params: any[] = []
      const conditions: string[] = ['p.deleted_at IS NULL']

      if (filter.companyId) {
        conditions.push(`p.company_id = $${params.length + 1}`)
        params.push(filter.companyId)
      }
      if (filter.clientId) {
        conditions.push(`p.client_id = $${params.length + 1}`)
        params.push(filter.clientId)
      }
      if (filter.status) {
        conditions.push(`p.status = $${params.length + 1}`)
        params.push(filter.status)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = await query(
        `SELECT COUNT(*) as count FROM posts p ${where}`,
        params,
      )

      params.push(pagination.limit)
      params.push(pagination.offset)

      const result = await query(
        `SELECT
           p.*,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', f.id,
                 'name', COALESCE(f.original_name, f.url),
                 'storage_url', CASE WHEN f.storage_deleted_at IS NULL THEN f.url ELSE NULL END,
                 'url', CASE WHEN f.storage_deleted_at IS NULL THEN f.url ELSE NULL END,
                 'file_type', f.file_type,
                 'mime_type', f.mime_type,
                 'size_bytes', f.size_bytes,
                 'status', f.status,
                 'sort_order', f.sort_order,
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags,
                 'created_at', f.created_at,
                 'updated_at', f.updated_at,
                 'storage_deleted_at', f.storage_deleted_at,
                 'storage_delete_error', f.storage_delete_error
               ) ORDER BY COALESCE(f.sort_order, 999999), f.created_at, f.id
             ) FILTER (WHERE f.id IS NOT NULL),
             '[]'
           ) AS files
         FROM posts p
         LEFT JOIN files f ON f.post_id = p.id
         ${where}
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      )

      const posts = result.rows.map(row => PostMapper.toDomainWithFiles(row))
      const soundtracks = await this.soundtrackRepository.findByPostIds(posts.map(post => post.id))
      posts.forEach(post => { ;(post as any).soundtrack = soundtracks.get(post.id) || null })
      return {
        posts,
        total: parseInt(countResult.rows[0].count, 10),
      }
    } catch (error) {
      logger.error('Failed to list posts', { error })
      return { posts: [], total: 0 }
    }
  }

  async update(id: string, post: Post): Promise<Post> {
    return this.save(post)
  }

  async updateFields(id: string, data: any, companyId?: string) {
    const fields: string[] = ['updated_at = NOW()']
    const params: any[] = []

    if (data.title !== undefined) {
      params.push(data.title)
      fields.push(`title = $${params.length}`)
    }
    if (data.clientId !== undefined || data.client_id !== undefined) {
      params.push(data.clientId ?? data.client_id)
      fields.push(`client_id = $${params.length}`)
    }
    if (data.description !== undefined || data.caption !== undefined) {
      params.push(data.description ?? data.caption)
      fields.push(`description = $${params.length}`)
    }
    if (data.scheduled_date !== undefined || data.scheduledDate !== undefined) {
      params.push(data.scheduled_date ?? data.scheduledDate)
      fields.push(`scheduled_date = $${params.length}`)
    }
    if (data.funnel_tag !== undefined || data.funnelTag !== undefined) {
      params.push(data.funnel_tag ?? data.funnelTag)
      fields.push(`funnel_tag = $${params.length}`)
    }
    if (data.channels !== undefined) {
      params.push(data.channels)
      fields.push(`channels = $${params.length}`)
    }
    if (data.formats !== undefined) {
      params.push(JSON.stringify(data.formats))
      fields.push(`formats = $${params.length}`)
    }
    if (data.email_link !== undefined || data.emailLink !== undefined) {
      params.push(data.email_link ?? data.emailLink)
      fields.push(`email_link = $${params.length}`)
    }

    params.push(id)
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL', "status <> 'executed'"]
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE posts SET ${fields.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params,
    )

    return result.rows[0] || null
  }

  async softDelete(id: string, actorRole: string | undefined, companyId?: string): Promise<PostDeletionResult> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const post = await query(
      `SELECT id, client_id, title, status FROM posts WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!post.rows[0]) return { deleted: false, reason: 'not_found' }

    const current = post.rows[0]
    const role = String(actorRole || '').trim().toLowerCase()
    if (role === 'viewer') return { deleted: false, reason: 'viewer_forbidden' }
    if (current.status === 'executed') return { deleted: false, reason: 'executed' }
    if (current.status === 'approved' && role !== 'admin') {
      return { deleted: false, reason: 'approved_requires_admin' }
    }

    const deleteConditions = [...conditions, "status <> 'executed'"]
    if (role !== 'admin') deleteConditions.push("status <> 'approved'")
    const result = await query(
      `UPDATE posts
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE ${deleteConditions.join(' AND ')}
       RETURNING id`,
      params,
    )
    if (!result.rows[0]) return { deleted: false, reason: 'executed' }
    return {
      deleted: true,
      post: {
        id: current.id,
        clientId: current.client_id,
        title: current.title,
        status: current.status,
      },
    }
  }

  async exists(id: string, companyId?: string): Promise<boolean> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const result = await query(`SELECT id FROM posts WHERE ${conditions.join(' AND ')}`, params)
    return Boolean(result.rows[0])
  }

  async addFiles(postId: string, files: Array<{
    url: string
    bucket: string
    storagePath: string
    mimeType: string
    sizeBytes: number
    originalName: string
    fileType: string
    sortOrder?: number
  }>, companyId?: string) {
    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true

      const params: any[] = [postId]
      const conditions = ['id = $1', 'deleted_at IS NULL', "status <> 'executed'"]
      if (companyId) {
        params.push(companyId)
        conditions.push(`company_id = $${params.length}`)
      }
      const post = await client.query(`SELECT id FROM posts WHERE ${conditions.join(' AND ')} FOR UPDATE`, params)
      if (!post.rows[0]) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return null
      }

      const maxOrderResult = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM files WHERE post_id = $1`,
        [postId],
      )
      const maxOrder = Number(maxOrderResult.rows[0]?.max_order || 0)

      const savedFiles = []
      for (const [index, file] of files.entries()) {
        const result = await client.query(
          `INSERT INTO files (
             post_id, url, bucket, storage_path, mime_type, size_bytes,
             original_name, file_type, status, sort_order
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
           RETURNING *`,
          [
            postId,
            file.url,
            file.bucket,
            file.storagePath,
            file.mimeType,
            file.sizeBytes,
            file.originalName,
            file.fileType,
            file.sortOrder || maxOrder + index + 1,
          ],
        )
        savedFiles.push(result.rows[0])
      }

      await client.query(`UPDATE posts SET updated_at = NOW() WHERE id = $1`, [postId])
      await client.query('COMMIT')
      transactionStarted = false
      return savedFiles
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async replaceFile(postId: string, fileId: string, file: {
    url: string
    bucket: string
    storagePath: string
    mimeType: string
    sizeBytes: number
    originalName: string
    fileType: string
  }, companyId?: string) {
    const mutationState = await this.getMutationState(postId, companyId)
    if (!mutationState.allowed) return null

    const previous = await query(
      `SELECT bucket, storage_path
       FROM files
       WHERE id = $1 AND post_id = $2 AND status = 'rejected'`,
      [fileId, postId],
    )

    const result = await query(
      `UPDATE files
       SET url = $1,
            bucket = $2,
            storage_path = $3,
            mime_type = $4,
            size_bytes = $5,
            original_name = $6,
            file_type = $7,
           status = 'pending',
           rejection_reason = NULL,
           rejection_tags = NULL,
           updated_at = NOW()
        WHERE id = $8
          AND post_id = $9
         AND status = 'rejected'
       RETURNING *`,
      [
        file.url,
        file.bucket,
        file.storagePath,
        file.mimeType,
        file.sizeBytes,
        file.originalName,
        file.fileType,
        fileId,
        postId,
      ],
    )

    if (!result.rows[0]) return null

    await query(`DELETE FROM portal_item_review_drafts WHERE post_id = $1 AND file_id = $2`, [postId, fileId])

    const previousReference = previous.rows[0]
    if (
      previousReference
      && (previousReference.bucket !== file.bucket || previousReference.storage_path !== file.storagePath)
    ) {
      await this.removeStorageObjectIfUnreferenced({
        bucket: previousReference.bucket,
        storagePath: previousReference.storage_path,
      }, [fileId], 'replacement')
    }

    await query(
      `UPDATE posts
       SET status = 'pending_approval', updated_at = NOW()
       WHERE id = $1`,
      [postId],
    )

    return result.rows[0]
  }

  async submitForApproval(id: string, companyId?: string, includeSoundtrack = true): Promise<boolean> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE posts
         SET status = CASE WHEN status = 'rejected' THEN 'pending_approval' ELSE 'sent' END,
             submitted_at = NOW(),
             updated_at = NOW()
         WHERE ${conditions.join(' AND ')}
           AND status IN ('draft', 'ready', 'rejected')
           AND (
             EXISTS (SELECT 1 FROM files f WHERE f.post_id = posts.id)
             OR (channels = ARRAY['E-mail Marketing']::text[] AND email_link IS NOT NULL)
           )
         RETURNING id`,
        params,
      )
      if (!result.rows[0]) {
        await client.query('ROLLBACK')
        return false
      }
      await client.query(
        `UPDATE files
         SET status = 'pending',
             rejection_reason = NULL,
             rejection_tags = NULL,
             updated_at = NOW()
         WHERE post_id = $1
           AND status = 'rejected'`,
        [id],
      )
      await client.query(
        `DELETE FROM portal_item_review_drafts d
         USING files f
         WHERE d.file_id = f.id AND d.post_id = $1 AND f.post_id = $1 AND f.status = 'pending'`,
        [id],
      )
      await client.query(
        `UPDATE portal_post_reviews SET rewind_used = FALSE, updated_at = NOW() WHERE post_id = $1`,
        [id],
      )
      if (includeSoundtrack) await client.query(
        `UPDATE post_soundtracks
         SET approval_status = 'pending', approved_at = NULL,
             adjustment_requested_at = NULL, adjustment_comment = NULL, updated_at = NOW()
         WHERE post_id = $1 AND deleted_at IS NULL AND approval_status = 'adjustment_requested'`,
        [id],
      )
      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async reorderFiles(postId: string, files: Array<{ id: string; sort_order: number }>, companyId?: string) {
    const mutationState = await this.getMutationState(postId, companyId)
    if (!mutationState.allowed) return false
    if (!files.length) return true

    const fileIds = files.map(file => file.id)
    const existing = await query(
      `SELECT id FROM files WHERE post_id = $1 AND id = ANY($2::uuid[])`,
      [postId, fileIds],
    )
    if (existing.rows.length !== fileIds.length) return false

    const valuesSql = files.map((_, index) => `($${index * 2 + 2}::uuid, $${index * 2 + 3}::integer)`).join(', ')
    const params: any[] = [postId]
    files.forEach(file => {
      params.push(file.id, file.sort_order)
    })

    await query(
      `UPDATE files f
       SET sort_order = ordered.sort_order,
           updated_at = NOW()
       FROM (VALUES ${valuesSql}) AS ordered(id, sort_order)
       WHERE f.post_id = $1
         AND f.id = ordered.id`,
      params,
    )

    return true
  }

  async removeFile(postId: string, fileId: string, companyId?: string, enforceSoundtrackSource = true) {
    if (enforceSoundtrackSource && await this.soundtrackRepository.isEmbeddedSource(postId, fileId)) {
      throw new AppException('O video esta vinculado ao fundo sonoro incorporado. Altere a modalidade antes de remove-lo.', 409, 'SOUNDTRACK_SOURCE_IN_USE')
    }
    const params: any[] = [postId, fileId]
    const postConditions = ['p.id = $1', 'p.deleted_at IS NULL', "p.status <> 'executed'"]
    if (companyId) {
      params.push(companyId)
      postConditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `DELETE FROM files f
       USING posts p
       WHERE f.post_id = p.id
         AND ${postConditions.join(' AND ')}
         AND f.id = $2
        RETURNING f.id, f.bucket, f.storage_path`,
      params,
    )

    if (!result.rows[0]) return false

    await this.removeStorageObjectIfUnreferenced({
      bucket: result.rows[0].bucket,
      storagePath: result.rows[0].storage_path,
    }, [], 'manual removal')

    await query(
      `WITH ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 999999), created_at, id) AS next_order
         FROM files
         WHERE post_id = $1
       )
       UPDATE files f
       SET sort_order = ordered.next_order,
           updated_at = NOW()
       FROM ordered
       WHERE f.id = ordered.id`,
      [postId],
    )

    await query(`UPDATE posts SET updated_at = NOW() WHERE id = $1 AND status <> 'executed'`, [postId])
    return true
  }

  async updateStatus(
    id: string,
    status: string,
    companyId?: string,
  ): Promise<{ updated: boolean; reason?: 'not_found' | 'invalid_status' | 'invalid_transition' }> {
    if (!['draft', 'ready'].includes(status)) return { updated: false, reason: 'invalid_status' }

    const { params, conditions } = this.buildPostScope(id, companyId)
    const current = await query(
      `SELECT status FROM posts WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!current.rows[0]) return { updated: false, reason: 'not_found' }

    const expectedStatus = status === 'ready' ? 'draft' : 'ready'
    if (current.rows[0].status !== expectedStatus) {
      return { updated: false, reason: 'invalid_transition' }
    }

    const statusParam = params.length + 1
    const expectedStatusParam = params.length + 2
    const result = await query(
      `UPDATE posts
       SET status = $${statusParam}::text,
           updated_at = NOW()
       WHERE ${conditions.join(' AND ')} AND status = $${expectedStatusParam}::text
       RETURNING id`,
      [...params, status, expectedStatus],
    )
    return result.rows[0]
      ? { updated: true }
      : { updated: false, reason: 'invalid_transition' }
  }

  async submitManyForApproval(ids: string[], companyId?: string, includeSoundtrack = true) {
    if (!ids.length) return []
    const params: any[] = [ids]
    const conditions = [
      'id = ANY($1::uuid[])',
      'deleted_at IS NULL',
      "status IN ('draft', 'ready', 'rejected')",
      `(EXISTS (SELECT 1 FROM files f WHERE f.post_id = posts.id)
        OR (channels = ARRAY['E-mail Marketing']::text[] AND email_link IS NOT NULL))`,
    ]
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE posts
         SET status = CASE WHEN status = 'rejected' THEN 'pending_approval' ELSE 'sent' END,
             submitted_at = NOW(),
             updated_at = NOW()
         WHERE ${conditions.join(' AND ')}
         RETURNING id, client_id, title, channels, scheduled_date`,
        params,
      )
      const sentIds = result.rows.map(row => row.id)
      if (sentIds.length) {
        await client.query(
          `UPDATE files
           SET status = 'pending',
               rejection_reason = NULL,
               rejection_tags = NULL,
               updated_at = NOW()
           WHERE post_id = ANY($1::uuid[])
             AND status = 'rejected'`,
          [sentIds],
        )
        await client.query(
          `DELETE FROM portal_item_review_drafts d
           USING files f
           WHERE d.file_id = f.id
             AND d.post_id = f.post_id
             AND f.post_id = ANY($1::uuid[])
             AND f.status = 'pending'`,
          [sentIds],
        )
        await client.query(
          `UPDATE portal_post_reviews
           SET rewind_used = FALSE, updated_at = NOW()
           WHERE post_id = ANY($1::uuid[])`,
          [sentIds],
        )
        if (includeSoundtrack) await client.query(
          `UPDATE post_soundtracks
           SET approval_status = 'pending', approved_at = NULL,
               adjustment_requested_at = NULL, adjustment_comment = NULL, updated_at = NOW()
           WHERE post_id = ANY($1::uuid[])
             AND deleted_at IS NULL
             AND approval_status = 'adjustment_requested'`,
          [sentIds],
        )
      }
      await client.query('COMMIT')
      return result.rows
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async duplicate(id: string, companyId?: string, includeSoundtrack = true) {
    const client = await pool.connect()
    const copiedFiles: StoredFile[] = []
    let transactionStarted = false

    try {
      await client.query('BEGIN')
      transactionStarted = true

      const { params, conditions } = this.buildPostScope(id, companyId, 'p')
      const originalPost = await client.query(
        `SELECT p.* FROM posts p WHERE ${conditions.join(' AND ')} FOR UPDATE`,
        params,
      )
      if (!originalPost.rows[0]) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return null
      }

      const originalFiles = await client.query(
        `SELECT id, bucket, storage_path, mime_type, size_bytes, original_name, file_type, sort_order
         FROM files
         WHERE post_id = $1
         ORDER BY sort_order NULLS LAST, created_at, id`,
        [id],
      )
      if (originalFiles.rows.some(file => !file.bucket || !file.storage_path)) {
        throw new PostDuplicationError('legacy_file_identity_missing')
      }
      const originalSoundtrack = includeSoundtrack ? await client.query(
        `SELECT * FROM post_soundtracks
         WHERE post_id = $1 AND deleted_at IS NULL AND mode <> 'none'
         FOR UPDATE`,
        [id],
      ) : { rows: [] as any[] }
      if (originalSoundtrack.rows[0]?.mode === 'uploaded'
        && (!originalSoundtrack.rows[0].bucket || !originalSoundtrack.rows[0].storage_path)) {
        throw new PostDuplicationError('legacy_file_identity_missing')
      }

      const source = originalPost.rows[0]
      const duplicatedPost = await client.query(
        `INSERT INTO posts (
           client_id, company_id, title, description, status, channels, formats,
           scheduled_date, funnel_tag, email_link, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          source.client_id,
          source.company_id,
          `${source.title || 'Post sem titulo'} (copia)`,
          source.description,
          source.channels,
          source.formats,
          source.scheduled_date,
          source.funnel_tag,
          source.email_link,
        ],
      )
      const post = duplicatedPost.rows[0]

      const duplicatedFileIds = new Map<string, string>()
      let duplicatedAttachmentCount = 0
      for (const file of originalFiles.rows) {
        let copied: StoredFile
        try {
          copied = await this.copyStorageObject(
            { bucket: file.bucket, storagePath: file.storage_path },
            {
              postId: post.id,
              originalName: file.original_name,
              mimeType: file.mime_type,
              sizeBytes: file.size_bytes === null ? null : Number(file.size_bytes),
            },
          )
        } catch (error) {
          if (error instanceof PostDuplicationError) throw error
          logger.error('Failed to copy storage object while duplicating post', {
            sourcePostId: id,
            duplicatedPostId: post.id,
            fileId: file.id,
            error,
          })
          throw new PostDuplicationError('storage_copy_failed')
        }
        copiedFiles.push(copied)

        const duplicatedFile = await client.query(
          `INSERT INTO files (
             post_id, url, bucket, storage_path, mime_type, size_bytes,
             original_name, file_type, status, sort_order, rejection_reason, rejection_tags, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NULL, NULL, NOW(), NOW())
           RETURNING id`,
          [
            post.id,
            copied.publicUrl,
            copied.bucket,
            copied.storagePath,
            copied.mimeType,
            copied.sizeBytes,
            file.original_name,
            file.file_type,
            file.sort_order,
          ],
        )
        duplicatedFileIds.set(file.id, duplicatedFile.rows[0].id)
        duplicatedAttachmentCount += 1
      }

      const sourceSoundtrack = originalSoundtrack.rows[0]
      if (sourceSoundtrack) {
        let soundtrackCopy: StoredFile | null = null
        if (sourceSoundtrack.mode === 'uploaded') {
          try {
            soundtrackCopy = await this.copyStorageObject(
              { bucket: sourceSoundtrack.bucket, storagePath: sourceSoundtrack.storage_path },
              {
                postId: post.id,
                folder: 'soundtracks',
                originalName: sourceSoundtrack.original_name,
                mimeType: sourceSoundtrack.mime_type,
                sizeBytes: sourceSoundtrack.size_bytes === null ? null : Number(sourceSoundtrack.size_bytes),
              },
            )
            copiedFiles.push(soundtrackCopy)
          } catch (error) {
            logger.error('Failed to copy soundtrack while duplicating post', { sourcePostId: id, duplicatedPostId: post.id, error })
            throw new PostDuplicationError('storage_copy_failed')
          }
        }

        const sourceMediaId = sourceSoundtrack.source_media_id
          ? duplicatedFileIds.get(sourceSoundtrack.source_media_id) || null
          : null
        const duplicatedSoundtrack = await client.query(
          `INSERT INTO post_soundtracks (
             post_id, mode, source_media_id, track_name, artist, external_url, platform,
             start_time_seconds, usage_source, usage_notes, rights_notes,
             audio_url, bucket, storage_path, mime_type, size_bytes, original_name,
             approval_status, revision_number, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, 'pending', 1, NOW(), NOW()
           ) RETURNING *`,
          [
            post.id,
            sourceSoundtrack.mode,
            sourceMediaId,
            sourceSoundtrack.track_name,
            sourceSoundtrack.artist,
            sourceSoundtrack.external_url,
            sourceSoundtrack.platform,
            sourceSoundtrack.start_time_seconds,
            sourceSoundtrack.usage_source,
            sourceSoundtrack.usage_notes,
            sourceSoundtrack.rights_notes,
            soundtrackCopy?.publicUrl || null,
            soundtrackCopy?.bucket || null,
            soundtrackCopy?.storagePath || null,
            soundtrackCopy?.mimeType || null,
            soundtrackCopy?.sizeBytes ?? null,
            sourceSoundtrack.original_name,
          ],
        )
        const soundtrack = duplicatedSoundtrack.rows[0]
        await client.query(
          `INSERT INTO post_soundtrack_versions (
             soundtrack_id, post_id, revision_number, reason, snapshot, actor_role
           ) VALUES ($1, $2, 1, 'duplicated', to_jsonb($3::jsonb), 'system')`,
          [soundtrack.id, post.id, JSON.stringify(soundtrack)],
        )
      }

      await client.query('COMMIT')
      transactionStarted = false
      return { ...post, duplicatedFileCount: duplicatedAttachmentCount, duplicatedSoundtrack: Boolean(sourceSoundtrack) }
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK')
      const removals = await Promise.all(copiedFiles.map(file => removeStoredFile({
        bucket: file.bucket,
        storagePath: file.storagePath,
      })))
      removals.filter(result => !result.removed).forEach(result => {
        logger.error('Failed to compensate copied storage object', { sourcePostId: id, ...result })
      })

      if (error instanceof PostDuplicationError) throw error
      logger.error('Failed to persist duplicated post', { sourcePostId: id, error })
      throw new PostDuplicationError('database_write_failed')
    } finally {
      client.release()
    }
  }

  async resubmit(id: string, data: { title?: string; caption?: string; description?: string; justificativa?: string }, companyId?: string, includeSoundtrack = true) {
    const updates: string[] = [`status = 'pending_approval'`, 'updated_at = NOW()']
    const params: any[] = []

    if (data.title) {
      params.push(data.title)
      updates.push(`title = $${params.length}`)
    }
    if (data.caption || data.description) {
      params.push(data.caption || data.description)
      updates.push(`description = $${params.length}`)
    }

    params.push(id)
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL', "status <> 'executed'"]
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE posts SET ${updates.join(', ')}
         WHERE ${conditions.join(' AND ')}
         RETURNING id`,
        params,
      )

      if (!result.rows[0]) {
        await client.query('ROLLBACK')
        return false
      }

      const resetFiles = await client.query(
        `UPDATE files SET status = 'pending', updated_at = NOW()
         WHERE post_id = $1 AND status = 'rejected'
         RETURNING id`,
        [id],
      )
      if (resetFiles.rows.length) {
        await client.query(
          `DELETE FROM portal_item_review_drafts
           WHERE post_id = $1 AND file_id = ANY($2::uuid[])`,
          [id, resetFiles.rows.map(file => file.id)],
        )
      }
      await client.query(
        `UPDATE portal_post_reviews SET rewind_used = FALSE, updated_at = NOW() WHERE post_id = $1`,
        [id],
      )
      if (includeSoundtrack) await client.query(
        `UPDATE post_soundtracks
         SET approval_status = 'pending', approved_at = NULL,
             adjustment_requested_at = NULL, adjustment_comment = NULL, updated_at = NOW()
         WHERE post_id = $1 AND deleted_at IS NULL AND approval_status = 'adjustment_requested'`,
        [id],
      )
      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async markExecuted(id: string, retentionHours = 24, companyId?: string) {
    const { params, conditions } = this.buildPostScope(id, companyId)

    const result = await query(
      `UPDATE posts
       SET status = 'executed',
           executed_at = NOW(),
           files_delete_after = NOW() + ($${params.length + 1}::text || ' hours')::interval,
           files_retention_policy = NULL,
           updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
         AND status = 'approved'
       RETURNING id`,
       [...params, String(retentionHours)],
    )

    if (!result.rows[0]) return false
    return true
  }

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM posts WHERE id = $1', [id])
    } catch (error) {
      logger.error('Failed to delete post', { error })
    }
  }
}
