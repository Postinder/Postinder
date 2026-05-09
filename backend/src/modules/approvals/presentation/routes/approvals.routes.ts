import { Router, Request, Response } from 'express'
import { ApprovalsController } from '../controllers/ApprovalsController'

const ctrl = new ApprovalsController()

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(500).json({ error: err.message }))
}

export function createApprovalsRoutes(): Router {
  const router = Router()
  router.get('/queue', wrap(ctrl.getQueue.bind(ctrl)))
  return router
}

export function createFilesRoutes(): Router {
  const router = Router()
  router.post('/:id/approve', wrap(ctrl.approveFile.bind(ctrl)))
  router.post('/:id/reject', wrap(ctrl.rejectFile.bind(ctrl)))
  return router
}

export function createFeedbackRoutes(): Router {
  const router = Router()
  router.post('/', wrap(ctrl.submitFeedback.bind(ctrl)))
  return router
}
