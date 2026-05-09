import express, { Express, Request, Response, NextFunction } from 'express'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware, AuthRequest } from './shared/middlewares/authMiddleware'
import { createAuthRoutes } from './modules/auth/presentation/routes/auth.routes'
import { createPostsRoutes } from './modules/posts/presentation/routes/posts.routes'

export function createApp(): Express {
  const app = express()

  app.use(express.json())
  app.use(requestLogger)

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api/v1/auth', createAuthRoutes())

  app.use('/api/v1/posts', authMiddleware, createPostsRoutes())

  app.use(errorHandler)

  return app
}
