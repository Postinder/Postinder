import { StorageRetentionCleanupService } from '../src/modules/posts/application/services/StorageRetentionCleanupService'
import { pool } from '../src/shared/database/pool'

async function main() {
  const result = await new StorageRetentionCleanupService().execute()
  console.log(JSON.stringify(result, null, 2))
  if (result.failures) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(() => pool.end())
