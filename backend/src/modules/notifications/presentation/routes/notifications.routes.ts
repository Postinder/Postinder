import { Router, Request, Response } from 'express'
import { NotificationsController } from '../controllers/NotificationsController'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) =>
    fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

export function createNotificationsRoutes(): Router {
  const router = Router()
  const controller = new NotificationsController()

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/read', wrap(controller.markAsRead.bind(controller)))
  router.post('/read-all', wrap(controller.markAllAsRead.bind(controller)))

  return router
}
