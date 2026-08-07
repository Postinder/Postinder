import { pool } from '../src/shared/database/pool'

async function main() {
  const limit = Math.min(Math.max(Number(process.env.STORAGE_AUDIT_LIMIT || 100), 1), 1000)
  const [sharedIdentity, sharedUrl, legacy] = await Promise.all([
    pool.query(
      `SELECT f.bucket, f.storage_path, COUNT(*)::int AS references,
              ARRAY_AGG(DISTINCT f.post_id) AS post_ids,
              ARRAY_AGG(f.id ORDER BY f.id) AS file_ids
       FROM files f
       WHERE f.bucket IS NOT NULL AND f.storage_path IS NOT NULL
       GROUP BY f.bucket, f.storage_path
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC, f.bucket, f.storage_path
       LIMIT $1`,
      [limit],
    ),
    pool.query(
      `SELECT f.url, COUNT(*)::int AS references,
              ARRAY_AGG(DISTINCT f.post_id) AS post_ids,
              ARRAY_AGG(f.id ORDER BY f.id) AS file_ids
       FROM files f
       GROUP BY f.url
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC, f.url
       LIMIT $1`,
      [limit],
    ),
    pool.query(
      `SELECT f.id, f.post_id, f.url, f.bucket, f.storage_path
       FROM files f
       WHERE f.bucket IS NULL OR f.storage_path IS NULL
       ORDER BY f.created_at, f.id
       LIMIT $1`,
      [limit],
    ),
  ])

  console.log(JSON.stringify({
    limit,
    sharedStorageIdentities: sharedIdentity.rows,
    repeatedUrls: sharedUrl.rows,
    legacyFilesWithoutStorageIdentity: legacy.rows,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(() => pool.end())
