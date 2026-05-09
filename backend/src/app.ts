import express, { Express } from 'express'
import { requestLogger } from './shared/middlewares/requestLogger'
import { errorHandler } from './shared/middlewares/errorHandler'

export function createApp(): Express {
  const app = express()

  app.use(express.json())
  app.use(requestLogger)

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use(errorHandler)

  return app
}
