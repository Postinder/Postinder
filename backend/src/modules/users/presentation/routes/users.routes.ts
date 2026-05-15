import { Router, Request, Response } from 'express'
import bcryptjs from 'bcryptjs'
import { query } from '../../../../shared/database/pool'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

const allowedRoles = ['admin', 'manager', 'editor', 'viewer', 'gestor', 'equipe']

function requireAdmin(req: any, res: Response) {
  if (req.user?.type !== 'admin' || req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return false
  }
  return true
}

export function createUsersRoutes(): Router {
  const router = Router()

  router.get('/', wrap(async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return
    const params: any[] = []
    const conditions = ['is_active = true']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `SELECT id, name, email, role, permissions, company_id, is_active, created_at, updated_at
       FROM users
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    )
    res.json({ data: result.rows, total: result.rows.length })
  }))

  router.post('/', wrap(async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return
    const { name, email, password, role = 'viewer', permissions = [] } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const passwordHash = await bcryptjs.hash(password, 10)
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, permissions, company_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, email, role, permissions, company_id, is_active, created_at, updated_at`,
      [name, email, passwordHash, role, permissions, req.tenantId || null],
    )

    res.status(201).json(result.rows[0])
  }))

  router.put('/:id', wrap(async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return
    const { name, role, permissions, password } = req.body
    const fields = ['updated_at = NOW()']
    const params: any[] = []

    if (name !== undefined) {
      params.push(name)
      fields.push(`name = $${params.length}`)
    }
    if (role !== undefined) {
      if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })
      params.push(role)
      fields.push(`role = $${params.length}`)
    }
    if (permissions !== undefined) {
      params.push(permissions)
      fields.push(`permissions = $${params.length}`)
    }
    if (password) {
      params.push(await bcryptjs.hash(password, 10))
      fields.push(`password_hash = $${params.length}`)
    }

    params.push(req.params.id)
    const conditions = [`id = $${params.length}`, 'is_active = true']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }

    const result = await query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING id, name, email, role, permissions, company_id, is_active, created_at, updated_at`,
      params,
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(result.rows[0])
  }))

  router.delete('/:id', wrap(async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return
    const params: any[] = [req.params.id]
    const conditions = ['id = $1']
    if (req.tenantId) {
      params.push(req.tenantId)
      conditions.push(`company_id = $${params.length}`)
    }

    await query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE ${conditions.join(' AND ')}`, params)
    res.json({ success: true })
  }))

  return router
}
