import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { Pool, PoolClient } from 'pg'
import { listStructuralMigrationFiles } from '../src/shared/database/migrationCatalog'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required to run migrations.')
  process.exit(1)
}

const migrationsDir = path.resolve(process.cwd(), '..', 'database', 'migrations')
const isProduction = process.env.NODE_ENV === 'production'
const migrationLockName = 'postinder:database:migrations'

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
})

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function getAppliedMigrations(client: PoolClient) {
  const result = await client.query('SELECT filename FROM schema_migrations')
  return new Set(result.rows.map(row => row.filename))
}

async function runMigration(client: PoolClient, filename: string) {
  const filePath = path.join(migrationsDir, filename)
  const sql = await fs.readFile(filePath, 'utf8')

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
  }
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [migrationLockName])
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)
    const files = await listStructuralMigrationFiles()

    console.log('Skipping 002_development_seed.sql; run the explicit demo seed command when needed.')
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file}`)
        continue
      }
      await runMigration(client, file)
    }

    console.log('Database migrations completed.')
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [migrationLockName])
    } finally {
      client.release()
    }
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
