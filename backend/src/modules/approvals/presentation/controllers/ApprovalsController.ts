import { Request, Response } from 'express'
import { ApprovalsRepository } from '../../infrastructure/repositories/ApprovalsRepository'

interface AuthRequest extends Request {
  user?: any
}

const repo = new ApprovalsRepository()

export class ApprovalsController {
  async getQueue(req: AuthRequest, res: Response) {
    const clientId = (req.query.clientId as string) || req.user?.clientId
    if (!clientId) return res.status(400).json({ error: 'clientId is required' })
    const queue = await repo.getClientQueue(clientId)
    res.json({ data: queue })
  }

  async approveFile(req: AuthRequest, res: Response) {
    await repo.approveFile(req.params.id)
    res.json({ success: true })
  }

  async rejectFile(req: AuthRequest, res: Response) {
    const { tags = [], comment = '' } = req.body
    await repo.rejectFile(req.params.id, tags, comment)
    res.json({ success: true })
  }

  async submitFeedback(req: AuthRequest, res: Response) {
    const { clientId, rating, text, month } = req.body
    const id = clientId || req.user?.clientId
    if (!id) return res.status(400).json({ error: 'clientId required' })
    await repo.saveFeedback(id, rating, text, month)
    res.status(201).json({ success: true })
  }

  async approvePost(req: AuthRequest, res: Response) {
    await repo.approveAllFiles(req.params.id)
    res.json({ success: true })
  }

  async rejectPost(req: AuthRequest, res: Response) {
    await repo.rejectAllFiles(req.params.id)
    res.json({ success: true })
  }
}
