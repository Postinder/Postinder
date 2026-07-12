import { query } from '../../../../shared/database/pool'

export class ApprovalsRepository {
  async getClientQueue(clientId: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = [
      'p.client_id = $1',
      "p.status IN ('sent', 'pending_approval')",
      "f.status = 'pending'",
      'p.deleted_at IS NULL',
    ]
    if (companyId) {
      params.push(companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT
         p.id          AS post_id,
         p.title,
         p.description AS caption,
         f.id          AS file_id,
         f.url         AS storage_url,
         f.file_type,
         f.original_name,
         f.sort_order,
         f.created_at  AS file_created_at
       FROM files f
       JOIN posts p ON f.post_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC, COALESCE(f.sort_order, 999999), f.created_at ASC, f.id ASC`,
      params,
    )

    // Group by post
    const postMap = new Map<string, { post: any; files: any[] }>()
    for (const row of result.rows) {
      if (!postMap.has(row.post_id)) {
        postMap.set(row.post_id, {
          post: { id: row.post_id, title: row.title, caption: row.caption, channels: [], formats: {} },
          files: [],
        })
      }
      postMap.get(row.post_id)!.files.push({
        id: row.file_id,
        name: row.original_name || row.storage_url?.split('/').pop() || 'arquivo',
        storage_url: row.storage_url,
        file_type: row.file_type,
        sort_order: row.sort_order,
      })
    }

    // Flatten to queue items (one item per file)
    const queue: any[] = []
    for (const [, { post, files }] of postMap) {
      files.forEach((file, fileIndex) => {
        queue.push({ post, file, fileIndex, totalFiles: files.length, isEmail: false })
      })
    }

    return queue
  }

  private buildScopeConditions(params: any[], scope?: { clientId?: string; companyId?: string }) {
    const conditions = ['p.deleted_at IS NULL', "p.status <> 'executed'"]
    if (scope?.clientId) {
      params.push(scope.clientId)
      conditions.push(`p.client_id = $${params.length}`)
    }
    if (scope?.companyId) {
      params.push(scope.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }
    return conditions
  }

  async approveFile(fileId: string, scope?: { clientId?: string; companyId?: string }) {
    const params: any[] = [fileId]
    const scopeConditions = this.buildScopeConditions(params, scope)
    const fileRes = await query(
      `UPDATE files f
       SET status = 'approved', updated_at = NOW()
       FROM posts p
       WHERE f.post_id = p.id
         AND f.id = $1
         AND f.status = 'pending'
         AND ${scopeConditions.join(' AND ')}
       RETURNING f.post_id`,
      params,
    )
    if (!fileRes.rows[0]) return false

    const postId = fileRes.rows[0].post_id
    const pending = await query(`SELECT id FROM files WHERE post_id = $1 AND status = 'pending'`, [postId])
    if (pending.rows.length === 0) {
      const rejected = await query(`SELECT id FROM files WHERE post_id = $1 AND status = 'rejected' LIMIT 1`, [postId])
      if (rejected.rows.length > 0) {
        await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [postId])
      } else {
        await query(`UPDATE posts SET status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [postId])
      }
    }
    return true
  }

  async rejectFile(fileId: string, tags: string[], comment: string, scope?: { clientId?: string; companyId?: string }) {
    const params: any[] = [fileId, comment || null, tags]
    const scopeConditions = this.buildScopeConditions(params, scope)
    const fileRes = await query(
      `UPDATE files f
       SET status = 'rejected', rejection_reason = $2, rejection_tags = $3, updated_at = NOW()
       FROM posts p
       WHERE f.post_id = p.id
         AND f.id = $1
         AND f.status = 'pending'
         AND ${scopeConditions.join(' AND ')}
       RETURNING f.post_id`,
      params,
    )
    if (fileRes.rows[0]) {
      await query(`UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [fileRes.rows[0].post_id])
      return true
    }
    return false
  }

  async saveFeedback(clientId: string, rating: number, text: string, month: string, companyId?: string) {
    const params: any[] = [clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const client = await query(`SELECT id FROM clients WHERE ${conditions.join(' AND ')}`, params)
    if (!client.rows[0]) return false

    await query(`INSERT INTO feedback (client_id, rating, text, month) VALUES ($1, $2, $3, $4)`, [clientId, rating, text, month])
    return true
  }

  async listMonthlyFeedbacks(filters: { clientId?: string; month?: string; companyId?: string }) {
    const params: any[] = []
    const conditions: string[] = []

    if (filters.clientId) {
      params.push(filters.clientId)
      conditions.push(`f.client_id = $${params.length}`)
    }
    if (filters.month) {
      params.push(filters.month)
      conditions.push(`f.month = $${params.length}`)
    }
    if (filters.companyId) {
      params.push(filters.companyId)
      conditions.push(`c.company_id = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(
      `SELECT
         f.id,
         f.client_id,
         f.post_id,
         f.rating,
         f.text,
         f.month,
         f.created_at,
         p.title AS post_title,
         COALESCE(tag_history.tags, ARRAY[]::text[]) AS tags,
         COALESCE(file_history.files, '[]'::jsonb) AS rejected_files,
         json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'color', c.color) AS client
       FROM feedback f
       JOIN clients c ON c.id = f.client_id
       LEFT JOIN posts p ON p.id = f.post_id
       LEFT JOIN LATERAL (
         SELECT ARRAY(
           SELECT DISTINCT jsonb_array_elements_text(ae.metadata->'tags')
           FROM activity_events ae
           WHERE ae.post_id = f.post_id
             AND ae.type IN ('feedback_sent', 'feedback_updated')
             AND jsonb_typeof(ae.metadata->'tags') = 'array'
         ) AS tags
       ) tag_history ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           jsonb_agg(DISTINCT jsonb_build_object(
             'fileId', ae.metadata->>'fileId',
             'fileName', ae.metadata->>'fileName',
             'tags', COALESCE(ae.metadata->'tags', '[]'::jsonb)
           )),
           '[]'::jsonb
         ) AS files
         FROM activity_events ae
         WHERE ae.post_id = f.post_id
           AND ae.type IN ('feedback_sent', 'feedback_updated')
           AND (
             ae.metadata ? 'fileId'
             OR ae.metadata ? 'fileName'
             OR jsonb_typeof(ae.metadata->'tags') = 'array'
           )
       ) file_history ON true
       ${where}
       ORDER BY f.created_at DESC`,
      params,
    )

    return result.rows
  }

}
