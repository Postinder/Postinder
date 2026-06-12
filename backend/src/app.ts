import cors from 'cors'
import express, { Express } from 'express'
import path from 'path'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware } from './shared/middlewares/authMiddleware'
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
  app.use('/api/v1/posts', authMiddleware, readOnlyAdminMiddleware, createPostsRoutes())
  app.use('/api/v1/clients', authMiddleware, readOnlyAdminMiddleware, createClientsRoutes())
  app.use('/api/v1/users', authMiddleware, readOnlyAdminMiddleware, createUsersRoutes())
  app.use('/api/v1/approvals', authMiddleware, readOnlyAdminMiddleware, createApprovalsRoutes())
  app.use('/api/v1/files', authMiddleware, readOnlyAdminMiddleware, createFilesRoutes())
  app.use('/api/v1/feedback', authMiddleware, readOnlyAdminMiddleware, createFeedbackRoutes())
  app.use('/api/v1/activities', authMiddleware, readOnlyAdminMiddleware, createActivitiesRoutes())

  app.use(errorHandler)

  // Add original_name column if it doesn't exist (safe to run repeatedly)
  pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id UUID;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMP;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
    ALTER TABLE files ADD COLUMN IF NOT EXISTS sort_order INTEGER;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS formats JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS funnel_tag VARCHAR(100);
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS email_link TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
    CREATE TABLE IF NOT EXISTS activity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID,
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
      actor_id UUID,
      actor_role VARCHAR(50),
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_activity_events_company_id ON activity_events(company_id);
    CREATE INDEX IF NOT EXISTS idx_files_post_sort_order ON files(post_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_activity_events_client_id ON activity_events(client_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_post_id ON activity_events(post_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
    CREATE TABLE IF NOT EXISTS notification_reads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID,
      user_id UUID NOT NULL,
      notification_id VARCHAR(255) NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, notification_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
    CREATE INDEX IF NOT EXISTS idx_notification_reads_company_id ON notification_reads(company_id);
    CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      company_id UUID,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      last_used_at TIMESTAMP,
      created_by UUID,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_client_id ON client_portal_tokens(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_hash ON client_portal_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_expires_at ON client_portal_tokens(expires_at);
  `).catch(() => {})

  return app
}
