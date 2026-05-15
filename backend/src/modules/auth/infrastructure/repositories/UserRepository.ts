import { query } from '../../../../shared/database/pool'

export interface User {
  id: string
  email: string
  name: string
  role: string
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
      'SELECT id, email, name, role, password_hash, is_active, created_at, updated_at, company_id FROM users WHERE email = $1 AND is_active = true',
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

  async findClientByTokenSlug(slug: string): Promise<Client | null> {
    const result = await query(
      `SELECT c.id, c.email, c.name, c.password_hash, c.whatsapp, c.segment, c.color,
              c.is_active, c.created_at, c.updated_at, c.company_id
         FROM client_tokens ct
         JOIN clients c ON c.id = ct.client_id
        WHERE ct.slug = $1
          AND ct.revoked_at IS NULL
          AND (ct.expires_at IS NULL OR ct.expires_at > NOW())
          AND c.is_active = true`,
      [slug],
    )

    if (result.rows[0]) {
      await query('UPDATE client_tokens SET last_used_at = NOW() WHERE slug = $1', [slug]).catch(() => {})
    }

    return result.rows[0] || null
  }
}
