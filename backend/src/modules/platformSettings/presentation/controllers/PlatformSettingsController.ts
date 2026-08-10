import { Request, Response } from 'express'
import { PlatformSettingsService } from '../../application/PlatformSettingsService'

export class PlatformSettingsController {
  constructor(private readonly service = new PlatformSettingsService()) {}

  async get(_req: Request, res: Response) {
    res.set('Cache-Control', 'no-store')
    res.json(await this.service.get())
  }

  async update(req: Request, res: Response) {
    res.json(await this.service.update(req.body))
  }
}
