import { query } from '../../../../shared/database/pool'
import { logger } from '../../../../shared/utils/Logger'

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
    try {
      const result = await query(
        `INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id, name, email, whatsapp, segment, color, deadline_days, created_at`,
        [
          dto.name,
          dto.email,
          dto.password_hash,
          dto.whatsapp || null,
          dto.segment || null,
          dto.color || null,
          dto.deadline_days || 7,
          dto.company_id || null,
        ]
      )
      return result.rows[0]
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('Email already exists')
      }
      logger.error('Failed to create client', { error })
      throw new Error('Failed to create client')
    }
  }

  async findById(id: string, companyId?: string) {
    try {
      const params: any[] = [id]
      let sql = `SELECT id, name, email, whatsapp, segment, color, deadline_days, company_id, is_active, created_at, updated_at
         FROM clients WHERE id = $1 AND is_active = true`
      if (companyId) {
        params.push(companyId)
        sql += ` AND company_id = $${params.length}`
      }
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
        `SELECT id, name, email, whatsapp, segment, color, deadline_days, company_id, is_active, created_at, updated_at
         FROM clients WHERE email = $1 AND is_active = true`,
        [email]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.error('Failed to find client by email', { error })
      return null
    }
  }

  async findAll(companyId?: string, limit = 50, offset = 0) {
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
          c.created_at
        FROM clients c
        WHERE c.is_active = true`
      const params: any[] = []

      if (companyId) {
        sql += ` AND c.company_id = $${params.length + 1}`
        params.push(companyId)
      }

      sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit)
      params.push(offset)

      const result = await query(sql, params)

      // Get count
      let countSql = 'SELECT COUNT(*) as count FROM clients WHERE is_active = true'
      const countParams: any[] = []
      if (companyId) {
        countSql += ` AND company_id = $1`
        countParams.push(companyId)
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
    } catch (error) {
      logger.error('Failed to delete client', { error })
      throw new Error('Failed to delete client')
    }
  }
}
