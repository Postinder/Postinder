import { query } from '../../../../shared/database/pool'
import { Post } from '../../domain/Post.entity'
import { IPostRepository, FindPostsFilter, PaginationParams } from '../../domain/repositories/IPostRepository'
import { PostMapper } from '../mappers/PostMapper'
import { logger } from '../../../../shared/utils/Logger'

export class PostRepository implements IPostRepository {
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
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags
               ) ORDER BY f.created_at
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
                 'rejection_reason', f.rejection_reason,
                 'rejection_tags', f.rejection_tags
               ) ORDER BY f.created_at
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

  async delete(id: string): Promise<void> {
    try {
      await query('DELETE FROM posts WHERE id = $1', [id])
    } catch (error) {
      logger.error('Failed to delete post', { error })
    }
  }
}
