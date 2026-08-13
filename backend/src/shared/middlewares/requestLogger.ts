import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/Logger'
import { sanitizeRequestTarget } from '../utils/logSanitizer'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('HTTP request completed', {
      method: req.method,
      path: sanitizeRequestTarget(req.originalUrl || req.url || req.path),
      statusCode: res.statusCode,
      durationMs: duration,
    })
  })
  next()
}
