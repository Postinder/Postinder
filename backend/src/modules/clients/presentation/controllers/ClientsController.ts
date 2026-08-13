import { Request, Response } from 'express'
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository'
import bcryptjs from 'bcryptjs'
import { env } from '../../../../config/environment'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'
import {
  ClientInputValidationError,
  normalizeClientDocument,
  normalizeDeadlineDays,
  requiredClientFieldMissing,
} from '../../domain/clientInput'
import { DEFAULT_PLATFORM_SETTINGS } from '../../../platformSettings/domain/PlatformSettings'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

function preferredBodyValue(body: Record<string, any>, officialName: string, compatibilityName: string) {
  return Object.prototype.hasOwnProperty.call(body, officialName)
    ? body[officialName]
    : body[compatibilityName]
}

export class ClientsController {
  constructor(
    private clientRepository: ClientRepository,
    private activityRepository = new ActivityRepository(),
    private settingsService: Pick<PlatformSettingsService, 'get'> = {
      get: async () => ({ ...DEFAULT_PLATFORM_SETTINGS, updated_at: null }),
    },
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
      throw new Error('WhatsApp provider failed')
    }

    return { sent: true, provider: 'z-api' }
  }

  async create(req: AuthRequest, res: Response) {
    const body = req.body || {}
    const { name, email, password, whatsapp, segment, color } = body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const settings = await this.settingsService.get()
      const policies = settings.client_fields
      for (const [field, value] of [['whatsapp', whatsapp], ['segment', segment]] as const) {
        if (policies[field] === 'required' && requiredClientFieldMissing(value)) {
          return res.status(400).json({ error: `${field} is required` })
        }
      }
      const deadlineInput = preferredBodyValue(body, 'deadline_days', 'deadlineDays')
      if (policies.deadline_days === 'required' && (deadlineInput === undefined || deadlineInput === null || deadlineInput === '')) {
        return res.status(400).json({ error: 'deadline_days is required' })
      }
      const documentInput = preferredBodyValue(body, 'document_number', 'document')
      if (policies.document === 'required' && requiredClientFieldMissing(documentInput)) {
        return res.status(400).json({ error: 'document is required' })
      }
      const deadlineDays = normalizeDeadlineDays(
        policies.deadline_days === 'hidden' ? undefined : deadlineInput,
      )
      const document = policies.document === 'hidden'
        ? { document_type: null, document_number: null }
        : normalizeClientDocument(
          preferredBodyValue(body, 'document_type', 'documentType'),
          documentInput,
        )
      const passwordHash = await bcryptjs.hash(password, 10)

      const client = await this.clientRepository.create({
        name,
        email,
        password_hash: passwordHash,
        whatsapp: policies.whatsapp === 'hidden' ? undefined : whatsapp,
        segment: policies.segment === 'hidden' ? undefined : segment,
        color,
        deadline_days: deadlineDays,
        ...document,
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
      if (error instanceof ClientInputValidationError) {
        return res.status(400).json({ error: error.message })
      }
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
      const body = req.body || {}
      const { name, whatsapp, segment, color } = body
      const settings = await this.settingsService.get()
      const policies = settings.client_fields
      const includesDocument = policies.document !== 'hidden' && [
        'document_type',
        'document_number',
        'documentType',
        'document',
      ].some(field => Object.prototype.hasOwnProperty.call(body, field))
      const document: { document_type?: 'cpf' | 'cnpj' | null; document_number?: string | null } = includesDocument
        ? normalizeClientDocument(
          preferredBodyValue(body, 'document_type', 'documentType'),
          preferredBodyValue(body, 'document_number', 'document'),
        )
        : {}
      const deadlineDays = normalizeDeadlineDays(
        policies.deadline_days === 'hidden'
          ? undefined
          : preferredBodyValue(body, 'deadline_days', 'deadlineDays'),
      )
      const includesWhatsapp = Object.prototype.hasOwnProperty.call(body, 'whatsapp')
      const includesSegment = Object.prototype.hasOwnProperty.call(body, 'segment')
      const includesDeadline = ['deadline_days', 'deadlineDays'].some(field => Object.prototype.hasOwnProperty.call(body, field))
      const needsCurrent = Object.values(policies).includes('required')
      const current = needsCurrent ? await this.clientRepository.findById(id, req.tenantId) : null
      if (needsCurrent && !current) return res.status(404).json({ error: 'Client not found' })
      if (policies.whatsapp === 'required' && requiredClientFieldMissing(includesWhatsapp ? whatsapp : current?.whatsapp)) {
        return res.status(400).json({ error: 'whatsapp is required' })
      }
      if (policies.segment === 'required' && requiredClientFieldMissing(includesSegment ? segment : current?.segment)) {
        return res.status(400).json({ error: 'segment is required' })
      }
      if (policies.deadline_days === 'required' && requiredClientFieldMissing(includesDeadline ? deadlineDays : current?.deadline_days)) {
        return res.status(400).json({ error: 'deadline_days is required' })
      }
      if (policies.document === 'required' && requiredClientFieldMissing(includesDocument ? document.document_number : current?.document_number)) {
        return res.status(400).json({ error: 'document is required' })
      }
      const detailedViewValue = preferredBodyValue(body, 'portal_detailed_view', 'portalDetailedView')
      if (detailedViewValue !== undefined && typeof detailedViewValue !== 'boolean') {
        return res.status(400).json({ error: 'Invalid portal detailed view setting' })
      }
      const hasPortalOverride = Object.prototype.hasOwnProperty.call(body, 'portal_mode_override')
        || Object.prototype.hasOwnProperty.call(body, 'portalModeOverride')
      const portalModeOverride = hasPortalOverride
        ? preferredBodyValue(body, 'portal_mode_override', 'portalModeOverride')
        : detailedViewValue === undefined
          ? undefined
          : detailedViewValue ? 'detailed' : 'simplified'
      if (hasPortalOverride && portalModeOverride !== null && !['simplified', 'detailed'].includes(portalModeOverride)) {
        return res.status(400).json({ error: 'Invalid portal mode override' })
      }

      const client = await this.clientRepository.update(id, {
        name,
        whatsapp: policies.whatsapp === 'hidden' ? undefined : whatsapp,
        segment: policies.segment === 'hidden' ? undefined : segment,
        color,
        deadline_days: deadlineDays,
        portal_detailed_view: detailedViewValue,
        portal_mode_override: portalModeOverride,
        ...document,
      }, req.tenantId)

      if (!client) {
        return res.status(404).json({ error: 'Client not found' })
      }

      res.json({ data: client })
    } catch (error: any) {
      if (error instanceof ClientInputValidationError) {
        return res.status(400).json({ error: error.message })
      }
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
    } catch {
      res.status(502).json({ error: 'Failed to send WhatsApp notification' })
    }
  }
}
