import bcryptjs from 'bcryptjs'
import { query } from '../../../../shared/database/pool'

export interface CreateUserDTO {
  name: string
  email: string
  password: string
  role: string
  permissions: string[]
  companyId?: string
}

export interface UpdateUserDTO {
  name?: string
  role?: string
  permissions?: string[]
  password?: string
}

export class UsersRepository {
  private scope(companyId?: string) {
    const params: any[] = []
    const conditions = ['is_active = true']

    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    return { params, conditions }
  }

  async findAll(companyId?: string) {
    const { params, conditions } = this.scope(companyId)
    const result = await query(
      `SELECT id, name, email, role, permissions, company_id, is_active, created_at, updated_at
       FROM users
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    )

    return result.rows
  }

  async create(dto: CreateUserDTO) {
    const passwordHash = await bcryptjs.hash(dto.password, 10)
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, permissions, company_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, email, role, permissions, company_id, is_active, created_at, updated_at`,
      [dto.name, dto.email, passwordHash, dto.role, dto.permissions, dto.companyId || null],
    )

    return result.rows[0]
  }

  async update(id: string, dto: UpdateUserDTO, companyId?: string) {
    const fields = ['updated_at = NOW()']
    const params: any[] = []

    if (dto.name !== undefined) {
      params.push(dto.name)
      fields.push(`name = $${params.length}`)
    }
    if (dto.role !== undefined) {
      params.push(dto.role)
      fields.push(`role = $${params.length}`)
    }
    if (dto.permissions !== undefined) {
      params.push(dto.permissions)
      fields.push(`permissions = $${params.length}`)
    }
    if (dto.password) {
      params.push(await bcryptjs.hash(dto.password, 10))
      fields.push(`password_hash = $${params.length}`)
    }

    params.push(id)
    const conditions = [`id = $${params.length}`, 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING id, name, email, role, permissions, company_id, is_active, created_at, updated_at`,
      params,
    )

    return result.rows[0] || null
  }

  async delete(id: string, companyId?: string) {
    const params: any[] = [id]
    const conditions = ['id = $1']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params,
    )

    return Boolean(result.rows[0])
  }
}
