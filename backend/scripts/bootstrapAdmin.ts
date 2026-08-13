import bcrypt from 'bcryptjs'
import { pool } from '../src/shared/database/pool'
import { acquireEmailLock, assertActiveEmailAvailable, normalizeEmail } from '../src/shared/database/emailUniqueness'

async function main() {
  const name = String(process.env.INITIAL_ADMIN_NAME || '').trim()
  const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL || '')
  const password = String(process.env.INITIAL_ADMIN_PASSWORD || '')
  if (!name || !email || !password) {
    throw new Error('INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const client = await pool.connect()
  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true
    await acquireEmailLock(client, email)
    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE is_active = true AND LOWER(role) = 'admin' LIMIT 1",
    )
    if (existingAdmin.rows[0]) {
      await client.query('COMMIT')
      transactionStarted = false
      console.log('An active admin already exists; bootstrap skipped.')
      return
    }

    await assertActiveEmailAvailable(client, email)

    await client.query(
      `INSERT INTO users (name, email, password_hash, role, permissions, is_active)
       VALUES ($1, $2, $3, 'admin', $4, true)`,
      [name, email, passwordHash, [
        'dashboard', 'clients', 'posts/new', 'posts', 'approvals', 'feed', 'insights', 'users', 'email', 'integrations',
      ]],
    )
    await client.query('COMMIT')
    transactionStarted = false
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  console.log('Initial admin bootstrap completed.')
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
