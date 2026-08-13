import { createApp } from './app'
import { env } from './config/environment'
import { getMigrationStatus } from './shared/database/migrationStatus'
import { pool } from './shared/database/pool'
import { logger } from './shared/utils/Logger'
import { StorageRetentionScheduler } from './modules/posts/application/services/StorageRetentionScheduler'

async function start() {
  const migrationStatus = await getMigrationStatus()
  if (migrationStatus.pending.length) {
    const message = `Database schema is behind. Pending migrations: ${migrationStatus.pending.join(', ')}`
    if (env.NODE_ENV === 'production') throw new Error(message)
    logger.warn(`${message}. Run npm run db:migrate before using the application.`)
  }

  const app = createApp()
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`)
    logger.info(`Environment: ${env.NODE_ENV}`)
  })
  const retentionScheduler = new StorageRetentionScheduler()
  retentionScheduler.start()

  const shutdown = () => {
    retentionScheduler.stop()
    server.close(() => void pool.end())
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

start().catch(async error => {
  logger.error(`Database startup validation failed: ${error.message}`)
  await pool.end()
  process.exit(1)
})
