import jwt, { SignOptions } from 'jsonwebtoken'
import { env } from '../../../config/environment'

export class JwtProvider {
  sign(payload: object, expiresIn: string): string {
    const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] }
    return jwt.sign(payload, env.JWT_SECRET, options)
  }

  verify(token: string): any {
    return jwt.verify(token, env.JWT_SECRET)
  }

  decode(token: string): any {
    return jwt.decode(token)
  }
}
