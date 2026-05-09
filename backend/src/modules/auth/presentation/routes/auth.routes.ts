import { Router, Request, Response } from 'express'
import { AuthController } from '../controllers/AuthController'
import { AuthService } from '../../application/services/AuthService'
import { JwtProvider } from '../../infrastructure/JwtProvider'
import { UserRepository } from '../../infrastructure/repositories/UserRepository'

export function createAuthRoutes(): Router {
  const router = Router()
  const jwtProvider = new JwtProvider()
  const userRepository = new UserRepository()
  const authService = new AuthService(jwtProvider, userRepository)
  const controller = new AuthController(authService)

  router.post('/login', (req: Request, res: Response) =>
    controller.login(req, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
  )

  router.post('/refresh', (req: Request, res: Response) =>
    controller.refresh(req, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
  )

  router.post('/logout', (req: Request, res: Response) => controller.logout(req, res))

  return router
}
