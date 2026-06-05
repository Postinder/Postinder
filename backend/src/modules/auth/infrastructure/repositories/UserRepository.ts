import { query } from '../../../../shared/database/pool'

export interface User {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  password_hash?: string
  is_active: boolean
  company_id?: string
  created_at: Date
  updated_at: Date
}

export interface Client {
  id: string
  email: string
  name: string
  password_hash: string
  whatsapp?: string
  segment?: string
  color?: string
  is_active: boolean
  company_id?: string
  created_at: Date
  updated_at: Date
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, name, role, permissions, password_hash, is_active, created_at, updated_at, company_id FROM users WHERE email = $1 AND is_active = true',
      [email]
    )
    return result.rows[0] || null
  }

  async findClientByEmail(email: string): Promise<Client | null> {
    const result = await query(
      'SELECT id, email, name, password_hash, whatsapp, segment, color, is_active, created_at, updated_at, company_id FROM clients WHERE email = $1 AND is_active = true',
      [email]
    )
    return result.rows[0] || null
  }

  async findClientById(id: string): Promise<Client | null> {
    const result = await query(
      'SELECT id, email, name, password_hash, whatsapp, segment, color, is_active, created_at, updated_at, company_id FROM clients WHERE id = $1 AND is_active = true',
      [id],
    )
    return result.rows[0] || null
  }

}
