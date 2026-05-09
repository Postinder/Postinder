import jwt from 'jsonwebtoken'
import { env } from '../../../config/environment'

export class JwtProvider {
  sign(payload: any, expiresIn: string): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn })
  }

  verify(token: string): any {
    return jwt.verify(token, env.JWT_SECRET)
  }

  decode(token: string): any {
    return jwt.decode(token)
  }
}
