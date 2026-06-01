import { query } from '../../../../shared/database/pool'

type ActivityInput = {
  companyId?: string
  clientId?: string
  postId?: string
  actorId?: string
  actorRole?: string
  type: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
}

export class ActivityRepository {
  async create(data: ActivityInput) {
    const result = await query(
      `INSERT INTO activity_events (
         company_id, client_id, post_id, actor_id, actor_role, type, title, description, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.companyId || null,
        data.clientId || null,
        data.postId || null,
        data.actorId || null,
        data.actorRole || null,
        data.type,
        data.title,
        data.description || null,
        JSON.stringify(data.metadata || {}),
      ],
    )

    return result.rows[0]
  }

  async createForClient(clientId: string, data: Omit<ActivityInput, 'clientId'>) {
    const params: any[] = [clientId]
    const conditions = ['id = $1']
    if (data.companyId) {
      params.push(data.companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const client = await query(
      `SELECT id, name FROM clients WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!client.rows[0]) return null

    return this.create({
      ...data,
      clientId,
      description: data.description || client.rows[0].name,
      metadata: { clientName: client.rows[0].name, ...(data.metadata || {}) },
    })
  }

  async createForPost(postId: string, data: Omit<ActivityInput, 'postId' | 'clientId'>) {
    const params: any[] = [postId]
    const conditions = ['p.id = $1', 'p.deleted_at IS NULL']
    if (data.companyId) {
      params.push(data.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const post = await query(
      `SELECT p.id, p.title, p.client_id, c.name AS client_name
       FROM posts p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!post.rows[0]) return null

    const row = post.rows[0]
    const postTitle = row.title || 'Post sem título'
    const description = data.description || `${postTitle}${row.client_name ? ` · ${row.client_name}` : ''}`

    return this.create({
      ...data,
      postId,
      clientId: row.client_id,
      description,
      metadata: {
        postTitle,
        clientName: row.client_name,
        ...(data.metadata || {}),
      },
    })
  }

  async createForFile(fileId: string, data: Omit<ActivityInput, 'postId' | 'clientId'>) {
    const params: any[] = [fileId]
    const conditions = ['f.id = $1', 'p.deleted_at IS NULL']
    if (data.companyId) {
      params.push(data.companyId)
      conditions.push(`p.company_id = $${params.length}`)
    }

    const file = await query(
      `SELECT f.id, f.post_id, f.original_name, p.title, p.client_id, c.name AS client_name
       FROM files f
       JOIN posts p ON p.id = f.post_id
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE ${conditions.join(' AND ')}`,
      params,
    )
    if (!file.rows[0]) return null

    const row = file.rows[0]
    const postTitle = row.title || 'Post sem título'

    return this.create({
      ...data,
      postId: row.post_id,
      clientId: row.client_id,
      description: data.description || `${postTitle}${row.client_name ? ` · ${row.client_name}` : ''}`,
      metadata: {
        postTitle,
        clientName: row.client_name,
        fileName: row.original_name,
        ...(data.metadata || {}),
      },
    })
  }

  async list(filters: { companyId?: string; clientId?: string; limit?: number }) {
    const params: any[] = []
    const conditions: string[] = []

    if (filters.companyId) {
      params.push(filters.companyId)
      conditions.push(`company_id = $${params.length}`)
    }
    if (filters.clientId) {
      params.push(filters.clientId)
      conditions.push(`client_id = $${params.length}`)
    }

    params.push(Math.min(Math.max(filters.limit || 20, 1), 50))
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(
      `SELECT *
       FROM activity_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    )

    return result.rows
  }
}
