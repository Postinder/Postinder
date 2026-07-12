import bcrypt from 'bcryptjs'
import { PoolClient } from 'pg'
import { pool } from '../src/shared/database/pool'
import { acquireEmailLock, EmailInUseError, findActiveEmailOwner, normalizeEmail } from '../src/shared/database/emailUniqueness'

const DEMO_ADMIN_EMAIL = 'admin@postinder.local'
const DEMO_CLIENT_EMAIL = 'cliente@example.com'

async function shouldCreateDemoIdentity(client: PoolClient, email: string, expectedOwner: 'user' | 'client') {
  const normalizedEmail = normalizeEmail(email)
  await acquireEmailLock(client, normalizedEmail)
  const owner = await findActiveEmailOwner(client, normalizedEmail)
  if (owner && owner !== expectedOwner) throw new EmailInUseError(owner)
  return !owner
}

async function main() {
  if (process.env.APP_MODE !== 'demo') {
    throw new Error('APP_MODE=demo is required to seed demonstration data')
  }

  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10)
  const clientPasswordHash = await bcrypt.hash('Cliente@123456', 10)

  const client = await pool.connect()
  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true
    if (await shouldCreateDemoIdentity(client, DEMO_ADMIN_EMAIL, 'user')) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, permissions, is_active)
         VALUES ($1, $2, $3, 'admin', $4, true)`,
        ['Administrador Postinder', DEMO_ADMIN_EMAIL, adminPasswordHash, [
          'dashboard', 'clients', 'posts/new', 'posts', 'approvals', 'feed', 'insights', 'users', 'email', 'integrations',
        ]],
      )
    }
    if (await shouldCreateDemoIdentity(client, DEMO_CLIENT_EMAIL, 'client')) {
      await client.query(
        `INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        ['Acme Corp', DEMO_CLIENT_EMAIL, clientPasswordHash, '(11) 99999-9999', 'Tecnologia', '#A7014B', 7],
      )
    }
    await client.query('COMMIT')
    console.log('Demonstration seed completed.')
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
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
