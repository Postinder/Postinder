import { createApp } from './app'
import { env } from './config/environment'
import { logger } from './shared/utils/Logger'

const app = createApp()

app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`)
  logger.info(`📝 Environment: ${env.NODE_ENV}`)
})
