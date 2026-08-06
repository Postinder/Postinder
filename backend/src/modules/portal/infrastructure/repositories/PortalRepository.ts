import crypto from 'crypto'
import { pool, query } from '../../../../shared/database/pool'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { decryptPortalToken, encryptPortalToken } from '../portalTokenCipher'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function normalizePortalEmailLink(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null
  } catch {
    return null
  }
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
    emailLink: normalizePortalEmailLink(row.email_link),
    files: row.files || [],
  }
}

function queueTimestamp(value: unknown) {
  if (!value) return null
  const timestamp = new Date(String(value)).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function comparePortalQueueItems(left: any, right: any) {
  const leftScheduled = queueTimestamp(left.scheduledDate ?? left.scheduled_date)
  const rightScheduled = queueTimestamp(right.scheduledDate ?? right.scheduled_date)
  if (leftScheduled === null && rightScheduled !== null) return 1
  if (leftScheduled !== null && rightScheduled === null) return -1
  if (leftScheduled !== rightScheduled) return (leftScheduled || 0) - (rightScheduled || 0)

  const leftCreated = queueTimestamp(left.createdAt ?? left.created_at) || 0
  const rightCreated = queueTimestamp(right.createdAt ?? right.created_at) || 0
  if (leftCreated !== rightCreated) return leftCreated - rightCreated
  return String(left.id || '').localeCompare(String(right.id || ''))
}

const pendingFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent')"
const approvableFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent', 'rejected')"
const clientVisiblePostStatusSql = "LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval', 'rejected', 'approved', 'executed')"
const clientReviewablePostStatusSql = "LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval', 'rejected')"

export class PortalRepository {
  private readonly soundtrackRepository = new SoundtrackRepository()
  async getClient(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT id, name, email, whatsapp, segment, color, deadline_days, portal_detailed_view
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
      portalDetailedView: row.portal_detailed_view === true,
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

  private async issueToken(
    input: { clientId: string; companyId?: string; createdBy?: string; days?: number },
    replace: boolean,
  ) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const tokenCiphertext = encryptPortalToken(token)
    const days = Math.min(Math.max(Number(input.days) || 15, 1), 60)
    const databaseClient = await pool.connect()
    let transactionStarted = false
    try {
      await databaseClient.query('BEGIN')
      transactionStarted = true
      await databaseClient.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`portal-link:${input.clientId}`])
      const client = await databaseClient.query(
        `SELECT id, company_id FROM clients
         WHERE id = $1
           AND is_active = true
           ${input.companyId ? 'AND company_id = $2' : ''}
         FOR UPDATE`,
        input.companyId ? [input.clientId, input.companyId] : [input.clientId],
      )
      if (!client.rows[0]) {
        await databaseClient.query('ROLLBACK')
        transactionStarted = false
        return null
      }

      await databaseClient.query(
        `UPDATE client_portal_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE client_id = $1
           AND revoked_at IS NULL
           AND expires_at <= NOW()`,
        [input.clientId],
      )
      const active = await databaseClient.query(
        `SELECT id, expires_at, created_at, token_ciphertext
         FROM client_portal_tokens
         WHERE client_id = $1
           AND revoked_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [input.clientId],
      )
      if (active.rows[0] && !replace) {
        await databaseClient.query('ROLLBACK')
        transactionStarted = false
        return { existing: true as const, record: active.rows[0] }
      }

      if (replace) {
        await databaseClient.query(
          `UPDATE client_portal_tokens
           SET revoked_at = NOW()
           WHERE client_id = $1
             AND revoked_at IS NULL`,
          [input.clientId],
        )
      }

      const result = await databaseClient.query(
        `INSERT INTO client_portal_tokens (
           client_id, company_id, token_hash, token_ciphertext, expires_at, created_by
         )
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval, $6)
         RETURNING id, client_id, company_id, expires_at, created_at`,
        [input.clientId, input.companyId || client.rows[0].company_id || null, tokenHash, tokenCiphertext, String(days), input.createdBy || null],
      )
      await databaseClient.query('COMMIT')
      transactionStarted = false
      return { existing: false as const, token, record: result.rows[0] }
    } catch (error) {
      if (transactionStarted) await databaseClient.query('ROLLBACK')
      throw error
    } finally {
      databaseClient.release()
    }
  }

  async createToken(input: { clientId: string; companyId?: string; createdBy?: string; days?: number }) {
    return this.issueToken(input, false)
  }

  async replaceToken(input: { clientId: string; companyId?: string; createdBy?: string; days?: number }) {
    return this.issueToken(input, true)
  }

  async getActiveToken(input: { clientId: string; companyId?: string }) {
    const result = await query(
      `SELECT t.id, t.expires_at, t.created_at, t.token_ciphertext
       FROM client_portal_tokens t
       JOIN clients c ON c.id = t.client_id
       WHERE t.client_id = $1
         AND t.revoked_at IS NULL
         AND t.expires_at > NOW()
         AND c.is_active = true
         ${input.companyId ? 'AND c.company_id = $2' : ''}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT 1`,
      input.companyId ? [input.clientId, input.companyId] : [input.clientId],
    )
    const record = result.rows[0]
    if (!record) return null
    return {
      record,
      token: decryptPortalToken(record.token_ciphertext),
    }
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
         c.deadline_days,
         c.portal_detailed_view
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
        portalDetailedView: row.portal_detailed_view === true,
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
       ORDER BY p.scheduled_date ASC NULLS LAST, p.created_at ASC, p.id ASC`,
      params,
    )

    const posts = result.rows.map(normalizePost)
    const soundtracks = await this.soundtrackRepository.findByPostIds(posts.map(post => post.id))
    posts.forEach(post => {
      ;(post as any).soundtrack = soundtracks.get(post.id) || null
      ;(post as any).soundtrackMode = (post as any).soundtrack?.mode || 'none'
    })
    return posts.sort(comparePortalQueueItems)
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

    const soundtrack = await this.soundtrackRepository.findByPostId(postId)
    if (soundtrack) {
      await this.soundtrackRepository.decide(postId, 'approved', null, scope, 'client_portal')
    }
    await query(`UPDATE files SET status = 'approved', updated_at = NOW() WHERE post_id = $1`, [postId])
    const fileCount = await query(`SELECT COUNT(*)::integer AS count FROM files WHERE post_id = $1`, [postId])
    if (Number(fileCount.rows[0]?.count) === 0) {
      await query(
        `UPDATE posts
         SET status = 'approved', approved_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND client_id = $2 AND email_link IS NOT NULL`,
        [postId, scope.clientId],
      )
    } else {
      await this.soundtrackRepository.recalculatePostStatus(postId, { includeSoundtrack: false })
    }
    return true
  }

  private async recalculatePostStatus(postId: string) {
    await this.soundtrackRepository.recalculatePostStatus(postId, { includeSoundtrack: false })
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
