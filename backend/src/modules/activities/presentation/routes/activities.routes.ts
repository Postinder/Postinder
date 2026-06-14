import { Router, Request, Response } from 'express'
import { ActivitiesController } from '../controllers/ActivitiesController'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) =>
    fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

export function createActivitiesRoutes(): Router {
  const router = Router()
  const controller = new ActivitiesController()

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/', wrap(controller.create.bind(controller)))

  return router
}
