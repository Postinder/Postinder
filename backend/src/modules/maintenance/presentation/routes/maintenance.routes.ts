import { Router, Request, Response } from 'express'
import { MaintenanceController } from '../controllers/MaintenanceController'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

export function createMaintenanceRoutes(): Router {
  const router = Router()
  const controller = new MaintenanceController()

  router.post('/reset-demo-data', wrap(controller.resetDemoData.bind(controller)))

  return router
}
