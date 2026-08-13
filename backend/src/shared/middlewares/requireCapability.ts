import { Response, NextFunction } from 'express'
import {
  AdminCapability,
  hasAdminCapability,
} from '../../modules/auth/domain/AdminCapability'
import { resolveAdminRouteCapability } from '../authorization/AdminRoutePolicy'
import { ForbiddenException } from '../exceptions/AppException'
import { AuthRequest } from './authMiddleware'

export function requireCapability(capability: AdminCapability) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!hasAdminCapability(req.user, capability)) {
      return next(new ForbiddenException('Insufficient access'))
    }
    next()
  }
}

export function requireAdminRouteCapability(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const capability = resolveAdminRouteCapability(req.method, req.originalUrl || req.url)
  if (!capability) {
    return next(new ForbiddenException('Insufficient access'))
  }
  return requireCapability(capability)(req, res, next)
}
