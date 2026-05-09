import express, { Express } from 'express'
import path from 'path'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware } from './shared/middlewares/authMiddleware'
import { createAuthRoutes } from './modules/auth/presentation/routes/auth.routes'
import { createPostsRoutes } from './modules/posts/presentation/routes/posts.routes'
import { createClientsRoutes } from './modules/clients/presentation/routes/clients.routes'
import { createApprovalsRoutes, createFilesRoutes, createFeedbackRoutes } from './modules/approvals/presentation/routes/approvals.routes'
import { pool } from './shared/database/pool'

export function createApp(): Express {
  const app = express()

  app.use(express.json())
  app.use(requestLogger)

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api/v1/auth', createAuthRoutes())
  app.use('/api/v1/posts', authMiddleware, createPostsRoutes())
  app.use('/api/v1/clients', authMiddleware, createClientsRoutes())
  app.use('/api/v1/approvals', authMiddleware, createApprovalsRoutes())
  app.use('/api/v1/files', authMiddleware, createFilesRoutes())
  app.use('/api/v1/feedback', authMiddleware, createFeedbackRoutes())

  app.use(errorHandler)

  // Add original_name column if it doesn't exist (safe to run repeatedly)
  pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255)`)
    .catch(() => {})

  return app
}
