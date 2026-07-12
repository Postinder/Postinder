import cors from 'cors'
import express, { Express } from 'express'
import path from 'path'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware } from './shared/middlewares/authMiddleware'
import { adminAuthMiddleware } from './shared/middlewares/adminAuthMiddleware'
import { readOnlyAdminMiddleware } from './shared/middlewares/readOnlyAdminMiddleware'
import { createAuthRoutes } from './modules/auth/presentation/routes/auth.routes'
import { createPostsRoutes } from './modules/posts/presentation/routes/posts.routes'
import { createClientsRoutes } from './modules/clients/presentation/routes/clients.routes'
import { createUsersRoutes } from './modules/users/presentation/routes/users.routes'
import { createApprovalsRoutes, createFilesRoutes, createFeedbackRoutes } from './modules/approvals/presentation/routes/approvals.routes'
import { createActivitiesRoutes } from './modules/activities/presentation/routes/activities.routes'
import { createNotificationsRoutes } from './modules/notifications/presentation/routes/notifications.routes'
import { createPortalRoutes } from './modules/portal/presentation/routes/portal.routes'
import { createClientPortalRoutes } from './modules/portal/presentation/routes/clientPortal.routes'
import { createMaintenanceRoutes } from './modules/maintenance/presentation/routes/maintenance.routes'
import { pool } from './shared/database/pool'
import { env } from './config/environment'
import { checkRemoteStorage } from './shared/upload/storage'

function parseCorsOrigins() {
  return [
    env.APP_PUBLIC_URL,
    ...(env.CORS_ORIGINS || '').split(','),
    'http://localhost:5173',
  ]
    .map(origin => origin?.trim())
    .filter(Boolean) as string[]
}

export function createApp(): Express {
  const app = express()

  const allowedOrigins = parseCorsOrigins()

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
  }))
  app.use(express.json())
  app.use(requestLogger)

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.get('/health/db', async (_req, res) => {
    try {
      const result = await pool.query('SELECT NOW() AS now')
      res.json({ status: 'ok', database: 'connected', timestamp: result.rows[0].now })
    } catch (error: any) {
      res.status(503).json({ status: 'error', database: 'unavailable', error: error.message })
    }
  })

  app.get('/health/storage', async (_req, res) => {
    if (env.NODE_ENV !== 'production') {
      return res.json({ status: 'ok', storage: 'local', path: '/uploads' })
    }

    const result = await checkRemoteStorage()
    if (!result.ok) {
      return res.status(503).json({ status: 'error', storage: 'unavailable', ...result })
    }

    res.json({ status: 'ok', storage: 'supabase', ...result })
  })

  app.use('/api/v1/auth', createAuthRoutes())
  app.use('/api/v1/portal', createPortalRoutes())
  app.use('/api/v1/client-portal', authMiddleware, createClientPortalRoutes())
  app.use('/api/v1/notifications', authMiddleware, createNotificationsRoutes())
  app.use('/api/v1/posts', authMiddleware, adminAuthMiddleware, readOnlyAdminMiddleware, createPostsRoutes())
  app.use('/api/v1/clients', authMiddleware, readOnlyAdminMiddleware, createClientsRoutes())
  app.use('/api/v1/users', authMiddleware, readOnlyAdminMiddleware, createUsersRoutes())
  app.use('/api/v1/approvals', authMiddleware, readOnlyAdminMiddleware, createApprovalsRoutes())
  app.use('/api/v1/files', authMiddleware, readOnlyAdminMiddleware, createFilesRoutes())
  app.use('/api/v1/feedback', authMiddleware, readOnlyAdminMiddleware, createFeedbackRoutes())
  app.use('/api/v1/activities', authMiddleware, readOnlyAdminMiddleware, createActivitiesRoutes())
  app.use('/api/v1/maintenance', authMiddleware, readOnlyAdminMiddleware, createMaintenanceRoutes())

  app.use(errorHandler)

  return app
}
