import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { Pool } from 'pg'

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required to run migrations.')
  process.exit(1)
}

const migrationsDir = path.resolve(process.cwd(), '..', 'database', 'migrations')
const isProduction = process.env.NODE_ENV === 'production'

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
})

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT filename FROM schema_migrations')
  return new Set(result.rows.map(row => row.filename))
}

async function runMigration(filename: string) {
  const filePath = path.join(migrationsDir, filename)
  const sql = await fs.readFile(filePath, 'utf8')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [filename],
    )
    await client.query('COMMIT')
    console.log(`Applied ${filename}`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`Failed to apply ${filename}`)
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()
  const files = (await fs.readdir(migrationsDir))
    .filter(file => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`)
      continue
    }
    await runMigration(file)
  }

  console.log('Database migrations completed.')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
