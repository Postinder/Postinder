import { Response, NextFunction } from 'express'
import { AuthRequest } from './authMiddleware'

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

export function readOnlyAdminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const role = String(req.user?.role || '').trim().toLowerCase()
  if (req.user?.type === 'admin' && role === 'viewer' && !READ_METHODS.includes(req.method)) {
    return res.status(403).json({ error: 'Viewer users have read-only access' })
  }

  next()
}
