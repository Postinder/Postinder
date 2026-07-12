import { pool } from '../src/shared/database/pool'
import { removeStoredFile } from '../src/shared/upload/storage'

async function main() {
  const files = await pool.query(
    `SELECT DISTINCT f.bucket, f.storage_path
     FROM files f
     JOIN posts p ON p.id = f.post_id
     WHERE p.status = 'archived'
       AND NOT EXISTS (
         SELECT 1
         FROM files shared_file
         JOIN posts shared_post ON shared_post.id = shared_file.post_id
         WHERE shared_file.url = f.url
           AND shared_post.status <> 'archived'
       )`,
  )

  const removals = await Promise.all(files.rows.map(row => removeStoredFile({
    bucket: row.bucket,
    storagePath: row.storage_path,
  })))
  removals.filter(result => !result.removed).forEach(result => {
    console.error('Failed to remove legacy storage object', result)
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const archived = await client.query(`SELECT id FROM posts WHERE status = 'archived'`)
    const postIds = archived.rows.map(row => row.id)

    if (postIds.length) {
      await client.query(`DELETE FROM activity_events WHERE post_id = ANY($1::uuid[])`, [postIds])
      const postNotesExists = await client.query(`SELECT to_regclass('public.post_notes') AS table_name`)
      if (postNotesExists.rows[0]?.table_name) {
        await client.query(`DELETE FROM post_notes WHERE post_id = ANY($1::uuid[])`, [postIds])
      }
      await client.query(`DELETE FROM notification_reads WHERE notification_id = ANY($1::text[])`, [
        postIds.flatMap(id => [`pending-${id}`, `correction-${id}`, `rejected-${id}`]),
      ])
      await client.query(`DELETE FROM posts WHERE id = ANY($1::uuid[])`, [postIds])
    }

    await client.query('COMMIT')
    console.log(`Removed ${postIds.length} legacy archived post(s) and ${files.rows.length} unshared storage object(s).`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
