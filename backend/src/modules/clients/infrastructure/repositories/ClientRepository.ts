import { pool, query } from '../../../../shared/database/pool'
import { assertActiveEmailAvailable, isEmailConflict, normalizeEmail } from '../../../../shared/database/emailUniqueness'
import { logger } from '../../../../shared/utils/Logger'
import { removeStoredFile } from '../../../../shared/upload/storage'

export interface CreateClientDTO {
  name: string
  email: string
  password_hash: string
  whatsapp?: string
  segment?: string
  color?: string
  deadline_days?: number
  company_id?: string
}

export interface UpdateClientDTO {
  name?: string
  whatsapp?: string
  segment?: string
  color?: string
  deadline_days?: number
}

export class ClientRepository {
  async create(dto: CreateClientDTO) {
    const email = normalizeEmail(dto.email)
    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      await assertActiveEmailAvailable(client, email)
      const result = await client.query(
        `INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id, name, email, whatsapp, segment, color, deadline_days, created_at`,
        [
          dto.name,
          email,
          dto.password_hash,
          dto.whatsapp || null,
          dto.segment || null,
          dto.color || null,
          dto.deadline_days || 7,
          dto.company_id || null,
        ]
      )
      await client.query('COMMIT')
      return result.rows[0]
    } catch (error: any) {
      if (transactionStarted) await client.query('ROLLBACK')
      if (isEmailConflict(error)) {
        throw new Error('Email already exists')
      }
      logger.error('Failed to create client', { error })
      throw new Error('Failed to create client')
    } finally {
      client.release()
    }
  }

  async findById(id: string, companyId?: string) {
    try {
      const params: any[] = [id]
      let sql = `
        SELECT
          c.id,
          c.name,
          c.email,
          c.whatsapp,
          c.segment,
          c.color,
          c.deadline_days,
          c.company_id,
          c.is_active,
          COALESCE(c.last_access_at, MAX(t.last_used_at)) AS last_access_at,
          c.created_at,
          c.updated_at
        FROM clients c
        LEFT JOIN client_portal_tokens t ON t.client_id = c.id
        WHERE c.id = $1`
      if (companyId) {
        params.push(companyId)
        sql += ` AND c.company_id = $${params.length}`
      }
      sql += ` GROUP BY c.id`
      const result = await query(
        sql,
        params,
      )
      return result.rows[0] || null
    } catch (error) {
      logger.error('Failed to find client', { error })
      return null
    }
  }

  async findNotificationTarget(id: string, companyId?: string) {
    try {
      const params: any[] = [id]
      const conditions = ['c.id = $1', 'c.is_active = true']

      if (companyId) {
        params.push(companyId)
        conditions.push(`c.company_id = $${params.length}`)
      }

      const result = await query(
        `SELECT
           c.id,
           c.name,
           c.email,
           c.whatsapp
         FROM clients c
         WHERE ${conditions.join(' AND ')}`,
        params,
      )

      return result.rows[0] || null
    } catch (error) {
      logger.error('Failed to find client notification target', { error })
      return null
    }
  }

  async findByEmail(email: string) {
    try {
      const result = await query(
        `SELECT id, name, email, whatsapp, segment, color, deadline_days, company_id, is_active, last_access_at, created_at, updated_at
         FROM clients WHERE LOWER(email) = $1 AND is_active = true`,
        [normalizeEmail(email)]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.error('Failed to find client by email', { error })
      return null
    }
  }

  async findAll(companyId?: string, limit = 50, offset = 0, includeInactive = false) {
    try {
      let sql = `
        SELECT
          c.id,
          c.name,
          c.email,
          c.whatsapp,
          c.segment,
          c.color,
          c.deadline_days,
          c.company_id,
          c.is_active,
          COALESCE(c.last_access_at, MAX(t.last_used_at)) AS last_access_at,
          c.created_at
        FROM clients c
        LEFT JOIN client_portal_tokens t ON t.client_id = c.id
        WHERE 1 = 1`
      const params: any[] = []

      if (companyId) {
        sql += ` AND c.company_id = $${params.length + 1}`
        params.push(companyId)
      }
      if (!includeInactive) {
        sql += ` AND c.is_active = true`
      }

      sql += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit)
      params.push(offset)

      const result = await query(sql, params)

      // Get count
      let countSql = 'SELECT COUNT(*) as count FROM clients WHERE 1 = 1'
      const countParams: any[] = []
      if (companyId) {
        countSql += ` AND company_id = $1`
        countParams.push(companyId)
      }
      if (!includeInactive) {
        countSql += ` AND is_active = true`
      }

      const countResult = await query(countSql, countParams)

      return {
        clients: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
      }
    } catch (error) {
      logger.error('Failed to list clients', { error })
      return { clients: [], total: 0 }
    }
  }

  async update(id: string, dto: UpdateClientDTO, companyId?: string) {
    try {
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (dto.name !== undefined) {
        updates.push(`name = $${paramIndex}`)
        values.push(dto.name)
        paramIndex++
      }
      if (dto.whatsapp !== undefined) {
        updates.push(`whatsapp = $${paramIndex}`)
        values.push(dto.whatsapp)
        paramIndex++
      }
      if (dto.segment !== undefined) {
        updates.push(`segment = $${paramIndex}`)
        values.push(dto.segment)
        paramIndex++
      }
      if (dto.color !== undefined) {
        updates.push(`color = $${paramIndex}`)
        values.push(dto.color)
        paramIndex++
      }
      if (dto.deadline_days !== undefined) {
        updates.push(`deadline_days = $${paramIndex}`)
        values.push(dto.deadline_days)
        paramIndex++
      }

      if (updates.length === 0) return this.findById(id, companyId)

      updates.push(`updated_at = NOW()`)
      values.push(id)
      const conditions = [`id = $${paramIndex}`]
      if (companyId) {
        paramIndex++
        values.push(companyId)
        conditions.push(`company_id = $${paramIndex}`)
      }

      const sql = `UPDATE clients SET ${updates.join(', ')} WHERE ${conditions.join(' AND ')} RETURNING id, name, email, whatsapp, segment, color, deadline_days`

      const result = await query(sql, values)
      return result.rows[0] || null
    } catch (error) {
      logger.error('Failed to update client', { error })
      throw new Error('Failed to update client')
    }
  }

  async delete(id: string, companyId?: string) {
    try {
      const params: any[] = [id]
      const conditions = ['id = $1']
      if (companyId) {
        params.push(companyId)
        conditions.push(`company_id = $${params.length}`)
      }
      await query(`UPDATE clients SET is_active = false, updated_at = NOW() WHERE ${conditions.join(' AND ')}`, params)

      const postConditions = ['client_id = $1', 'deleted_at IS NULL']
      const postParams = [id]
      if (companyId) {
        postParams.push(companyId)
        postConditions.push(`company_id = $${postParams.length}`)
      }
      await query(
        `UPDATE posts
         SET files_delete_after = COALESCE(files_delete_after, NOW() + INTERVAL '1 day'),
             archived_by_client_deactivation = true,
             updated_at = NOW()
         WHERE ${postConditions.join(' AND ')}`,
        postParams,
      )
      await query(
        `UPDATE client_portal_tokens
         SET revoked_at = NOW()
         WHERE client_id = $1
           AND revoked_at IS NULL`,
        [id],
      ).catch(() => {})
    } catch (error) {
      logger.error('Failed to delete client', { error })
      throw new Error('Failed to delete client')
    }
  }

  async deletePermanently(id: string, companyId?: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const params: any[] = [id]
      const conditions = ['id = $1']
      if (companyId) {
        params.push(companyId)
        conditions.push(`company_id = $${params.length}`)
      }

      const existing = await client.query(
        `SELECT id FROM clients WHERE ${conditions.join(' AND ')}`,
        params,
      )
      if (!existing.rows[0]) {
        await client.query('ROLLBACK')
        return false
      }

      const files = await client.query(
        `SELECT DISTINCT f.bucket, f.storage_path
         FROM files f
         JOIN posts p ON p.id = f.post_id
         WHERE p.client_id = $1`,
        [id],
      )

      const removals = await Promise.all(files.rows.map(async row => {
        if (!row.bucket || !row.storage_path) {
          return { bucket: row.bucket, storagePath: row.storage_path, removed: false, error: 'Storage object identity is missing' }
        }
        const shared = await client.query(
          `SELECT 1
           FROM files f
           JOIN posts p ON p.id = f.post_id
           WHERE f.bucket = $1
             AND f.storage_path = $2
             AND p.client_id <> $3
           LIMIT 1`,
          [row.bucket, row.storage_path, id],
        )
        if (shared.rows[0]) return { bucket: row.bucket, storagePath: row.storage_path, removed: true }
        return removeStoredFile({ bucket: row.bucket, storagePath: row.storage_path })
      }))
      removals.filter(result => !result.removed).forEach(result => {
        logger.error('Failed to remove client storage object', result)
      })

      await client.query(
        `DELETE FROM activity_events
         WHERE client_id = $1
            OR post_id IN (SELECT id FROM posts WHERE client_id = $1)`,
        [id],
      )

      await client.query(`DELETE FROM clients WHERE ${conditions.join(' AND ')}`, params)
      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      logger.error('Failed to permanently delete client', { error })
      throw new Error('Failed to permanently delete client')
    } finally {
      client.release()
    }
  }

  async activate(id: string, companyId?: string) {
    const client = await pool.connect()
    let transactionStarted = false
    try {
      const params: any[] = [id]
      const conditions = ['id = $1']
      if (companyId) {
        params.push(companyId)
        conditions.push(`company_id = $${params.length}`)
      }

      await client.query('BEGIN')
      transactionStarted = true
      const current = await client.query(
        `SELECT id, email FROM clients WHERE ${conditions.join(' AND ')} FOR UPDATE`,
        params,
      )
      if (!current.rows[0]) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return null
      }

      await assertActiveEmailAvailable(client, current.rows[0].email, { clientId: id })
      const result = await client.query(
        `UPDATE clients
         SET is_active = true,
             updated_at = NOW()
         WHERE ${conditions.join(' AND ')}
         RETURNING id, name, email, whatsapp, segment, color, deadline_days, company_id, is_active, last_access_at, created_at, updated_at`,
        params,
      )

      if (result.rows[0]) {
        const postConditions = ['client_id = $1', 'deleted_at IS NULL']
        const postParams = [id]
        if (companyId) {
          postParams.push(companyId)
          postConditions.push(`company_id = $${postParams.length}`)
        }

        await client.query(
          `UPDATE posts
           SET files_delete_after = NULL,
               archived_by_client_deactivation = false,
               updated_at = NOW()
           WHERE ${postConditions.join(' AND ')}
             AND archived_by_client_deactivation = true`,
          postParams,
        )
      }

      await client.query('COMMIT')
      return result.rows[0] || null
    } catch (error: any) {
      if (transactionStarted) await client.query('ROLLBACK')
      if (isEmailConflict(error)) throw new Error('Email already exists')
      logger.error('Failed to activate client', { error })
      throw new Error('Failed to activate client')
    } finally {
      client.release()
    }
  }
}
