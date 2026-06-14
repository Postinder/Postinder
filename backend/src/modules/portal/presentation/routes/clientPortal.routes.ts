import { Router, Request, Response } from 'express'
import { PortalController } from '../controllers/PortalController'

const controller = new PortalController()

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req, res).catch(err => res.status(500).json({ error: err.message }))
}

export function createClientPortalRoutes(): Router {
  const router = Router()

  router.get('/', wrap(controller.getAuthenticatedPortal.bind(controller)))
  router.post('/posts/:postId/approve', wrap(controller.approveAuthenticatedPost.bind(controller)))
  router.post('/posts/:postId/reject', wrap(controller.rejectAuthenticatedPost.bind(controller)))
  router.post('/files/:fileId/approve', wrap(controller.approveAuthenticatedFile.bind(controller)))
  router.post('/files/:fileId/reject', wrap(controller.rejectAuthenticatedFile.bind(controller)))
  router.patch('/files/:fileId/feedback', wrap(controller.updateAuthenticatedRejectedFileFeedback.bind(controller)))
  router.post('/files/:fileId/reset', wrap(controller.resetAuthenticatedFile.bind(controller)))
  router.post('/feedback', wrap(controller.createAuthenticatedFeedback.bind(controller)))

  return router
}
