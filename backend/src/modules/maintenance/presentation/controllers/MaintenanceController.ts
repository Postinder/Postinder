import { Request, Response } from 'express'
import { pool } from '../../../../shared/database/pool'
import { acquireEmailLock, normalizeEmail } from '../../../../shared/database/emailUniqueness'
import { removeStoredFile } from '../../../../shared/upload/storage'
import { logger } from '../../../../shared/utils/Logger'
import { DemoResetConfiguration, isDemoResetEnabled } from '../../../../config/demoReset'
import { env } from '../../../../config/environment'

interface AuthRequest extends Request {
  user?: any
}

const DEFAULT_ADMIN_PASSWORD_HASH = '$2a$10$mZ7UBznnaEVfUJQySHYiVOq3Bc9C77zqe2z4JQG6mlPOHFU3YYPae'
const DEFAULT_CLIENT_PASSWORD_HASH = '$2a$10$V7UOjiO7mSRpSHNDYdRHYOWiWqqbG3HS9I/aytMm7ZYOfYpUj7UKS'

export interface MaintenanceControllerDependencies {
  pool: Pick<typeof pool, 'query' | 'connect'>
  acquireEmailLock: typeof acquireEmailLock
  normalizeEmail: typeof normalizeEmail
  removeStoredFile: typeof removeStoredFile
  logger: Pick<typeof logger, 'error'>
}

const defaultDependencies: MaintenanceControllerDependencies = {
  pool,
  acquireEmailLock,
  normalizeEmail,
  removeStoredFile,
  logger,
}

export class MaintenanceController {
  constructor(
    private configuration: DemoResetConfiguration = env,
    private dependencies: MaintenanceControllerDependencies = defaultDependencies,
  ) {}

  private ensureAdmin(req: AuthRequest, res: Response) {
    const role = String(req.user?.role || '').trim().toLowerCase()
    if (req.user?.type !== 'admin' || role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' })
      return false
    }
    return true
  }

  async resetDemoData(req: AuthRequest, res: Response) {
    if (!isDemoResetEnabled(this.configuration)) {
      return res.status(404).json({ error: 'Not found' })
    }

    if (!this.ensureAdmin(req, res)) return

    if (String(req.body?.confirmation || '') !== 'RESETAR') {
      return res.status(400).json({ error: 'Type RESETAR to confirm reset' })
    }

    const filesResult = await this.dependencies.pool.query(
      `SELECT bucket, storage_path FROM files
       UNION
       SELECT bucket, storage_path FROM post_soundtracks WHERE storage_path IS NOT NULL`,
    )
    const removals = await Promise.all(filesResult.rows.map(row => this.dependencies.removeStoredFile({
      bucket: row.bucket,
      storagePath: row.storage_path,
    })))
    removals.filter(result => !result.removed).forEach(result => {
      this.dependencies.logger.error('Failed to remove reset storage object', result)
    })

    const client = await this.dependencies.pool.connect()
    try {
      await client.query('BEGIN')
      await this.dependencies.acquireEmailLock(
        client,
        this.dependencies.normalizeEmail('admin@postinder.local'),
      )
      await this.dependencies.acquireEmailLock(
        client,
        this.dependencies.normalizeEmail('cliente@example.com'),
      )
      await client.query('TRUNCATE TABLE notification_reads, activity_events, client_portal_tokens, feedback, post_soundtrack_decisions, post_soundtrack_versions, post_soundtracks, files, posts, clients, users RESTART IDENTITY CASCADE')
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, permissions, is_active)
        VALUES (
          'Administrador Postinder',
          'admin@postinder.local',
          $1,
          'admin',
          ARRAY['dashboard', 'clients', 'posts/new', 'posts', 'approvals', 'feed', 'insights', 'users', 'email', 'integrations'],
          true
        )
      `, [DEFAULT_ADMIN_PASSWORD_HASH])
      await client.query(`
        INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, is_active)
        VALUES (
          'Acme Corp',
          'cliente@example.com',
          $1,
          '(11) 99999-9999',
          'Tecnologia',
          '#A7014B',
          7,
          true
        )
      `, [DEFAULT_CLIENT_PASSWORD_HASH])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    res.json({
      success: true,
      admin: { email: 'admin@postinder.local', password: 'Admin@123456' },
      client: { email: 'cliente@example.com', password: 'Cliente@123456' },
    })
  }
}
