import crypto from 'crypto'
import { env } from '../../../config/environment'

const VERSION = 'v1'

function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(`postinder:portal-token:${VERSION}:${env.JWT_SECRET}`)
    .digest()
}

export function encryptPortalToken(token: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptPortalToken(value?: string | null) {
  if (!value) return null
  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split('.')
    if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}
