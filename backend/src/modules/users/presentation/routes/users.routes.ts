import { Router, Request, Response } from 'express'
import { UsersRepository } from '../../infrastructure/repositories/UsersRepository'
import { UsersController } from '../controllers/UsersController'

function wrap(fn: (req: any, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => fn(req as any, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
}

export function createUsersRoutes(): Router {
  const router = Router()
  const controller = new UsersController(new UsersRepository())

  router.get('/', wrap(controller.list.bind(controller)))
  router.post('/', wrap(controller.create.bind(controller)))
  router.put('/:id', wrap(controller.update.bind(controller)))
  router.delete('/:id', wrap(controller.delete.bind(controller)))

  return router
}
