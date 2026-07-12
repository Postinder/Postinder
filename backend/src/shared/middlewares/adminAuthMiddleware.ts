import { Response, NextFunction } from 'express'
import { AuthRequest } from './authMiddleware'

export function adminAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.type !== 'admin' || !req.user.userId) {
    return res.status(403).json({ error: 'Administrative access required' })
  }

  next()
}
