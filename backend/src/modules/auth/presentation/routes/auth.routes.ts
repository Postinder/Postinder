import { Router, Request, Response } from 'express'
import { AuthController } from '../controllers/AuthController'
import { AuthService } from '../../application/services/AuthService'
import { JwtProvider } from '../../infrastructure/JwtProvider'

export function createAuthRoutes(): Router {
  const router = Router()
  const jwtProvider = new JwtProvider()
  const authService = new AuthService(jwtProvider)
  const controller = new AuthController(authService)

  router.post('/login', (req: Request, res: Response) =>
    controller.login(req, res).catch(err => res.status(err.statusCode || 500).json({ error: err.message }))
  )

  router.post('/logout', (req: Request, res: Response) => controller.logout(req, res))

  return router
}
