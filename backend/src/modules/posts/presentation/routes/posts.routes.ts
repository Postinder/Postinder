import { Router, Request, Response } from 'express'
import { PostsController } from '../controllers/PostsController'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'

export function createPostsRoutes(): Router {
  const router = Router()
  const postRepo = new PostRepository()
  const createService = new CreatePostService(postRepo)
  const listService = new ListPostsService(postRepo)
  const getService = new GetPostService(postRepo)
  const controller = new PostsController(createService, listService, getService)

  router.get('/', (req: Request, res: Response) =>
    controller.list(req as any, res).catch(err => res.status(500).json({ error: err.message }))
  )
  router.post('/', (req: Request, res: Response) =>
    controller.create(req as any, res).catch(err => res.status(500).json({ error: err.message }))
  )
  router.get('/:id', (req: Request, res: Response) =>
    controller.getById(req as any, res).catch(err => res.status(500).json({ error: err.message }))
  )

  return router
}
