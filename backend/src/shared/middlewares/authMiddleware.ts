import { Request, Response, NextFunction } from 'express'
import { UnauthorizedException } from '../exceptions/AppException'
import { JwtProvider } from '../../modules/auth/infrastructure/JwtProvider'

export interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

const jwtProvider = new JwtProvider()

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwtProvider.verify(token)
    req.user = payload
    req.tenantId = payload.companyId || payload.clientId || payload.id
    next()
  } catch (error) {
    throw new UnauthorizedException('Invalid or expired token')
  }
}
