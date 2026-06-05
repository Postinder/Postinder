import { query } from '../../../../shared/database/pool'

export class NotificationRepository {
  async list(filters: { companyId?: string; userId: string }) {
    const params: any[] = [filters.userId]
    const conditions = ['p.deleted_at IS NULL', "p.status IN ('pending_approval', 'rejected')"]

    if (filters.companyId) {
      params.push(filters.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT
         CASE
           WHEN p.status = 'rejected' THEN 'rejected-' || p.id::text
           ELSE 'pending-' || p.id::text
         END AS id,
         CASE
           WHEN p.status = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END AS type,
         CASE
           WHEN p.status = 'rejected' THEN 'Postagem recusada'
           ELSE 'Aguardando aprovação'
         END AS title,
         CASE
           WHEN p.status = 'rejected' THEN COALESCE(c.name, 'Cliente') || ' solicitou ajustes em "' || COALESCE(p.title, 'sem título') || '".'
           ELSE '"' || COALESCE(p.title, 'Postagem sem título') || '" está aguardando retorno do cliente.'
         END AS message,
         p.updated_at AS date,
         p.id AS post_id,
         p.client_id,
         p.title AS post_title,
         c.name AS client_name,
         nr.read_at
       FROM posts p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN notification_reads nr
         ON nr.notification_id = CASE
           WHEN p.status = 'rejected' THEN 'rejected-' || p.id::text
           ELSE 'pending-' || p.id::text
         END
        AND nr.user_id = $1
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.updated_at DESC`,
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
