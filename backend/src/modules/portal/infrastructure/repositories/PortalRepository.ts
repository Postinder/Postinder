import crypto from 'crypto'
import { pool, query } from '../../../../shared/database/pool'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { decryptPortalToken, encryptPortalToken } from '../portalTokenCipher'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'
import { resolvePortalSettings } from '../../../platformSettings/domain/PlatformSettings'

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
  const funnelTag = typeof row.portal_funnel_tag === 'string' && row.portal_funnel_tag.trim()
    ? row.portal_funnel_tag.trim()
    : null
  const itemReviewSnapshot = Array.isArray(row.item_review_snapshot) ? row.item_review_snapshot : []
  const positiveReaction = row.positive_reaction === 'loved' ? 'loved' : null
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
    contentRevision: Number(row.content_revision || 0),
    content_revision: Number(row.content_revision || 0),
    approvedRevision: row.approved_revision === null ? null : Number(row.approved_revision),
    approved_revision: row.approved_revision === null ? null : Number(row.approved_revision),
    positiveReaction,
    positive_reaction: positiveReaction,
    itemReviewSnapshot,
    item_review_snapshot: itemReviewSnapshot,
    hasPositiveReaction: positiveReaction === 'loved'
      || itemReviewSnapshot.some((item: any) => item?.positiveReaction === 'loved' || item?.positive_reaction === 'loved'),
    emailLink: normalizePortalEmailLink(row.email_link),
    ...(funnelTag ? { funnelTag, funnel_tag: funnelTag } : {}),
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

export function isCanonicalReviewDecisionCurrent(
  post: any,
  completed: any,
  contentRevision: number,
) {
  if (!completed) return false
  if (completed.decision === 'approved') {
    return ['approved', 'executed'].includes(String(post.status).toLowerCase())
      && Number(post.approved_revision) === contentRevision
  }
  if (completed.decision === 'rejected') {
    if (String(post.status).toLowerCase() !== 'rejected' || !completed.completed_at) return false
    return new Date(post.updated_at).getTime() <= new Date(completed.completed_at).getTime()
  }
  return false
}

const pendingFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent')"
const approvableFileStatusSql = "LOWER(COALESCE(NULLIF(f.status, ''), 'pending')) IN ('pending', 'pending_approval', 'sent', 'rejected')"
const clientVisiblePostStatusSql = `(
  LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval', 'rejected', 'approved', 'executed')
  AND (
    LOWER(COALESCE(p.status, '')) <> 'rejected'
    OR NOT EXISTS (
      SELECT 1
      FROM portal_post_reviews visible_review
      WHERE visible_review.post_id = p.id
        AND visible_review.completed_at IS NOT NULL
        AND p.updated_at > visible_review.completed_at
    )
  )
)`
const clientReviewablePostStatusSql = "LOWER(COALESCE(p.status, '')) IN ('sent', 'pending_approval')"

export class PortalRepository {
  private readonly soundtrackRepository = new SoundtrackRepository()
  constructor(private readonly settingsService = new PlatformSettingsService()) {}

  private portalMode(row: any) {
    return row.portal_mode_override
      || (row.portal_detailed_view === true ? 'detailed' : null)
  }

  async getClient(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT id, name, email, whatsapp, segment, color, deadline_days,
         portal_detailed_view, portal_mode_override
       FROM clients
       WHERE ${conditions.join(' AND ')}`,
      params,
    )

    const row = result.rows[0]
    if (!row) return null
    const settings = await this.settingsService.get()
    const portalModeOverride = this.portalMode(row)
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      whatsapp: row.whatsapp,
      segment: row.segment,
      color: row.color,
      deadlineDays: row.deadline_days,
      portalDetailedView: portalModeOverride === 'detailed',
      portalModeOverride,
      portalSettings: resolvePortalSettings(settings.portal, portalModeOverride),
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
         ,c.portal_mode_override
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

    const settings = await this.settingsService.get()
    const portalModeOverride = this.portalMode(row)
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
        portalDetailedView: portalModeOverride === 'detailed',
        portalModeOverride,
        portalSettings: resolvePortalSettings(settings.portal, portalModeOverride),
      },
    }
  }

  async listPosts(clientId: string, companyId?: string) {
    const settings = await this.settingsService.get()
    const params: any[] = [clientId]
    const conditions = ['p.client_id = $1', 'p.deleted_at IS NULL', clientVisiblePostStatusSql]
    if (companyId) {
      params.push(companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
       `SELECT
         p.*,
          (
            SELECT decision.positive_reaction
            FROM portal_review_decisions decision
            WHERE decision.post_id = p.id
              AND decision.content_revision = p.content_revision
              AND LOWER(p.status) IN ('approved', 'executed')
              AND p.approved_revision = p.content_revision
            ORDER BY decision.review_sequence DESC
            LIMIT 1
          ) AS positive_reaction,
          COALESCE((
            SELECT decision.item_snapshot
            FROM portal_review_decisions decision
            WHERE decision.post_id = p.id
              AND decision.content_revision = p.content_revision
              AND LOWER(p.status) IN ('approved', 'executed')
              AND p.approved_revision = p.content_revision
            ORDER BY decision.review_sequence DESC
            LIMIT 1
          ), '[]'::jsonb) AS item_review_snapshot,
         CASE
           WHEN COALESCE((p.review_field_visibility->>'funnel_tag')::boolean, FALSE)
             THEN p.funnel_tag
           ELSE NULL
         END AS portal_funnel_tag,
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
                'review_decision', d.decision,
                'review_positive_reaction', d.positive_reaction,
               'review_reason', d.rejection_reason,
               'review_tags', d.rejection_tags,
               'review_updated_at', d.updated_at,
               'created_at', f.created_at,
               'updated_at', f.updated_at,
               'storage_deleted_at', f.storage_deleted_at
             ) ORDER BY COALESCE(f.sort_order, 999999), f.created_at, f.id
           ) FILTER (WHERE f.id IS NOT NULL),
           '[]'
         ) AS files
       FROM posts p
       LEFT JOIN files f ON f.post_id = p.id
        LEFT JOIN portal_item_review_drafts d
          ON d.post_id = p.id
         AND d.file_id = f.id
         AND d.content_revision = p.content_revision
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id
       ORDER BY p.scheduled_date ASC NULLS LAST, p.created_at ASC, p.id ASC`,
      params,
    )

    const posts = result.rows.map(normalizePost)
    const soundtracks = settings.features.soundtrack
      ? await this.soundtrackRepository.findByPostIds(posts.map(post => post.id))
      : new Map<string, any>()
    posts.forEach(post => {
      ;(post as any).soundtrack = soundtracks.get(post.id) || null
      ;(post as any).soundtrackMode = (post as any).soundtrack?.mode || 'none'
    })
    return posts.sort(comparePortalQueueItems)
  }

  private async saveOfficialReview(
    client: any,
    postId: string,
    contentRevision: number,
    status: 'approved' | 'rejected',
    approvalMode: 'content' | 'item',
    reviewer: { clientId: string; actorRole: string },
    resetRewind: boolean,
    positiveReaction: 'loved' | null = null,
    itemSnapshot: any[] = [],
  ) {
    const review = await client.query(
      `INSERT INTO portal_post_reviews (
         post_id, revision, completed_status, completed_at, rewind_used, updated_at
       ) VALUES ($1, 1, $2, NOW(), FALSE, NOW())
       ON CONFLICT (post_id) DO UPDATE SET
         revision = portal_post_reviews.revision + 1,
         completed_status = EXCLUDED.completed_status,
         completed_at = NOW(),
         rewind_used = CASE WHEN $3 THEN FALSE ELSE portal_post_reviews.rewind_used END,
         updated_at = NOW()
       RETURNING revision`,
      [postId, status, resetRewind],
    )
    const decision = await client.query(
      `INSERT INTO portal_review_decisions (
         post_id, content_revision, review_sequence, decision, approval_mode, client_id, actor_role,
         positive_reaction, item_snapshot
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id`,
      [
        postId,
        contentRevision,
        review.rows[0].revision,
        status,
        approvalMode,
        reviewer.clientId,
        reviewer.actorRole,
        positiveReaction,
        JSON.stringify(itemSnapshot),
      ],
    )
    return decision.rows[0]
  }

  private async completeContentReview(
    postId: string,
    decision: 'approved' | 'rejected',
    comment: string | null,
    tags: string[],
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
    actorRole = 'client',
    positiveReaction: 'loved' | null = null,
  ) {
    const settings = await this.settingsService.get()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, scope.clientId]
      const conditions = ['id = $1', 'client_id = $2', 'deleted_at IS NULL']
      if (scope.companyId) {
        params.push(scope.companyId)
        conditions.push(`company_id = $${params.length}`)
      }
      const postResult = await client.query(
         `SELECT id, status, email_link, content_revision, approved_revision, updated_at FROM posts
         WHERE ${conditions.join(' AND ')}
         FOR UPDATE`,
        params,
      )
      const post = postResult.rows[0]
      if (!post) {
        await client.query('ROLLBACK')
        return { kind: 'not_found' as const }
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision <= 0
        || Number(post.content_revision) !== expectedRevision) {
        await client.query('ROLLBACK')
        return { kind: 'revision_conflict' as const, currentRevision: Number(post.content_revision || 0) }
      }
      if (!['sent', 'pending_approval'].includes(String(post.status).toLowerCase())) {
        const completed = await client.query(
          `SELECT d.decision, d.positive_reaction, r.completed_at
           FROM portal_review_decisions d
           LEFT JOIN portal_post_reviews r ON r.post_id = d.post_id
           WHERE d.post_id = $1 AND d.content_revision = $2
           ORDER BY d.review_sequence DESC LIMIT 1`,
          [postId, expectedRevision],
        )
        await client.query('ROLLBACK')
        if (!isCanonicalReviewDecisionCurrent(post, completed.rows[0], expectedRevision)) {
          return { kind: 'revision_conflict' as const, currentRevision: Number(post.content_revision || 0) }
        }
        if (completed.rows[0].decision === decision
          && (decision !== 'approved' || (completed.rows[0].positive_reaction || null) === positiveReaction)) {
          return {
            kind: 'already_completed' as const,
            status: completed.rows[0].decision,
            positiveReaction: completed.rows[0].positive_reaction || null,
          }
        }
        return completed.rows[0]
          ? { kind: 'decision_conflict' as const, status: completed.rows[0].decision }
          : { kind: 'revision_conflict' as const, currentRevision: Number(post.content_revision || 0) }
      }
      const fileState = await client.query(
        `SELECT id, status FROM files WHERE post_id = $1 ORDER BY COALESCE(sort_order, 999999), created_at, id`,
        [postId],
      )
      if (settings.portal.approval_mode === 'item' && fileState.rows.length) {
        await client.query('ROLLBACK')
        return { kind: 'wrong_mode' as const }
      }
      if (decision === 'approved' && settings.features.soundtrack) {
        const soundtrack = await client.query(
          `SELECT approval_status, approved_content_revision FROM post_soundtracks
           WHERE post_id = $1 AND deleted_at IS NULL AND mode <> 'none'
           FOR UPDATE`,
          [postId],
        )
        if (soundtrack.rows[0]
          && (soundtrack.rows[0].approval_status !== 'approved'
            || Number(soundtrack.rows[0].approved_content_revision) !== expectedRevision)) {
          await client.query('ROLLBACK')
          return { kind: 'soundtrack_incomplete' as const }
        }
      }
      const startsNewCycle = fileState.rows.some((file: any) => ['pending', 'pending_approval', 'sent'].includes(String(file.status).toLowerCase()))
      await client.query(
        `UPDATE files
         SET status = $2::text,
             rejection_reason = CASE WHEN $2::text = 'rejected' THEN $3::text ELSE NULL END,
             rejection_tags = CASE WHEN $2::text = 'rejected' THEN $4::text[] ELSE NULL END,
             updated_at = NOW()
         WHERE post_id = $1`,
        [postId, decision, comment, tags],
      )
      await client.query(
         `UPDATE posts
          SET status = $2::text,
              approved_revision = CASE WHEN $2::text = 'approved' THEN content_revision ELSE NULL END,
              approved_at = CASE WHEN $2::text = 'approved' THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $1`,
        [postId, decision],
      )
      await client.query('DELETE FROM portal_item_review_drafts WHERE post_id = $1', [postId])
      if (decision === 'rejected') {
        await client.query(
          `INSERT INTO feedback (client_id, post_id, text, month)
           VALUES ($1, $2, $3, TO_CHAR(NOW(), 'YYYY-MM'))`,
          [scope.clientId, postId, comment],
        )
      }
      await this.saveOfficialReview(
        client, postId, expectedRevision, decision, 'content',
        { clientId: scope.clientId, actorRole }, startsNewCycle, positiveReaction,
      )
      await client.query('COMMIT')
      return { kind: 'completed' as const, status: decision, positiveReaction, snapshot: [] }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async approvePost(
    postId: string,
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
    actorRole = 'client',
    positiveReaction: 'loved' | null = null,
  ) {
    return this.completeContentReview(postId, 'approved', null, [], scope, expectedRevision, actorRole, positiveReaction)
  }

  private async recalculatePostStatus(postId: string) {
    const settings = await this.settingsService.get()
    await this.soundtrackRepository.recalculatePostStatus(postId, {
      includeSoundtrack: settings.features.soundtrack,
    })
  }

  async approveFile(fileId: string, scope: { clientId: string; companyId?: string }) {
    // Kept only for compatibility with old clients. New portal flows use saveItemDecision,
    // which cannot mutate canonical state or create business side effects.
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

  async rejectPost(
    postId: string,
    comment: string,
    tags: string[],
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
    actorRole = 'client',
  ) {
    return this.completeContentReview(postId, 'rejected', comment, tags, scope, expectedRevision, actorRole)
  }

  async saveItemDecision(
    postId: string,
    fileId: string,
    input: { decision: 'approved' | 'rejected'; comment?: string; tags?: string[]; positiveReaction?: 'loved' | null },
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
  ) {
    const settings = await this.settingsService.get()
    if (settings.portal.approval_mode !== 'item') return { kind: 'wrong_mode' as const }
    const comment = String(input.comment || '').trim()
    if (input.decision === 'rejected' && !comment) return { kind: 'comment_required' as const }
    const positiveReaction = input.positiveReaction === 'loved' ? 'loved' : null
    const tags = Array.isArray(input.tags) ? input.tags : []
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, fileId, scope.clientId]
      const conditions = ['p.id = $1', 'f.id = $2', 'p.client_id = $3', 'p.deleted_at IS NULL']
      if (scope.companyId) {
        params.push(scope.companyId)
        conditions.push(`p.company_id = $${params.length}`)
      }
      const file = await client.query(
        `SELECT f.id, p.status, p.content_revision FROM files f JOIN posts p ON p.id = f.post_id
         WHERE ${conditions.join(' AND ')}
         FOR UPDATE OF p, f`,
        params,
      )
      if (!file.rows[0]) {
        await client.query('ROLLBACK')
        return { kind: 'not_found' as const }
      }
      const currentRevision = Number(file.rows[0].content_revision || 0)
      if (!Number.isInteger(expectedRevision) || expectedRevision <= 0 || currentRevision !== expectedRevision) {
        await client.query('ROLLBACK')
        return { kind: 'revision_conflict' as const, currentRevision }
      }
      if (!['sent', 'pending_approval'].includes(String(file.rows[0].status).toLowerCase())) {
        await client.query('ROLLBACK')
        return { kind: 'revision_conflict' as const, currentRevision }
      }
      const saved = await client.query(
         `INSERT INTO portal_item_review_drafts (
            post_id, file_id, content_revision, decision, positive_reaction,
            rejection_reason, rejection_tags, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (post_id, file_id) DO UPDATE SET
            content_revision = EXCLUDED.content_revision,
            decision = EXCLUDED.decision,
            positive_reaction = EXCLUDED.positive_reaction,
            rejection_reason = EXCLUDED.rejection_reason,
            rejection_tags = EXCLUDED.rejection_tags,
            updated_at = NOW()
          RETURNING content_revision, decision, positive_reaction, rejection_reason, rejection_tags, updated_at`,
        [
          postId,
          fileId,
          expectedRevision,
          input.decision,
          input.decision === 'approved' ? positiveReaction : null,
          input.decision === 'rejected' ? comment : null,
          input.decision === 'rejected' ? tags : [],
        ],
      )
      await client.query('COMMIT')
      return { kind: 'saved' as const, draft: saved.rows[0] }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async completeItemReview(
    postId: string,
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
    actorRole = 'client',
  ) {
    const settings = await this.settingsService.get()
    if (settings.portal.approval_mode !== 'item') return { kind: 'wrong_mode' as const }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, scope.clientId]
      const conditions = ['id = $1', 'client_id = $2', 'deleted_at IS NULL']
      if (scope.companyId) {
        params.push(scope.companyId)
        conditions.push(`company_id = $${params.length}`)
      }
      const postResult = await client.query(
        `SELECT id, status, content_revision, approved_revision, updated_at
         FROM posts WHERE ${conditions.join(' AND ')} FOR UPDATE`,
        params,
      )
      const post = postResult.rows[0]
      if (!post) {
        await client.query('ROLLBACK')
        return { kind: 'not_found' as const }
      }
      const currentRevision = Number(post.content_revision || 0)
      if (!Number.isInteger(expectedRevision) || expectedRevision <= 0 || currentRevision !== expectedRevision) {
        await client.query('ROLLBACK')
        return { kind: 'revision_conflict' as const, currentRevision }
      }
      if (!['sent', 'pending_approval'].includes(String(post.status).toLowerCase())) {
        const completed = await client.query(
          `SELECT d.decision, r.completed_at
           FROM portal_review_decisions d
           LEFT JOIN portal_post_reviews r ON r.post_id = d.post_id
           WHERE d.post_id = $1 AND d.content_revision = $2
           ORDER BY d.review_sequence DESC LIMIT 1`,
          [postId, expectedRevision],
        )
        await client.query('ROLLBACK')
        return isCanonicalReviewDecisionCurrent(post, completed.rows[0], expectedRevision)
          ? { kind: 'already_completed' as const, status: completed.rows[0].decision }
          : { kind: 'revision_conflict' as const, currentRevision }
      }
      const snapshotResult = await client.query(
        `SELECT f.id AS file_id, f.sort_order, f.status AS canonical_status,
                 d.decision, d.positive_reaction, d.rejection_reason, d.rejection_tags
         FROM files f
          LEFT JOIN portal_item_review_drafts d
            ON d.post_id = f.post_id
           AND d.file_id = f.id
           AND d.content_revision = $2
          WHERE f.post_id = $1
         ORDER BY COALESCE(f.sort_order, 999999), f.created_at, f.id
         FOR UPDATE OF f`,
        [postId, expectedRevision],
      )
      const snapshot = snapshotResult.rows
      if (!snapshot.length || snapshot.some((item: any) => !['approved', 'rejected'].includes(item.decision))) {
        await client.query('ROLLBACK')
        return { kind: 'incomplete' as const }
      }
      const startsNewCycle = snapshot.some((item: any) => ['pending', 'pending_approval', 'sent'].includes(String(item.canonical_status).toLowerCase()))
      const mediaStatus: 'approved' | 'rejected' = snapshot.some((item: any) => item.decision === 'rejected') ? 'rejected' : 'approved'
      let soundtrackStatus: string | null = null
      let soundtrackApprovedRevision: number | null = null
      let soundtrackDecisionRevision: number | null = null
      if (settings.features.soundtrack) {
        const soundtrack = await client.query(
          `SELECT ps.approval_status, ps.approved_content_revision,
                  (SELECT d.content_revision
                   FROM post_soundtrack_decisions d
                   WHERE d.soundtrack_id = ps.id
                   ORDER BY d.created_at DESC, d.id DESC
                   LIMIT 1) AS decision_content_revision
           FROM post_soundtracks ps
           WHERE ps.post_id = $1 AND ps.deleted_at IS NULL AND ps.mode <> 'none'
           LIMIT 1`,
          [postId],
        )
        soundtrackStatus = soundtrack.rows[0]?.approval_status || null
        soundtrackApprovedRevision = soundtrack.rows[0]?.approved_content_revision == null
          ? null
          : Number(soundtrack.rows[0].approved_content_revision)
        soundtrackDecisionRevision = soundtrack.rows[0]?.decision_content_revision == null
          ? null
          : Number(soundtrack.rows[0].decision_content_revision)
      }
      const soundtrackIsCurrent = soundtrackStatus === 'approved'
        ? soundtrackApprovedRevision === expectedRevision
        : soundtrackStatus === 'adjustment_requested'
          ? soundtrackDecisionRevision === expectedRevision
          : !soundtrackStatus
      if (mediaStatus === 'approved' && !soundtrackIsCurrent) {
        await client.query('ROLLBACK')
        return { kind: 'soundtrack_incomplete' as const }
      }
      const status: 'approved' | 'rejected' = mediaStatus === 'rejected' || soundtrackStatus === 'adjustment_requested'
        ? 'rejected'
        : 'approved'
      await client.query(
        `UPDATE files f
         SET status = d.decision,
             rejection_reason = CASE WHEN d.decision = 'rejected' THEN d.rejection_reason ELSE NULL END,
             rejection_tags = CASE WHEN d.decision = 'rejected' THEN d.rejection_tags ELSE NULL END,
             updated_at = NOW()
         FROM portal_item_review_drafts d
          WHERE f.post_id = $1
            AND d.post_id = f.post_id
            AND d.file_id = f.id
            AND d.content_revision = $2`,
        [postId, expectedRevision],
      )
      await client.query(
        `UPDATE posts
          SET status = $2::text,
              approved_revision = CASE WHEN $2::text = 'approved' THEN content_revision ELSE NULL END,
              approved_at = CASE WHEN $2::text = 'approved' THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $1`,
        [postId, status],
      )
      if (status === 'rejected') {
        const summary = snapshot
          .filter((item: any) => item.decision === 'rejected')
          .map((item: any, index: number) => `Item ${item.sort_order || index + 1}: ${item.rejection_reason}`)
          .join('\n')
        await client.query(
          `INSERT INTO feedback (client_id, post_id, text, month)
           VALUES ($1, $2, $3, TO_CHAR(NOW(), 'YYYY-MM'))`,
          [scope.clientId, postId, summary],
        )
      }
      const officialSnapshot = snapshot.map((item: any) => ({
        fileId: item.file_id,
        decision: item.decision,
        positiveReaction: item.decision === 'approved' && item.positive_reaction === 'loved' ? 'loved' : null,
        comment: item.decision === 'rejected' ? item.rejection_reason : null,
        tags: item.decision === 'rejected' ? item.rejection_tags || [] : [],
      }))
      await this.saveOfficialReview(
        client, postId, expectedRevision, status, 'item',
        { clientId: scope.clientId, actorRole }, startsNewCycle, null, officialSnapshot,
      )
      await client.query('COMMIT')
      return {
        kind: 'completed' as const,
        status,
        snapshot: officialSnapshot,
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async reopenPost(
    postId: string,
    scope: { clientId: string; companyId?: string },
    expectedRevision: number,
    actorRole = 'client',
  ) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const params: any[] = [postId, scope.clientId]
      const company = scope.companyId ? 'AND p.company_id = $3' : ''
      if (scope.companyId) params.push(scope.companyId)
      const result = await client.query(
        `SELECT p.id, p.status, p.content_revision, r.completed_at, COALESCE(r.rewind_used, FALSE) AS rewind_used
         FROM posts p
         LEFT JOIN portal_post_reviews r ON r.post_id = p.id
         WHERE p.id = $1 AND p.client_id = $2 ${company}
           AND p.deleted_at IS NULL
            AND p.status IN ('approved', 'rejected')
            AND r.completed_at IS NOT NULL
            AND p.updated_at <= r.completed_at
            AND COALESCE(r.rewind_used, FALSE) = FALSE
           AND COALESCE(r.completed_at, p.updated_at) = (
             SELECT MAX(COALESCE(r2.completed_at, p2.updated_at))
             FROM posts p2
             LEFT JOIN portal_post_reviews r2 ON r2.post_id = p2.id
             WHERE p2.client_id = p.client_id
               AND p2.deleted_at IS NULL
               AND p2.status IN ('approved', 'rejected')
           )
         FOR UPDATE OF p`,
        params,
      )
      if (!result.rows[0]) {
        await client.query('ROLLBACK')
        return false
      }
      const currentRevision = Number(result.rows[0].content_revision || 0)
      if (!Number.isInteger(expectedRevision) || expectedRevision <= 0 || currentRevision !== expectedRevision) {
        await client.query('ROLLBACK')
        return { kind: 'revision_conflict' as const, currentRevision }
      }
      const previousDecision = await client.query(
        `SELECT id FROM portal_review_decisions
         WHERE post_id = $1 AND content_revision = $2
         ORDER BY review_sequence DESC LIMIT 1`,
        [postId, expectedRevision],
      )
      await client.query(
        `INSERT INTO portal_post_reviews (
           post_id, revision, completed_status, completed_at, rewind_used, updated_at
         ) VALUES ($1, 0, $2, COALESCE($3, NOW()), TRUE, NOW())
         ON CONFLICT (post_id) DO UPDATE SET rewind_used = TRUE, updated_at = NOW()`,
        [postId, result.rows[0].status, result.rows[0].completed_at],
      )
      await client.query(
        `UPDATE posts
         SET status = 'pending_approval', approved_revision = NULL, approved_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [postId],
      )
      await client.query('DELETE FROM portal_item_review_drafts WHERE post_id = $1', [postId])
      await client.query(
        `UPDATE post_soundtracks
         SET approval_status = 'pending', approved_content_revision = NULL, approved_at = NULL,
             adjustment_requested_at = NULL, adjustment_comment = NULL, updated_at = NOW()
         WHERE post_id = $1 AND deleted_at IS NULL AND mode <> 'none'`,
        [postId],
      )
      await client.query(
        `INSERT INTO portal_review_actions (
           post_id, content_revision, action, actor_id, actor_role, decision_id
         ) VALUES ($1, $2, 'client_rewind', $3, $4, $5)`,
        [postId, expectedRevision, scope.clientId, actorRole, previousDecision.rows[0]?.id || null],
      )
      await client.query('COMMIT')
      return { kind: 'reopened' as const }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
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
