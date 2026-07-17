import { Request, Response, NextFunction } from 'express'
import { AppException } from '../exceptions/AppException'
import { logger } from '../utils/Logger'
import { ZodError } from 'zod'
import multer from 'multer'

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  logger.error('Request error', { path: req.path, error: error.message })

  if (error instanceof AppException) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors,
    })
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'O arquivo excede o limite de 200 MB.',
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
      error: error.message,
      code: 'UNSUPPORTED_FILE_TYPE',
    })
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  })
}
