import { NextFunction, Request, Response, Router } from 'express'
import { brandingLogoUpload } from '../../../../shared/upload/multer'
import { BrandingController } from '../controllers/BrandingController'

function wrap(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export function createPublicBrandingRoutes(controller = new BrandingController()) {
  const router = Router()
  router.get('/', wrap(controller.getPublic.bind(controller)))
  return router
}

export function createAdminBrandingRoutes(controller = new BrandingController()) {
  const router = Router()
  router.post('/logo', brandingLogoUpload.single('file'), wrap(controller.uploadLogo.bind(controller)))
  router.delete('/logo', wrap(controller.removeLogo.bind(controller)))
  return router
}
