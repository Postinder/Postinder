import { Router, Request, Response } from 'express'
import { ClientsController } from '../controllers/ClientsController'
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository'

export function createClientsRoutes(): Router {
  const router = Router()
  const clientRepository = new ClientRepository()
  const controller = new ClientsController(clientRepository)

  router.post('/', (req: Request, res: Response) =>
    controller.create(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.get('/', (req: Request, res: Response) =>
    controller.list(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.get('/:id', (req: Request, res: Response) =>
    controller.getById(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.put('/:id', (req: Request, res: Response) =>
    controller.update(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.delete('/:id', (req: Request, res: Response) =>
    controller.delete(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  return router
}
