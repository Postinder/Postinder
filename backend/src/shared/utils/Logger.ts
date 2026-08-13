import { env } from '../../config/environment'
import { sanitizeForLogging, sanitizeLogText } from './logSanitizer'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export class Logger {
  private level: number = levels[env.LOG_LEVEL]

  debug(message: string, meta?: any) {
    if (levels.debug >= this.level) console.log('[DEBUG]', sanitizeLogText(message), meta === undefined ? '' : sanitizeForLogging(meta))
  }

  info(message: string, meta?: any) {
    if (levels.info >= this.level) console.log('[INFO]', sanitizeLogText(message), meta === undefined ? '' : sanitizeForLogging(meta))
  }

  warn(message: string, meta?: any) {
    if (levels.warn >= this.level) console.warn('[WARN]', sanitizeLogText(message), meta === undefined ? '' : sanitizeForLogging(meta))
  }

  error(message: string, meta?: any) {
    if (levels.error >= this.level) console.error('[ERROR]', sanitizeLogText(message), meta === undefined ? '' : sanitizeForLogging(meta))
  }
}

export const logger = new Logger()
