import { Request, Response, NextFunction } from 'express'
import { AppException } from '../exceptions/AppException'
import { logger } from '../utils/Logger'
import {
  extractPortalTokenCandidates,
  sanitizeForLogging,
  sanitizeLogText,
  sanitizeRequestTarget,
} from '../utils/logSanitizer'
import { ZodError } from 'zod'
import multer from 'multer'

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestTarget = req.originalUrl || req.url || req.path
  const secrets = extractPortalTokenCandidates(requestTarget)
  const safeText = (value: string) => sanitizeLogText(value, { secrets })
  logger.error('Request error', sanitizeForLogging({
    method: req.method,
    path: sanitizeRequestTarget(requestTarget),
    error,
  }, { secrets }))

  if (error instanceof AppException) {
    return res.status(error.statusCode).json({
      error: safeText(error.message),
      code: error.code,
    })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: sanitizeForLogging(error.errors, { secrets }),
    })
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const isSoundtrack = req.path.includes('/soundtrack')
      const isBranding = req.path.includes('/branding')
      return res.status(413).json({
        error: isBranding
          ? 'O logo excede o limite de 2 MB.'
          : isSoundtrack
            ? 'O arquivo de audio excede o limite de 50 MB.'
            : 'O arquivo excede o limite de 200 MB.',
        code: 'FILE_TOO_LARGE',
      })
    }

    return res.status(400).json({
      error: 'Não foi possível processar o arquivo enviado.',
      code: error.code,
    })
  }

  if (error.message.startsWith('Tipo de arquivo')) {
    return res.status(415).json({
      error: safeText(error.message),
      code: 'UNSUPPORTED_FILE_TYPE',
    })
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  })
}
