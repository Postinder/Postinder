import { Request, Response } from 'express'
import { ActivityRepository } from '../../infrastructure/repositories/ActivityRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class ActivitiesController {
  constructor(private activityRepository = new ActivityRepository()) {}

  async list(req: AuthRequest, res: Response) {
    const activities = await this.activityRepository.list({
      companyId: req.tenantId,
      clientId: req.query.clientId as string | undefined,
      limit: parseInt(req.query.limit as string, 10) || 20,
    })

    res.json({ data: activities })
  }

  async create(req: AuthRequest, res: Response) {
    const { type, title, description, clientId, postId, metadata } = req.body

    if (!type || !title) {
      return res.status(400).json({ error: 'type and title are required' })
    }

    const activity = await this.activityRepository.create({
      companyId: req.tenantId,
      clientId,
      postId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type,
      title,
      description,
      metadata,
    })

    res.status(201).json({ data: activity })
  }
}
