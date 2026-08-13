import { Router, Request, Response, NextFunction } from 'express'
import { PostsController } from '../controllers/PostsController'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'
import { upload } from '../../../../shared/upload/multer'
import { soundtrackUpload } from '../../../../shared/upload/multer'
import { SoundtracksController } from '../../../soundtracks/presentation/controllers/SoundtracksController'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req as any, res).catch(next)
}

export function createPostsRoutes(): Router {
  const router = Router()
  const postRepo = new PostRepository()
  const settingsService = new PlatformSettingsService()
  const controller = new PostsController(
    new CreatePostService(postRepo),
    new ListPostsService(postRepo),
    new GetPostService(postRepo),
    postRepo,
    undefined,
    undefined,
    settingsService,
  )
  const soundtracksController = new SoundtracksController(undefined, undefined, settingsService)

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/', wrap(controller.create.bind(controller)))
  router.post('/send-batch-for-approval', wrap(controller.submitBatchForApproval.bind(controller)))
  router.get('/:id', wrap(controller.getById.bind(controller)))
  router.put('/:id', wrap(controller.update.bind(controller)))
  router.delete('/:id', wrap(controller.delete.bind(controller)))
  router.post('/:id/duplicate', wrap(controller.duplicate.bind(controller)))
  router.get('/:id/soundtrack', wrap(soundtracksController.get.bind(soundtracksController)))
  router.put('/:id/soundtrack', wrap(soundtracksController.update.bind(soundtracksController)))
  router.post('/:id/soundtrack/file', soundtrackUpload.single('file'), wrap(soundtracksController.upload.bind(soundtracksController)))
  router.patch('/:id/status', wrap(controller.updateStatus.bind(controller)))
  router.post('/:id/execute', wrap(controller.markExecuted.bind(controller)))
  router.post('/:id/files', upload.array('files'), wrap(controller.uploadFiles.bind(controller)))
  router.patch('/:id/files/reorder', wrap(controller.reorderFiles.bind(controller)))
  router.post('/:id/files/:fileId/replace', upload.single('file'), wrap(controller.replaceFile.bind(controller)))
  router.delete('/:id/files/:fileId', wrap(controller.removeFile.bind(controller)))
  router.post('/:id/submit-for-approval', wrap(controller.submitForApproval.bind(controller)))
  router.post('/:id/send-for-approval', wrap(controller.submitForApproval.bind(controller)))
  router.post('/:id/resubmit', wrap(controller.resubmit.bind(controller)))

  return router
}
