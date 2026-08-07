import { Request, Response } from 'express'
import { AIInsightsService } from '../../application/AIInsightsService'

export class AIInsightsController {
  constructor(private readonly service: AIInsightsService) {}

  async generate(req: Request, res: Response) {
    const data = await this.service.generate(req.body)
    res.json({ data })
  }
}
