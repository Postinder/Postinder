import { PoolClient } from 'pg'

export type ActiveEmailOwner = 'user' | 'client'

export class EmailInUseError extends Error {
  constructor(public readonly owner?: ActiveEmailOwner) {
    super('Email already exists')
    this.name = 'EmailInUseError'
  }
}

export function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

export async function acquireEmailLock(client: PoolClient, normalizedEmail: string) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`email:${normalizedEmail}`],
  )
}

export async function findActiveEmailOwner(
  client: PoolClient,
  normalizedEmail: string,
  exclude: { userId?: string; clientId?: string } = {},
): Promise<ActiveEmailOwner | null> {
  const result = await client.query<{ owner: ActiveEmailOwner }>(
    `SELECT owner
     FROM (
       SELECT 'user'::text AS owner
       FROM users
       WHERE is_active = true
         AND LOWER(email) = $1
         AND ($2::uuid IS NULL OR id <> $2)
       UNION ALL
       SELECT 'client'::text AS owner
       FROM clients
       WHERE is_active = true
         AND LOWER(email) = $1
         AND ($3::uuid IS NULL OR id <> $3)
     ) AS active_email_owners
     LIMIT 1`,
    [normalizedEmail, exclude.userId || null, exclude.clientId || null],
  )

  return result.rows[0]?.owner || null
}

export async function assertActiveEmailAvailable(
  client: PoolClient,
  email: string,
  exclude: { userId?: string; clientId?: string } = {},
) {
  const normalizedEmail = normalizeEmail(email)
  await acquireEmailLock(client, normalizedEmail)
  const owner = await findActiveEmailOwner(client, normalizedEmail, exclude)
  if (owner) throw new EmailInUseError(owner)
  return normalizedEmail
}

export function isEmailConflict(error: any) {
  return error instanceof EmailInUseError || error?.code === '23505'
}
