import { Request, Response } from 'express'
import { UsersRepository } from '../../infrastructure/repositories/UsersRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

const allowedRoles = ['admin', 'manager', 'editor', 'viewer', 'gestor', 'equipe']

export class UsersController {
  constructor(private usersRepository: UsersRepository) {}

  private isAdmin(req: AuthRequest) {
    return req.user?.type === 'admin' && req.user?.role === 'admin'
  }

  private ensureAdmin(req: AuthRequest, res: Response) {
    if (!this.isAdmin(req)) {
      res.status(403).json({ error: 'Admin access required' })
      return false
    }
    return true
  }

  async list(req: AuthRequest, res: Response) {
    if (!this.ensureAdmin(req, res)) return
    const users = await this.usersRepository.findAll(req.tenantId)
    res.json({ data: users, total: users.length })
  }

  async create(req: AuthRequest, res: Response) {
    if (!this.ensureAdmin(req, res)) return
    const { name, email, password, permissions = [] } = req.body
    const role = String(req.body.role || 'viewer').trim().toLowerCase()

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    try {
      const user = await this.usersRepository.create({
        name,
        email,
        password,
        role,
        permissions,
        companyId: req.tenantId,
      })

      res.status(201).json(user)
    } catch (error: any) {
      const status = error.message === 'Email already exists' ? 400 : 500
      const message = error.message === 'Email already exists'
        ? 'Este e-mail ja esta em uso por um usuario ou cliente.'
        : error.message
      res.status(status).json({ error: message })
    }
  }

  async update(req: AuthRequest, res: Response) {
    if (!this.ensureAdmin(req, res)) return
    const role = req.body.role !== undefined
      ? String(req.body.role).trim().toLowerCase()
      : undefined

    if (role !== undefined && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const user = await this.usersRepository.update(req.params.id, { ...req.body, role }, req.tenantId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json(user)
  }

  async delete(req: AuthRequest, res: Response) {
    if (!this.ensureAdmin(req, res)) return
    if (req.user?.userId === req.params.id) {
      return res.status(400).json({ error: 'Voce nao pode excluir o proprio usuario.' })
    }

    try {
      const deleted = await this.usersRepository.delete(req.params.id, req.tenantId)
      if (!deleted) return res.status(404).json({ error: 'User not found' })
    } catch (error: any) {
      if (error.message === 'Primary admin cannot be deleted') {
        return res.status(400).json({ error: 'O usuario admin principal nao pode ser excluido.' })
      }
      throw error
    }

    res.json({ success: true })
  }
}
