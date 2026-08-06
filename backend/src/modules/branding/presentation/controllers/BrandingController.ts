import { Request, Response } from 'express'
import { BrandingService } from '../../application/BrandingService'
import { assertBrandingLogoFile } from '../../../../shared/upload/multer'

export class BrandingController {
  constructor(private readonly service = new BrandingService()) {}

  async getPublic(_req: Request, res: Response) {
    res.set('Cache-Control', 'no-store')
    res.json(await this.service.getPublicBranding())
  }

  async uploadLogo(req: Request, res: Response) {
    const file = req.file as Express.Multer.File | undefined
    if (!file) {
      return res.status(400).json({ error: 'Selecione um arquivo de logo.', code: 'BRANDING_FILE_REQUIRED' })
    }
    await assertBrandingLogoFile(file)
    res.json(await this.service.replaceLogo(file))
  }

  async removeLogo(_req: Request, res: Response) {
    res.json(await this.service.removeLogo())
  }
}
