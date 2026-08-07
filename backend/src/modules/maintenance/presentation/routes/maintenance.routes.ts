import { Router, Request, Response } from 'express'
import { MaintenanceController } from '../controllers/MaintenanceController'
import { DemoResetConfiguration } from '../../../../config/demoReset'
import { env } from '../../../../config/environment'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

export function createMaintenanceRoutes(
  configuration: DemoResetConfiguration = env,
  controller = new MaintenanceController(configuration),
): Router {
  const router = Router()

  router.post('/reset-demo-data', wrap(controller.resetDemoData.bind(controller)))

  return router
}
