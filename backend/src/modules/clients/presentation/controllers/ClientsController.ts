import { Request, Response } from 'express'
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository'
import bcryptjs from 'bcryptjs'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class ClientsController {
  constructor(private clientRepository: ClientRepository) {}

  async create(req: AuthRequest, res: Response) {
    const { name, email, password, whatsapp, segment, color, deadline_days } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const passwordHash = await bcryptjs.hash(password, 10)

      const client = await this.clientRepository.create({
        name,
        email,
        password_hash: passwordHash,
        whatsapp,
        segment,
        color,
        deadline_days,
        company_id: req.tenantId,
      })

      res.status(201).json({ data: client })
    } catch (error: any) {
      const status = error.message === 'Email already exists' ? 400 : 500
      res.status(status).json({ error: error.message })
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const { limit = 50, offset = 0 } = req.query
      const result = await this.clientRepository.findAll(
        req.tenantId,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      )

      res.json({
        data: result.clients,
        total: result.total,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const client = await this.clientRepository.findById(id, req.tenantId)

      if (!client) {
        return res.status(404).json({ error: 'Client not found' })
      }

      res.json({ data: client })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { name, whatsapp, segment, color, deadline_days } = req.body

      const client = await this.clientRepository.update(id, {
        name,
        whatsapp,
        segment,
        color,
        deadline_days,
      }, req.tenantId)

      if (!client) {
        return res.status(404).json({ error: 'Client not found' })
      }

      res.json({ data: client })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      await this.clientRepository.delete(id, req.tenantId)
      res.json({ message: 'Client deleted successfully' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
