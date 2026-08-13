import { Response, NextFunction } from 'express'
import { isClientAccessToken } from '../../modules/auth/domain/AuthToken'
import { ForbiddenException } from '../exceptions/AppException'
import { AuthRequest } from './authMiddleware'

export function clientAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!isClientAccessToken(req.user)) {
    return next(new ForbiddenException('Client access required'))
  }

  next()
}
