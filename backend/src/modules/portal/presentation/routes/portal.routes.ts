import { Router, Request, Response, NextFunction } from 'express'
import { PortalController } from '../controllers/PortalController'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export function createPortalRoutes(controller = new PortalController()): Router {
  const router = Router()

  router.get('/:token', wrap(controller.getPortal.bind(controller)))
  router.get('/:token/posts', wrap(controller.listPosts.bind(controller)))
  router.post('/:token/posts/:postId/approve', wrap(controller.approvePost.bind(controller)))
  router.post('/:token/posts/:postId/reject', wrap(controller.rejectPost.bind(controller)))
  router.post('/:token/files/:fileId/approve', wrap(controller.approveFile.bind(controller)))
  router.post('/:token/files/:fileId/reject', wrap(controller.rejectFile.bind(controller)))
  router.patch('/:token/files/:fileId/feedback', wrap(controller.updateRejectedFileFeedback.bind(controller)))
  router.post('/:token/files/:fileId/reset', wrap(controller.resetFile.bind(controller)))
  router.post('/:token/posts/:postId/soundtrack/approve', wrap(controller.approveSoundtrack.bind(controller)))
  router.post('/:token/posts/:postId/soundtrack/adjust', wrap(controller.rejectSoundtrack.bind(controller)))
  router.post('/:token/posts/:postId/soundtrack/reset', wrap(controller.resetSoundtrack.bind(controller)))
  router.post('/:token/feedback', wrap(controller.createFeedback.bind(controller)))

  return router
}
