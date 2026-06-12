import { query } from '../../../../shared/database/pool'

export class NotificationRepository {
  async list(filters: { companyId?: string; userId: string }) {
    const params: any[] = [filters.userId]
    const conditions = [
      'p.deleted_at IS NULL',
      `(
        p.status IN ('sent', 'pending_approval', 'rejected')
        OR EXISTS (
          SELECT 1
          FROM files f_status
          WHERE f_status.post_id = p.id
            AND LOWER(COALESCE(f_status.status, 'pending')) IN ('pending', 'pending_approval', 'sent', 'rejected')
        )
      )`,
    ]

    if (filters.companyId) {
      params.push(filters.companyId)
      conditions.push(`(p.company_id = $${params.length} OR p.company_id IS NULL)`)
    }

    const result = await query(
      `WITH post_review_state AS (
         SELECT
           p.id,
           p.client_id,
           p.title,
           p.status,
           p.updated_at,
           p.submitted_at,
           c.name AS client_name,
           COUNT(f.id) FILTER (WHERE LOWER(COALESCE(f.status, 'pending')) IN ('pending', 'pending_approval', 'sent')) AS pending_files,
           COUNT(f.id) FILTER (WHERE LOWER(COALESCE(f.status, '')) = 'rejected') AS rejected_files,
           MAX(f.updated_at) FILTER (WHERE LOWER(COALESCE(f.status, '')) = 'rejected') AS last_rejected_at
         FROM posts p
         LEFT JOIN clients c ON c.id = p.client_id
         LEFT JOIN files f ON f.post_id = p.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY p.id, c.name
       )
       SELECT
         CASE
           WHEN prs.rejected_files > 0 THEN 'rejected-' || prs.id::text
           WHEN prs.status = 'pending_approval' THEN 'correction-' || prs.id::text
           ELSE 'pending-' || prs.id::text
         END AS id,
         CASE
           WHEN prs.rejected_files > 0 THEN 'rejected'
           WHEN prs.status = 'pending_approval' THEN 'correction'
           ELSE 'pending'
         END AS type,
         CASE
           WHEN prs.rejected_files > 0 THEN 'Postagem recusada'
           WHEN prs.status = 'pending_approval' THEN 'Correção enviada'
           ELSE 'Aguardando aprovação'
         END AS title,
         CASE
           WHEN prs.rejected_files > 0 THEN COALESCE(prs.client_name, 'Cliente') || ' solicitou ajustes em "' || COALESCE(prs.title, 'sem título') || '".'
           WHEN prs.status = 'pending_approval' THEN '"' || COALESCE(prs.title, 'Postagem sem título') || '" voltou para análise após correção.'
           ELSE '"' || COALESCE(prs.title, 'Postagem sem título') || '" está aguardando retorno do cliente.'
         END AS message,
         COALESCE(prs.last_rejected_at, prs.updated_at, prs.submitted_at) AS date,
         prs.id AS post_id,
         prs.client_id,
         prs.title AS post_title,
         prs.client_name,
         nr.read_at
       FROM post_review_state prs
       LEFT JOIN notification_reads nr
         ON nr.notification_id = CASE
           WHEN prs.rejected_files > 0 THEN 'rejected-' || prs.id::text
           WHEN prs.status = 'pending_approval' THEN 'correction-' || prs.id::text
           ELSE 'pending-' || prs.id::text
         END
        AND nr.user_id = $1
       WHERE prs.rejected_files > 0
          OR prs.pending_files > 0
          OR prs.status IN ('sent', 'pending_approval', 'rejected')
       ORDER BY COALESCE(prs.last_rejected_at, prs.updated_at, prs.submitted_at) DESC`,
      params,
    )

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      date: row.date,
      read: Boolean(row.read_at),
      readAt: row.read_at,
      post: {
        id: row.post_id,
        title: row.post_title,
        client_id: row.client_id,
        clientId: row.client_id,
      },
      client: row.client_id ? {
        id: row.client_id,
        name: row.client_name,
      } : null,
    }))
  }

  async markAsRead(data: { companyId?: string; userId: string; notificationIds: string[] }) {
    const ids = Array.from(new Set(data.notificationIds.filter(Boolean)))
    if (!ids.length) return []

    const result = await query(
      `INSERT INTO notification_reads (company_id, user_id, notification_id, read_at)
       SELECT $1, $2, unnest($3::text[]), NOW()
       ON CONFLICT (user_id, notification_id)
       DO UPDATE SET read_at = EXCLUDED.read_at, company_id = EXCLUDED.company_id
       RETURNING notification_id, read_at`,
      [data.companyId || null, data.userId, ids],
    )

    return result.rows
  }

  async markAllAsRead(data: { companyId?: string; userId: string }) {
    const notifications = await this.list(data)
    return this.markAsRead({
      companyId: data.companyId,
      userId: data.userId,
      notificationIds: notifications.map(notification => notification.id),
    })
  }
}
