import { Pool } from 'pg'
import { env } from '../../config/environment'

function getDatabaseUrl() {
  if (env.NODE_ENV !== 'production') return env.DATABASE_URL

  const url = new URL(env.DATABASE_URL)
  url.searchParams.delete('sslmode')
  return url.toString()
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
