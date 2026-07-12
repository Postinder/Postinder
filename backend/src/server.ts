import { createApp } from './app'
import { env } from './config/environment'
import { getMigrationStatus } from './shared/database/migrationStatus'
import { pool } from './shared/database/pool'
import { logger } from './shared/utils/Logger'

async function start() {
  const migrationStatus = await getMigrationStatus()
  if (migrationStatus.pending.length) {
    const message = `Database schema is behind. Pending migrations: ${migrationStatus.pending.join(', ')}`
    if (env.NODE_ENV === 'production') throw new Error(message)
    logger.warn(`${message}. Run npm run db:migrate before using the application.`)
  }

  const app = createApp()
  app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`)
    logger.info(`Environment: ${env.NODE_ENV}`)
  })
}

start().catch(async error => {
  logger.error(`Database startup validation failed: ${error.message}`)
  await pool.end()
  process.exit(1)
})
