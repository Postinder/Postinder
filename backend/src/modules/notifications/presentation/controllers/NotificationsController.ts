import { Request, Response } from 'express'
import { NotificationRepository } from '../../infrastructure/repositories/NotificationRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class NotificationsController {
  constructor(private notificationRepository = new NotificationRepository()) {}

  private getUserId(req: AuthRequest) {
    return req.user?.userId || req.user?.clientId
  }

  async list(req: AuthRequest, res: Response) {
    const userId = this.getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Authenticated user required' })

    try {
      const notifications = await this.notificationRepository.list({
        companyId: req.tenantId,
        userId,
      })
      res.json({ data: notifications })
    } catch (err: any) {
      console.error('[NotificationsController.list]', err)
      res.status(500).json({ error: 'Erro ao buscar notificações', detail: err?.message })
    }
  }

  async markAsRead(req: AuthRequest, res: Response) {
    const userId = this.getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Authenticated user required' })

    const notificationIds = Array.isArray(req.body.notificationIds)
      ? req.body.notificationIds
      : req.body.notificationId
        ? [req.body.notificationId]
        : []

    try {
      const reads = await this.notificationRepository.markAsRead({
        companyId: req.tenantId,
        userId,
        notificationIds,
      })
      res.json({ data: reads })
    } catch (err: any) {
      console.error('[NotificationsController.markAsRead]', err)
      res.status(500).json({ error: 'Erro ao marcar notificações como lidas', detail: err?.message })
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response) {
    const userId = this.getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Authenticated user required' })

    try {
      const reads = await this.notificationRepository.markAllAsRead({
        companyId: req.tenantId,
        userId,
      })
      res.json({ data: reads })
    } catch (err: any) {
      console.error('[NotificationsController.markAllAsRead]', err)
      res.status(500).json({ error: 'Erro ao marcar todas como lidas', detail: err?.message })
    }
  }
}
