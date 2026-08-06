import { Router, Request, Response, NextFunction } from 'express'
import { ClientsController } from '../controllers/ClientsController'
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository'
import { PortalController } from '../../../portal/presentation/controllers/PortalController'

export function createClientsRoutes(): Router {
  const router = Router()
  const clientRepository = new ClientRepository()
  const controller = new ClientsController(clientRepository)
  const portalController = new PortalController()

  router.post('/', (req: Request, res: Response) =>
    controller.create(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.get('/', (req: Request, res: Response) =>
    controller.list(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.get('/:id', (req: Request, res: Response) =>
    controller.getById(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.post('/:id/notify', (req: Request, res: Response) =>
    controller.notify(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.patch('/:id/activate', (req: Request, res: Response) =>
    controller.activate(req as any, res).catch(err => res.status(500).json({ error: err.message }))
  )

  const wrapPortal = (handler: (req: any, res: Response) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => handler(req as any, res).catch(next)

  router.post('/:id/portal-link', wrapPortal(
    portalController.createClientLink.bind(portalController),
  ))

  router.get('/:id/portal-link', wrapPortal(
    portalController.getClientLink.bind(portalController),
  ))

  router.post('/:id/portal-link/replace', wrapPortal(
    portalController.replaceClientLink.bind(portalController),
  ))

  router.put('/:id', (req: Request, res: Response) =>
    controller.update(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.delete('/:id/permanent', (req: Request, res: Response) =>
    controller.deletePermanently(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  router.delete('/:id', (req: Request, res: Response) =>
    controller.delete(req, res).catch(err => res.status(500).json({ error: err.message }))
  )

  return router
}
