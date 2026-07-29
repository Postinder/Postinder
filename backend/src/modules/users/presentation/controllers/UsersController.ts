import { Request, Response } from 'express'
import { UsersRepository } from '../../infrastructure/repositories/UsersRepository'
import { isKnownAdminRole } from '../../../auth/domain/AdminCapability'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class UsersController {
  constructor(private usersRepository: UsersRepository) {}

  async list(req: AuthRequest, res: Response) {
    const users = await this.usersRepository.findAll(req.tenantId)
    res.json({ data: users, total: users.length })
  }

  async create(req: AuthRequest, res: Response) {
    const { name, email, password, permissions = [] } = req.body
    const role = req.body.role === undefined
      ? 'viewer'
      : String(req.body.role).trim().toLowerCase()

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    if (!isKnownAdminRole(role)) {
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
    const role = req.body.role !== undefined
      ? String(req.body.role).trim().toLowerCase()
      : undefined

    if (role !== undefined && !isKnownAdminRole(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    const user = await this.usersRepository.update(req.params.id, { ...req.body, role }, req.tenantId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json(user)
  }

  async delete(req: AuthRequest, res: Response) {
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
