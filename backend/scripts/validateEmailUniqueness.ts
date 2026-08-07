async function main() {
  const testDatabaseUrl = process.env.EMAIL_UNIQUENESS_TEST_DATABASE_URL
  if (!testDatabaseUrl) {
    throw new Error('EMAIL_UNIQUENESS_TEST_DATABASE_URL is required')
  }
  if (process.env.EMAIL_UNIQUENESS_TEST_CONFIRM !== 'RUN_ISOLATED_TESTS') {
    throw new Error('Set EMAIL_UNIQUENESS_TEST_CONFIRM=RUN_ISOLATED_TESTS to run this validation')
  }

  process.env.DATABASE_URL = testDatabaseUrl

  const [{ pool }, { UsersRepository }, { ClientRepository }] = await Promise.all([
    import('../src/shared/database/pool'),
    import('../src/modules/users/infrastructure/repositories/UsersRepository'),
    import('../src/modules/clients/infrastructure/repositories/ClientRepository'),
  ])

  const prefix = `email-uniqueness-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const users = new UsersRepository()
  const clients = new ClientRepository()

  function email(label: string) {
    return `${prefix}-${label}@test.invalid`
  }

  async function createUser(address: string) {
    return users.create({
      name: 'Email validation user',
      email: address,
      password: 'Validation@123',
      role: 'viewer',
      permissions: [],
    })
  }

  async function createClient(address: string) {
    return clients.create({
      name: 'Email validation client',
      email: address,
      password_hash: 'validation-password-hash',
    })
  }

  async function assertOneSucceeded(label: string, operations: Promise<unknown>[]) {
    const results = await Promise.allSettled(operations)
    const succeeded = results.filter(result => result.status === 'fulfilled')
    if (succeeded.length !== 1) {
      throw new Error(`${label}: expected exactly one successful operation, received ${succeeded.length}`)
    }
  }

  async function assertOneActive(address: string) {
    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT id FROM users WHERE is_active = true AND LOWER(email) = LOWER($1)
         UNION ALL
         SELECT id FROM clients WHERE is_active = true AND LOWER(email) = LOWER($1)
       ) AS active_identities`,
      [address],
    )
    if (result.rows[0].count !== 1) {
      throw new Error(`Expected exactly one active identity for ${address}`)
    }
  }

  try {
    const crossEmail = email('cross')
    await assertOneSucceeded('user/client race', [createUser(crossEmail), createClient(crossEmail)])
    await assertOneActive(crossEmail)

    const usersEmail = email('users')
    await assertOneSucceeded('user/user race', [createUser(usersEmail), createUser(usersEmail)])
    await assertOneActive(usersEmail)

    const clientsEmail = email('clients')
    await assertOneSucceeded('client/client race', [createClient(clientsEmail), createClient(clientsEmail)])
    await assertOneActive(clientsEmail)

    const reactivationEmail = email('reactivation')
    const inactiveClient = await createClient(reactivationEmail)
    await clients.delete(inactiveClient.id)
    await assertOneSucceeded('reactivation/create race', [
      clients.activate(inactiveClient.id),
      createUser(reactivationEmail),
    ])
    await assertOneActive(reactivationEmail)

    const normalizedEmail = email('normalized')
    await createUser(`  ${normalizedEmail.toUpperCase()}  `)
    const normalizedConflict = await Promise.allSettled([createClient(normalizedEmail)])
    if (normalizedConflict[0].status !== 'rejected') {
      throw new Error('email normalization: expected the equivalent client email to be rejected')
    }
    await assertOneActive(normalizedEmail)

    console.log('Email uniqueness validation completed successfully.')
  } finally {
    await pool.query('UPDATE users SET is_active = false WHERE email LIKE $1', [`${prefix}%`])
    await pool.query('UPDATE clients SET is_active = false WHERE email LIKE $1', [`${prefix}%`])
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
