import { Request, Response } from 'express'
import { ApprovalsRepository } from '../../infrastructure/repositories/ApprovalsRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

const repo = new ApprovalsRepository()

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
    res.json({ success: true })
  }

  async rejectFile(req: AuthRequest, res: Response) {
    const { tags = [], comment = '' } = req.body
    const rejected = await repo.rejectFile(req.params.id, tags, comment, {
      clientId: req.user?.clientId,
      companyId: req.tenantId,
    })
    if (!rejected) return res.status(404).json({ error: 'File not found or already reviewed' })
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
    res.json({ success: true })
  }

  async rejectPost(req: AuthRequest, res: Response) {
    const rejected = await repo.rejectAllFiles(req.params.id, req.tenantId)
    if (!rejected) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }
}
