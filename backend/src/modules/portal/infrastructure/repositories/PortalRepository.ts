import crypto from 'crypto'
import { query } from '../../../../shared/database/pool'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function normalizePost(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    status: row.status,
    channels: row.channels || [],
    formats: row.formats || {},
    scheduledDate: row.scheduled_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    files: row.files || [],
  }
}

const pendingFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent')"
const approvableFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent', 'rejected')"
const clientVisiblePostStatusSql = "LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval', 'rejected', 'approved', 'executed')"
const clientReviewablePostStatusSql = "LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval', 'rejected')"

export class PortalRepository {
  async getClient(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT id, name, email, whatsapp, segment, color, deadline_days
       FROM clients
       WHERE ${conditions.join(' AND ')}`,
      params,
    )

    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      whatsapp: row.whatsapp,
      segment: row.segment,
      color: row.color,
      deadlineDays: row.deadline_days,
    }
  }

  async markClientAccess(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    await query(
      `UPDATE clients
       SET last_access_at = NOW(),
           updated_at = NOW()
       WHERE ${conditions.join(' AND ')}`,
      params,
    )
  }

  async createToken(input: { clientId: string; companyId?: string; createdBy?: string; days?: number }) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const days = Math.min(Math.max(Number(input.days) || 15, 1), 60)

    const client = await query(
      `SELECT id FROM clients
       WHERE id = $1
         AND is_active = true
         ${input.companyId ? 'AND company_id = $2' : ''}`,
      input.companyId ? [input.clientId, input.companyId] : [input.clientId],
    )
    if (!client.rows[0]) return null

    await query(
      `UPDATE client_portal_tokens
       SET revoked_at = NOW()
       WHERE client_id = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [input.clientId],
    )

    const result = await query(
      `INSERT INTO client_portal_tokens (client_id, company_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval, $5)
       RETURNING id, client_id, company_id, expires_at, created_at`,
      [input.clientId, input.companyId || null, tokenHash, String(days), input.createdBy || null],
    )

    return { token, record: result.rows[0] }
  }

  async validateToken(token: string) {
    const tokenHash = hashToken(token)
    const result = await query(
      `SELECT
         t.id AS token_id,
         t.client_id,
         t.company_id,
         t.expires_at,
         c.name,
         c.email,
         c.whatsapp,
         c.segment,
         c.color,
         c.deadline_days
       FROM client_portal_tokens t
       JOIN clients c ON c.id = t.client_id
       WHERE t.token_hash = $1
         AND t.revoked_at IS NULL
         AND t.expires_at > NOW()
         AND c.is_active = true`,
      [tokenHash],
    )

    const row = result.rows[0]
    if (!row) return null

    await query(
      `UPDATE client_portal_tokens SET last_used_at = NOW() WHERE id = $1`,
      [row.token_id],
    ).catch(() => {})

    await this.markClientAccess(row.client_id, row.company_id).catch(() => {})

    return {
      tokenId: row.token_id,
      clientId: row.client_id,
      companyId: row.company_id,
      expiresAt: row.expires_at,
      client: {
        id: row.client_id,
        name: row.name,
        email: row.email,
        whatsapp: row.whatsapp,
        segment: row.segment,
        color: row.color,
        deadlineDays: row.deadline_days,
      },
    }
  }

  async listPosts(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['p.client_id = $1', 'p.deleted_at IS NULL', clientVisiblePostStatusSql]
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
                'url', f.url,
                'file_type', f.file_type,
                'mime_type', f.mime_type,
                'size_bytes', f.size_bytes,
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
       GROUP BY p.id
       ORDER BY COALESCE(p.scheduled_date, p.created_at) DESC`,
      params,
    )

    return result.rows.map(normalizePost)
  }

  async approvePost(postId: string, scope: { clientId: string; companyId?: string }) {
    const params: any[] = [postId, scope.clientId]
    const conditions = ['id = $1', 'client_id = $2', 'deleted_at IS NULL']
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const post = await query(`SELECT id FROM posts p WHERE ${conditions.join(' AND ')} AND ${clientReviewablePostStatusSql}`, params)
    if (!post.rows[0]) return false

    await query(`UPDATE files SET status = 'approved', updated_at = NOW() WHERE post_id = $1`, [postId])
    await query(
      `UPDATE posts SET status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1 AND client_id = $2`,
      [postId, scope.clientId],
    )
    return true
  }

  private async recalculatePostStatus(postId: string) {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent')) AS pending_count,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
         COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
         COUNT(*) AS total_count
       FROM files
       WHERE post_id = $1`,
      [postId],
    )

    const row = result.rows[0]
    const pendingCount = Number(row?.pending_count || 0)
    const rejectedCount = Number(row?.rejected_count || 0)
    const totalCount = Number(row?.total_count || 0)

    if (pendingCount > 0) {
      await query(
        `UPDATE posts
         SET status = CASE WHEN $2::integer > 0 THEN 'rejected' ELSE 'sent' END,
             updated_at = NOW()
         WHERE id = $1`,
        [postId, rejectedCount],
      )
      return
    }

    if (rejectedCount > 0) {
      await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [postId])
      return
    }

    if (totalCount > 0) {
      await query(`UPDATE posts SET status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [postId])
    }
  }

  async approveFile(fileId: string, scope: { clientId: string; companyId?: string }) {
    const params: any[] = [fileId, scope.clientId]
    const conditions = ['f.id = $1', 'p.client_id = $2', 'p.deleted_at IS NULL', clientReviewablePostStatusSql, approvableFileStatusSql]
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE files f
       SET status = 'approved',
           rejection_reason = NULL,
           rejection_tags = NULL,
           updated_at = NOW()
       FROM posts p
       WHERE f.post_id = p.id
         AND ${conditions.join(' AND ')}
       RETURNING f.post_id`,
      params,
    )
    if (!result.rows[0]) return null

    await this.recalculatePostStatus(result.rows[0].post_id)
    return { postId: result.rows[0].post_id }
  }

  async rejectFile(fileId: string, comment: string, tags: string[], scope: { clientId: string; companyId?: string }) {
    const params: any[] = [fileId, scope.clientId, comment, tags]
    const conditions = ['f.id = $1', 'p.client_id = $2', 'p.deleted_at IS NULL', clientReviewablePostStatusSql, pendingFileStatusSql]
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE files f
       SET status = 'rejected',
           rejection_reason = $3,
           rejection_tags = $4,
           updated_at = NOW()
       FROM posts p
       WHERE f.post_id = p.id
         AND ${conditions.join(' AND ')}
       RETURNING f.post_id`,
      params,
    )
    if (!result.rows[0]) return null

    await this.recalculatePostStatus(result.rows[0].post_id)
    return { postId: result.rows[0].post_id }
  }

  async updateRejectedFileFeedback(fileId: string, comment: string, tags: string[], scope: { clientId: string; companyId?: string }) {
    const params: any[] = [fileId, scope.clientId, comment, tags]
    const conditions = ['f.id = $1', 'p.client_id = $2', 'p.deleted_at IS NULL', clientReviewablePostStatusSql, "LOWER(f.status) = 'rejected'"]
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE files f
       SET rejection_reason = $3,
           rejection_tags = $4,
           updated_at = NOW()
       FROM posts p
       WHERE f.post_id = p.id
         AND ${conditions.join(' AND ')}
       RETURNING f.post_id`,
      params,
    )
    if (!result.rows[0]) return null

    return { postId: result.rows[0].post_id }
  }

  async resetFile(fileId: string, scope: { clientId: string; companyId?: string }) {
    const params: any[] = [fileId, scope.clientId]
    const conditions = [
      'p.client_id = $2',
      'p.deleted_at IS NULL',
      clientReviewablePostStatusSql,
      "f.status IN ('approved', 'rejected')",
    ]
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `WITH scoped_files AS (
         SELECT f.id, f.post_id, f.updated_at
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE ${conditions.join(' AND ')}
       ),
       latest_file AS (
         SELECT id
         FROM scoped_files
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 1
       )
       UPDATE files f
       SET status = 'pending',
           rejection_reason = NULL,
           rejection_tags = NULL,
           updated_at = NOW()
       FROM scoped_files sf, latest_file lf
       WHERE f.id = sf.id
         AND f.id = lf.id
         AND f.id = $1
       RETURNING f.post_id`,
      params,
    )
    if (!result.rows[0]) return null

    await this.recalculatePostStatus(result.rows[0].post_id)
    return { postId: result.rows[0].post_id }
  }

  async rejectPost(postId: string, comment: string, scope: { clientId: string; companyId?: string }) {
    const params: any[] = [postId, scope.clientId]
    const conditions = ['id = $1', 'client_id = $2', 'deleted_at IS NULL']
    if (scope.companyId) {
      params.push(scope.companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const post = await query(`SELECT id FROM posts p WHERE ${conditions.join(' AND ')} AND ${clientReviewablePostStatusSql}`, params)
    if (!post.rows[0]) return false

    await query(
      `UPDATE files
       SET status = 'rejected',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE post_id = $1
         AND status <> 'approved'`,
      [postId, comment],
    )
    await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND client_id = $2`, [postId, scope.clientId])
    return true
  }

  async saveFeedback(input: { clientId: string; postId?: string; rating?: number; text: string; month?: string; companyId?: string }) {
    if (input.postId) {
      const params: any[] = [input.postId, input.clientId]
      const conditions = ['id = $1', 'client_id = $2', 'deleted_at IS NULL']
      if (input.companyId) {
        params.push(input.companyId)
        conditions.push(`company_id = $${params.length}`)
      }
      const post = await query(`SELECT id FROM posts p WHERE ${conditions.join(' AND ')} AND ${clientVisiblePostStatusSql}`, params)
      if (!post.rows[0]) return false
    }

    await query(
      `INSERT INTO feedback (client_id, post_id, rating, text, month)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.clientId,
        input.postId || null,
        input.rating || null,
        input.text,
        input.month || new Date().toISOString().slice(0, 7),
      ],
    )
    return true
  }

  async listFeedbacks(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['f.client_id = $1']
    if (companyId) {
      params.push(companyId)
      conditions.push(`c.company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT
         f.id,
         f.client_id,
         f.post_id,
         f.rating,
         f.text,
         f.month,
         f.created_at,
         p.title AS post_title
       FROM feedback f
       JOIN clients c ON c.id = f.client_id
       LEFT JOIN posts p ON p.id = f.post_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.created_at DESC`,
      params,
    )

    return result.rows
  }
}
