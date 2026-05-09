import { env } from '../../config/environment'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export class Logger {
  private level: number = levels[env.LOG_LEVEL]

  debug(message: string, meta?: any) {
    if (levels.debug >= this.level) console.log('[DEBUG]', message, meta || '')
  }

  info(message: string, meta?: any) {
    if (levels.info >= this.level) console.log('[INFO]', message, meta || '')
  }

  warn(message: string, meta?: any) {
    if (levels.warn >= this.level) console.warn('[WARN]', message, meta || '')
  }

  error(message: string, meta?: any) {
    if (levels.error >= this.level) console.error('[ERROR]', message, meta || '')
  }
}

export const logger = new Logger()
