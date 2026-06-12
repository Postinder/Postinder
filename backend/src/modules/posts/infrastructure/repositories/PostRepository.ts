import { query } from '../../../../shared/database/pool'
import { Post } from '../../domain/Post.entity'
import { IPostRepository, FindPostsFilter, PaginationParams } from '../../domain/repositories/IPostRepository'
import { PostMapper } from '../mappers/PostMapper'
import { logger } from '../../../../shared/utils/Logger'

export class PostRepository implements IPostRepository {
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
                 'storage_url', f.url,
                 'file_type', f.file_type,
                 'status', f.status,
                 'sort_order', f.sort_order,
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags,
                 'created_at', f.created_at,
                 'updated_at', f.updated_at
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
      return result.rows[0] ? PostMapper.toDomainWithFiles(result.rows[0]) : null
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
      } else {
        conditions.push(`p.status <> 'archived'`)
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
                 'storage_url', f.url,
                 'file_type', f.file_type,
                 'status', f.status,
                 'sort_order', f.sort_order,
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags,
                 'created_at', f.created_at,
                 'updated_at', f.updated_at
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

      return {
        posts: result.rows.map(row => PostMapper.toDomainWithFiles(row)),
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
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL']
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

  async softDelete(id: string, companyId?: string): Promise<boolean> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const result = await query(
      `UPDATE posts SET status = 'archived', updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params,
    )
    return Boolean(result.rows[0])
  }

  async exists(id: string, companyId?: string): Promise<boolean> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const result = await query(`SELECT id FROM posts WHERE ${conditions.join(' AND ')}`, params)
    return Boolean(result.rows[0])
  }

  async addFiles(postId: string, files: Array<{ url: string; originalName: string; fileType: string; sortOrder?: number }>, companyId?: string) {
    const postExists = await this.exists(postId, companyId)
    if (!postExists) return null

    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM files WHERE post_id = $1`,
      [postId],
    )
    const maxOrder = Number(maxOrderResult.rows[0]?.max_order || 0)

    const savedFiles = []
    for (const [index, file] of files.entries()) {
      const result = await query(
        `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING *`,
        [postId, file.url, file.originalName, file.fileType, file.sortOrder || maxOrder + index + 1],
      )
      savedFiles.push(result.rows[0])
    }

    await query(`UPDATE posts SET updated_at = NOW() WHERE id = $1`, [postId])
    return savedFiles
  }

  async replaceFile(postId: string, fileId: string, file: { url: string; originalName: string; fileType: string }, companyId?: string) {
    const postExists = await this.exists(postId, companyId)
    if (!postExists) return null

    const result = await query(
      `UPDATE files
       SET url = $1,
           original_name = $2,
           file_type = $3,
           status = 'pending',
           rejection_reason = NULL,
           rejection_tags = NULL,
           updated_at = NOW()
       WHERE id = $4
         AND post_id = $5
         AND status = 'rejected'
       RETURNING *`,
      [file.url, file.originalName, file.fileType, fileId, postId],
    )

    if (!result.rows[0]) return null

    await query(
      `UPDATE posts
       SET status = 'pending_approval', updated_at = NOW()
       WHERE id = $1`,
      [postId],
    )

    return result.rows[0]
  }

  async submitForApproval(id: string, companyId?: string): Promise<boolean> {
    const { params, conditions } = this.buildPostScope(id, companyId)
    const result = await query(
      `UPDATE posts
       SET status = CASE WHEN status = 'rejected' THEN 'pending_approval' ELSE 'sent' END,
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
         AND status IN ('draft', 'ready', 'rejected')
       RETURNING id`,
      params,
    )
    if (result.rows[0]) {
      await query(
        `UPDATE files
         SET status = 'pending',
             rejection_reason = NULL,
             rejection_tags = NULL,
             updated_at = NOW()
         WHERE post_id = $1
           AND status = 'rejected'`,
        [id],
      )
    }
    return Boolean(result.rows[0])
  }

  async reorderFiles(postId: string, files: Array<{ id: string; sort_order: number }>, companyId?: string) {
    const postExists = await this.exists(postId, companyId)
    if (!postExists) return false
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

  async removeFile(postId: string, fileId: string, companyId?: string) {
    const params: any[] = [postId, fileId]
    const postConditions = ['p.id = $1', 'p.deleted_at IS NULL']
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
       RETURNING f.id`,
      params,
    )

    if (!result.rows[0]) return false

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

    await query(`UPDATE posts SET updated_at = NOW() WHERE id = $1`, [postId])
    return true
  }

  async updateStatus(id: string, status: string, companyId?: string): Promise<boolean> {
    const allowed = ['draft', 'ready', 'sent', 'approved', 'rejected', 'archived', 'pending_approval']
    if (!allowed.includes(status)) return false

    const { params, conditions } = this.buildPostScope(id, companyId)
    const statusParam = params.length + 1
    const result = await query(
      `UPDATE posts
       SET status = $${statusParam}::text,
           submitted_at = CASE WHEN $${statusParam}::text IN ('sent', 'pending_approval') THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
           updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      [...params, status],
    )
    return Boolean(result.rows[0])
  }

  async submitManyForApproval(ids: string[], companyId?: string) {
    if (!ids.length) return []
    const params: any[] = [ids]
    const conditions = [
      'id = ANY($1::uuid[])',
      'deleted_at IS NULL',
      "status IN ('draft', 'ready', 'rejected')",
    ]
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
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
      await query(
        `UPDATE files
         SET status = 'pending',
             rejection_reason = NULL,
             rejection_tags = NULL,
             updated_at = NOW()
         WHERE post_id = ANY($1::uuid[])
           AND status = 'rejected'`,
        [sentIds],
      )
    }
    return result.rows
  }

  async duplicate(id: string, companyId?: string) {
    const { params, conditions } = this.buildPostScope(id, companyId, 'p')
    const post = await query(
      `INSERT INTO posts (
         client_id, company_id, title, description, status, channels, formats,
         scheduled_date, funnel_tag, email_link, created_at, updated_at
       )
       SELECT
         p.client_id, p.company_id, CONCAT(COALESCE(p.title, 'Post sem titulo'), ' (copia)'),
         p.description, 'draft', p.channels, p.formats, p.scheduled_date, p.funnel_tag,
         p.email_link, NOW(), NOW()
       FROM posts p
       WHERE ${conditions.join(' AND ')}
       RETURNING *`,
      params,
    )

    if (!post.rows[0]) return null

    await query(
      `INSERT INTO files (post_id, url, original_name, file_type, status, sort_order, rejection_reason, rejection_tags, created_at, updated_at)
       SELECT $1, url, original_name, file_type, 'pending', sort_order, NULL, NULL, NOW(), NOW()
       FROM files
       WHERE post_id = $2`,
      [post.rows[0].id, id],
    )

    return post.rows[0]
  }

  async resubmit(id: string, data: { title?: string; caption?: string; description?: string; justificativa?: string }, companyId?: string) {
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
    const conditions = [`id = $${params.length}`, 'deleted_at IS NULL']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE posts SET ${updates.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params,
    )

    if (!result.rows[0]) return false

    await query(`UPDATE files SET status = 'pending' WHERE post_id = $1 AND status = 'rejected'`, [id])

    if (data.justificativa) {
      await query(
        `INSERT INTO post_notes (post_id, note, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [id, data.justificativa],
      ).catch(() => {})
    }

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
