import { Router, Request, Response } from 'express'
import { PostsController } from '../controllers/PostsController'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'
import { ApprovalsController } from '../../../approvals/presentation/controllers/ApprovalsController'
import { upload } from '../../../../shared/upload/multer'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

const approvalsCtrl = new ApprovalsController()

export function createPostsRoutes(): Router {
  const router = Router()
  const postRepo = new PostRepository()
  const controller = new PostsController(
    new CreatePostService(postRepo),
    new ListPostsService(postRepo),
    new GetPostService(postRepo),
    postRepo,
  )

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/', wrap(controller.create.bind(controller)))
  router.get('/:id', wrap(controller.getById.bind(controller)))
  router.put('/:id', wrap(controller.update.bind(controller)))
  router.delete('/:id', wrap(controller.delete.bind(controller)))
  router.post('/:id/files', upload.array('files'), wrap(controller.uploadFiles.bind(controller)))
  router.post('/:id/files/:fileId/replace', upload.single('file'), wrap(controller.replaceFile.bind(controller)))
  router.post('/:id/submit-for-approval', wrap(controller.submitForApproval.bind(controller)))
  router.post('/:id/resubmit', wrap(controller.resubmit.bind(controller)))

  // Approve / reject all files in a post (used by admin override)
  router.post('/:id/approve', wrap(approvalsCtrl.approvePost.bind(approvalsCtrl)))
  router.post('/:id/reject', wrap(approvalsCtrl.rejectPost.bind(approvalsCtrl)))

  return router
}
