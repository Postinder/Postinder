import { Router, Request, Response } from 'express'
import { PortalController } from '../controllers/PortalController'

const controller = new PortalController()

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req, res).catch(err => res.status(500).json({ error: err.message }))
}

export function createPortalRoutes(): Router {
  const router = Router()

  router.get('/:token', wrap(controller.getPortal.bind(controller)))
  router.get('/:token/posts', wrap(controller.listPosts.bind(controller)))
  router.post('/:token/posts/:postId/approve', wrap(controller.approvePost.bind(controller)))
  router.post('/:token/posts/:postId/reject', wrap(controller.rejectPost.bind(controller)))
  router.post('/:token/files/:fileId/approve', wrap(controller.approveFile.bind(controller)))
  router.post('/:token/files/:fileId/reject', wrap(controller.rejectFile.bind(controller)))
  router.patch('/:token/files/:fileId/feedback', wrap(controller.updateRejectedFileFeedback.bind(controller)))
  router.post('/:token/files/:fileId/reset', wrap(controller.resetFile.bind(controller)))
  router.post('/:token/feedback', wrap(controller.createFeedback.bind(controller)))

  return router
}
