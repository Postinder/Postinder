import { logger } from '../../../../shared/utils/Logger'
import { StorageRetentionCleanupService } from './StorageRetentionCleanupService'

type CleanupRunner = Pick<StorageRetentionCleanupService, 'execute'>
type TimerHandle = ReturnType<typeof setInterval>

export const STORAGE_RETENTION_SCAN_INTERVAL_MS = 60 * 60 * 1000

export class StorageRetentionScheduler {
  private timer: TimerHandle | null = null
  private running = false

  constructor(
    private readonly cleanup: CleanupRunner = new StorageRetentionCleanupService(),
    private readonly intervalMs = STORAGE_RETENTION_SCAN_INTERVAL_MS,
    private readonly schedule: typeof setInterval = setInterval,
    private readonly cancel: typeof clearInterval = clearInterval,
  ) {}

  start() {
    if (this.timer) return
    void this.runOnce()
    this.timer = this.schedule(() => void this.runOnce(), this.intervalMs)
    this.timer.unref?.()
  }

  stop() {
    if (!this.timer) return
    this.cancel(this.timer)
    this.timer = null
  }

  async runOnce() {
    if (this.running) return null
    this.running = true
    try {
      const result = await this.cleanup.execute(50)
      if (result.candidates || result.failures) logger.info('Storage retention scan completed', result)
      return result
    } catch (error) {
      logger.error('Storage retention scan failed', { error })
      return null
    } finally {
      this.running = false
    }
  }
}
