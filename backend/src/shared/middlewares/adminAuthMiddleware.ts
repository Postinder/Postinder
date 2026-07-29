import { Response, NextFunction } from 'express'
import { isAdminAccessToken } from '../../modules/auth/domain/AuthToken'
import { ForbiddenException } from '../exceptions/AppException'
import { AuthRequest } from './authMiddleware'

export function adminAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!isAdminAccessToken(req.user)) {
    return next(new ForbiddenException('Administrative access required'))
  }

  next()
}
