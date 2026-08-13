import { NextFunction, Request, Response, Router } from 'express'
import { PlatformSettingsController } from '../controllers/PlatformSettingsController'

function wrap(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export function createPlatformSettingsRoutes(controller = new PlatformSettingsController()) {
  const router = Router()
  router.get('/', wrap(controller.get.bind(controller)))
  router.patch('/', wrap(controller.update.bind(controller)))
  return router
}
