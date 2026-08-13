import { Router, Request, Response, NextFunction } from 'express'
import { PortalController } from '../controllers/PortalController'

const controller = new PortalController()

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)
}

export function createClientPortalRoutes(): Router {
  const router = Router()

  router.get('/', wrap(controller.getAuthenticatedPortal.bind(controller)))
  router.post('/posts/:postId/approve', wrap(controller.approveAuthenticatedPost.bind(controller)))
  router.post('/posts/:postId/reject', wrap(controller.rejectAuthenticatedPost.bind(controller)))
  router.put('/posts/:postId/items/:fileId/decision', wrap(controller.saveAuthenticatedItemDecision.bind(controller)))
  router.post('/posts/:postId/complete-review', wrap(controller.completeAuthenticatedItemReview.bind(controller)))
  router.post('/posts/:postId/reopen', wrap(controller.reopenAuthenticatedPost.bind(controller)))
  router.post('/files/:fileId/approve', wrap(controller.approveAuthenticatedFile.bind(controller)))
  router.post('/files/:fileId/reject', wrap(controller.rejectAuthenticatedFile.bind(controller)))
  router.patch('/files/:fileId/feedback', wrap(controller.updateAuthenticatedRejectedFileFeedback.bind(controller)))
  router.post('/files/:fileId/reset', wrap(controller.resetAuthenticatedFile.bind(controller)))
  router.post('/posts/:postId/soundtrack/approve', wrap(controller.approveAuthenticatedSoundtrack.bind(controller)))
  router.post('/posts/:postId/soundtrack/adjust', wrap(controller.rejectAuthenticatedSoundtrack.bind(controller)))
  router.post('/posts/:postId/soundtrack/reset', wrap(controller.resetAuthenticatedSoundtrack.bind(controller)))
  router.post('/feedback', wrap(controller.createAuthenticatedFeedback.bind(controller)))

  return router
}
