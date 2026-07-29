import cors from 'cors'
import express, { Express, Router } from 'express'
import path from 'path'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware } from './shared/middlewares/authMiddleware'
import { adminAuthMiddleware } from './shared/middlewares/adminAuthMiddleware'
import { clientAuthMiddleware } from './shared/middlewares/clientAuthMiddleware'
import { requireAdminRouteCapability } from './shared/middlewares/requireCapability'
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
import { env, Environment } from './config/environment'
import { checkRemoteStorage } from './shared/upload/storage'
import { getDemoResetAvailability } from './config/demoReset'
import { MaintenanceController } from './modules/maintenance/presentation/controllers/MaintenanceController'
import { logger } from './shared/utils/Logger'
import { PortalController } from './modules/portal/presentation/controllers/PortalController'
import { AIInsightsController } from './modules/integrations/presentation/controllers/AIInsightsController'
import { createIntegrationsRoutes } from './modules/integrations/presentation/routes/integrations.routes'

export interface AppOptions {
  runtimeEnvironment?: Environment
  maintenanceController?: MaintenanceController
  portalController?: PortalController
  aiInsightsController?: AIInsightsController
}

function parseCorsOrigins(runtimeEnvironment: Environment) {
  return [
    runtimeEnvironment.APP_PUBLIC_URL,
    ...(runtimeEnvironment.CORS_ORIGINS || '').split(','),
    'http://localhost:5173',
  ]
    .map(origin => origin?.trim())
    .filter(Boolean) as string[]
}

export function createApp(options: AppOptions = {}): Express {
  const app = express()
  const runtimeEnvironment = options.runtimeEnvironment || env

  const allowedOrigins = parseCorsOrigins(runtimeEnvironment)

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
    if (runtimeEnvironment.NODE_ENV !== 'production') {
      return res.json({ status: 'ok', storage: 'local', path: '/uploads' })
    }

    const result = await checkRemoteStorage()
    if (!result.ok) {
      return res.status(503).json({ status: 'error', storage: 'unavailable', ...result })
    }

    res.json({ status: 'ok', storage: 'supabase', ...result })
  })

  app.use('/api/v1/auth', createAuthRoutes())
  app.use('/api/v1/portal', createPortalRoutes(options.portalController))
  app.all('/api/v1/portal/*', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
  })
  app.use('/api/v1/client-portal', authMiddleware, clientAuthMiddleware, createClientPortalRoutes())

  const demoResetAvailability = getDemoResetAvailability(runtimeEnvironment)
  const demoResetEnabled = demoResetAvailability.enabled
  if (demoResetAvailability.reason === 'invalid-deployment-mode') {
    logger.warn('Demo reset disabled because DEPLOYMENT_MODE is invalid')
  }
  if (!demoResetEnabled) {
    app.all('/api/v1/maintenance/reset-demo-data', (_req, res) => {
      res.status(404).json({ error: 'Not found' })
    })
  }

  const adminRoutes = Router()
  adminRoutes.use(authMiddleware, adminAuthMiddleware, requireAdminRouteCapability)
  adminRoutes.use('/notifications', createNotificationsRoutes())
  adminRoutes.use('/posts', createPostsRoutes())
  adminRoutes.use('/clients', createClientsRoutes())
  adminRoutes.use('/users', createUsersRoutes())
  adminRoutes.use('/approvals', createApprovalsRoutes())
  adminRoutes.use('/files', createFilesRoutes())
  adminRoutes.use('/feedback', createFeedbackRoutes())
  adminRoutes.use('/activities', createActivitiesRoutes())
  adminRoutes.use(
    '/integrations',
    createIntegrationsRoutes(runtimeEnvironment, options.aiInsightsController),
  )
  if (demoResetEnabled) {
    adminRoutes.use(
      '/maintenance',
      createMaintenanceRoutes(runtimeEnvironment, options.maintenanceController),
    )
  }
  app.use('/api/v1', adminRoutes)

  app.use(errorHandler)

  return app
}
