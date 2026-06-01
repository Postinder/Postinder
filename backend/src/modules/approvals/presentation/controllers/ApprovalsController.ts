import { Request, Response } from 'express'
import { ApprovalsRepository } from '../../infrastructure/repositories/ApprovalsRepository'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

const repo = new ApprovalsRepository()
const activityRepo = new ActivityRepository()

export class ApprovalsController {
  async getQueue(req: AuthRequest, res: Response) {
    const clientId = req.user?.clientId || (req.query.clientId as string)
    if (!clientId) return res.status(400).json({ error: 'clientId is required' })
    const queue = await repo.getClientQueue(clientId, req.tenantId)
    res.json({ data: queue })
  }

  async approveFile(req: AuthRequest, res: Response) {
    const approved = await repo.approveFile(req.params.id, {
      clientId: req.user?.clientId,
      companyId: req.tenantId,
    })
    if (!approved) return res.status(404).json({ error: 'File not found or already reviewed' })
    await activityRepo.createForFile(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'file_approved',
      title: 'Arquivo aprovado',
    }).catch(() => {})
    res.json({ success: true })
  }

  async rejectFile(req: AuthRequest, res: Response) {
    const { tags = [], comment = '' } = req.body
    const rejected = await repo.rejectFile(req.params.id, tags, comment, {
      clientId: req.user?.clientId,
      companyId: req.tenantId,
    })
    if (!rejected) return res.status(404).json({ error: 'File not found or already reviewed' })
    await activityRepo.createForFile(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'feedback_sent',
      title: 'Feedback enviado',
      metadata: { tags, comment },
    }).catch(() => {})
    res.json({ success: true })
  }

  async submitFeedback(req: AuthRequest, res: Response) {
    const { clientId, rating, text, month } = req.body
    const id = req.user?.clientId || clientId
    if (!id) return res.status(400).json({ error: 'clientId required' })
    if (!rating || rating < 1 || rating > 5 || !text?.trim()) {
      return res.status(400).json({ error: 'rating and text are required' })
    }
    const saved = await repo.saveFeedback(id, rating, text.trim(), month || new Date().toISOString().slice(0, 7), req.tenantId)
    if (!saved) return res.status(404).json({ error: 'Client not found' })
    await activityRepo.createForClient(id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'monthly_feedback_sent',
      title: 'Feedback mensal enviado',
      metadata: { rating, month: month || new Date().toISOString().slice(0, 7) },
    }).catch(() => {})
    res.status(201).json({ success: true })
  }

  async listMonthlyFeedbacks(req: AuthRequest, res: Response) {
    const feedbacks = await repo.listMonthlyFeedbacks({
      clientId: req.query.clientId as string | undefined,
      month: req.query.month as string | undefined,
      companyId: req.tenantId,
    })

    res.json({ feedbacks })
  }

  async approvePost(req: AuthRequest, res: Response) {
    const approved = await repo.approveAllFiles(req.params.id, req.tenantId)
    if (!approved) return res.status(404).json({ error: 'Post not found' })
    await activityRepo.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_approved',
      title: 'Post aprovado',
    }).catch(() => {})
    res.json({ success: true })
  }

  async rejectPost(req: AuthRequest, res: Response) {
    const rejected = await repo.rejectAllFiles(req.params.id, req.tenantId)
    if (!rejected) return res.status(404).json({ error: 'Post not found' })
    await activityRepo.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_rejected',
      title: 'Post recusado',
    }).catch(() => {})
    res.json({ success: true })
  }
}
