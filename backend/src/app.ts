import express, { Express } from 'express'
import path from 'path'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'
import { authMiddleware } from './shared/middlewares/authMiddleware'
import { createAuthRoutes } from './modules/auth/presentation/routes/auth.routes'
import { createPostsRoutes } from './modules/posts/presentation/routes/posts.routes'
import { createClientsRoutes } from './modules/clients/presentation/routes/clients.routes'
import { createUsersRoutes } from './modules/users/presentation/routes/users.routes'
import { createApprovalsRoutes, createFilesRoutes, createFeedbackRoutes } from './modules/approvals/presentation/routes/approvals.routes'
import { createActivitiesRoutes } from './modules/activities/presentation/routes/activities.routes'
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
  app.use('/api/v1/users', authMiddleware, createUsersRoutes())
  app.use('/api/v1/approvals', authMiddleware, createApprovalsRoutes())
  app.use('/api/v1/files', authMiddleware, createFilesRoutes())
  app.use('/api/v1/feedback', authMiddleware, createFeedbackRoutes())
  app.use('/api/v1/activities', authMiddleware, createActivitiesRoutes())

  app.use(errorHandler)

  // Add original_name column if it doesn't exist (safe to run repeatedly)
  pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id UUID;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
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
    CREATE INDEX IF NOT EXISTS idx_activity_events_client_id ON activity_events(client_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_post_id ON activity_events(post_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
  `).catch(() => {})

  return app
}
