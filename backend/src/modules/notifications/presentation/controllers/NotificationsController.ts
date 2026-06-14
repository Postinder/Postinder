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

    const notifications = await this.notificationRepository.list({
      companyId: req.tenantId,
      userId,
    })

    res.json({ data: notifications })
  }

  async markAsRead(req: AuthRequest, res: Response) {
    const userId = this.getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Authenticated user required' })

    const notificationIds = Array.isArray(req.body.notificationIds)
      ? req.body.notificationIds
      : req.body.notificationId
        ? [req.body.notificationId]
        : []

    const reads = await this.notificationRepository.markAsRead({
      companyId: req.tenantId,
      userId,
      notificationIds,
    })

    res.json({ data: reads })
  }

  async markAllAsRead(req: AuthRequest, res: Response) {
    const userId = this.getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Authenticated user required' })

    const reads = await this.notificationRepository.markAllAsRead({
      companyId: req.tenantId,
      userId,
    })

    res.json({ data: reads })
  }
}
