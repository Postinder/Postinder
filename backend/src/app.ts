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

  app.use(errorHandler)

  // Add original_name column if it doesn't exist (safe to run repeatedly)
  pool.query(`
    ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS formats JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS funnel_tag VARCHAR(100);
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS email_link TEXT;
  `).catch(() => {})

  // Keep local/manual databases compatible with approval-link auth.
  pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS client_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `))
    .then(() => pool.query(`
      INSERT INTO client_tokens (client_id, token, slug)
      SELECT c.id, gen_random_uuid()::text, replace(gen_random_uuid()::text, '-', '')
      FROM clients c
      WHERE c.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM client_tokens ct
          WHERE ct.client_id = c.id AND ct.revoked_at IS NULL
        )
      ON CONFLICT DO NOTHING
    `))
    .catch(() => {})

  return app
}
