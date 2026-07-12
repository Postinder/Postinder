import { Request, Response } from 'express'
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository'
import bcryptjs from 'bcryptjs'
import { env } from '../../../../config/environment'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class ClientsController {
  constructor(
    private clientRepository: ClientRepository,
    private activityRepository = new ActivityRepository(),
  ) {}

  private onlyDigits(value = '') {
    return value.replace(/\D/g, '')
  }

  private withBrazilCountryCode(phone = '') {
    const digits = this.onlyDigits(phone)
    if (!digits) return ''
    return digits.startsWith('55') ? digits : `55${digits}`
  }

  private buildApprovalUrl() {
    const baseUrl = env.APP_PUBLIC_URL || 'http://localhost:5173'
    return `${baseUrl.replace(/\/$/, '')}/aprovar`
  }

  private async sendWhatsApp(phone: string, message: string) {
    if (!env.ZAPI_INSTANCE || !env.ZAPI_TOKEN) {
      return { sent: true, provider: 'local-preview' }
    }

    const response = await fetch(
      `https://api.z-api.io/instances/${env.ZAPI_INSTANCE}/token/${env.ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message }),
      },
    )

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(details || 'WhatsApp provider failed')
    }

    return { sent: true, provider: 'z-api' }
  }

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

      await this.activityRepository.createForClient(client.id, {
        companyId: req.tenantId,
        actorId: req.user?.userId || req.user?.clientId,
        actorRole: req.user?.role,
        type: 'client_created',
        title: 'Cliente criado',
      }).catch(() => {})

      res.status(201).json({ data: client })
    } catch (error: any) {
      const status = error.message === 'Email already exists' ? 400 : 500
      const message = error.message === 'Email already exists'
        ? 'Este e-mail ja esta em uso por um usuario ou cliente.'
        : error.message
      res.status(status).json({ error: message })
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const { limit = 50, offset = 0, includeInactive } = req.query
      const includeInactiveValue = includeInactive === 'true' || includeInactive === '1'
      const result = await this.clientRepository.findAll(
        req.tenantId,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10),
        includeInactiveValue,
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

      await this.activityRepository.createForClient(id, {
        companyId: req.tenantId,
        actorId: req.user?.userId || req.user?.clientId,
        actorRole: req.user?.role,
        type: 'client_updated',
        title: 'Cliente atualizado',
      }).catch(() => {})

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
      res.json({ message: 'Client disabled successfully' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async deletePermanently(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const deleted = await this.clientRepository.deletePermanently(id, req.tenantId)
      if (!deleted) {
        return res.status(404).json({ error: 'Client not found' })
      }
      res.json({ message: 'Client permanently deleted successfully' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async activate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const client = await this.clientRepository.activate(id, req.tenantId)
      if (!client) return res.status(404).json({ error: 'Client not found' })
      res.json({ data: client })
    } catch (error: any) {
      const conflict = error.message === 'Email already exists'
      res.status(conflict ? 400 : 500).json({
        error: conflict ? 'Este e-mail ja esta em uso por um usuario ou cliente.' : error.message,
      })
    }
  }

  async notify(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const target = await this.clientRepository.findNotificationTarget(id, req.tenantId)

      if (!target) {
        return res.status(404).json({ error: 'Client not found' })
      }

      const phone = this.withBrazilCountryCode(target.whatsapp)
      if (!phone) {
        return res.status(400).json({ error: 'Client has no WhatsApp number' })
      }
      const approvalUrl = this.buildApprovalUrl()
      const message = `Olá ${target.name}! Você tem conteúdos aguardando aprovação. Acesse: ${approvalUrl}`
      const delivery = await this.sendWhatsApp(phone, message)
      await this.activityRepository.createForClient(id, {
        companyId: req.tenantId,
        actorId: req.user?.userId || req.user?.clientId,
        actorRole: req.user?.role,
        type: 'approval_notification_sent',
        title: 'Notificação enviada',
        metadata: { provider: delivery.provider, phone },
      }).catch(() => {})

      res.json({
        ...delivery,
        phone,
        message,
        approvalUrl,
      })
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'Failed to send WhatsApp notification' })
    }
  }
}
