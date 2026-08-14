export const POST_REVISION_TEST_CONFIRMATION = 'RUN_ISOLATED_TESTS' as const

export type PostRevisionTestDatabaseConfig = Readonly<{
  enabled: boolean
  databaseUrl?: string
  databaseName?: string
  hostname?: string
}>

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const OVERRIDING_CONNECTION_PARAMETERS = ['database', 'dbname', 'host', 'hostaddr']

function invalidConfiguration(message: string): never {
  throw new Error(`Unsafe post revision integration database configuration: ${message}`)
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

/**
 * Resolves the destructive PostgreSQL integration-test target without opening a
 * socket. Call this before importing the application's database pool.
 */
export function resolvePostRevisionTestDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): PostRevisionTestDatabaseConfig {
  if (environment.POST_REVISION_INTEGRATION !== '1') {
    return Object.freeze({ enabled: false })
  }

  if (environment.POST_REVISION_TEST_CONFIRM !== POST_REVISION_TEST_CONFIRMATION) {
    invalidConfiguration(
      `POST_REVISION_TEST_CONFIRM must equal ${POST_REVISION_TEST_CONFIRMATION}`,
    )
  }

  const rawDatabaseUrl = environment.POST_REVISION_TEST_DATABASE_URL?.trim()
  if (!rawDatabaseUrl) {
    invalidConfiguration('POST_REVISION_TEST_DATABASE_URL is required')
  }

  let databaseUrl: URL
  try {
    databaseUrl = new URL(rawDatabaseUrl)
  } catch {
    invalidConfiguration('POST_REVISION_TEST_DATABASE_URL must be a valid PostgreSQL URL')
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    invalidConfiguration('POST_REVISION_TEST_DATABASE_URL must use postgres:// or postgresql://')
  }

  for (const parameter of OVERRIDING_CONNECTION_PARAMETERS) {
    if (databaseUrl.searchParams.has(parameter)) {
      invalidConfiguration(`connection parameter ${parameter} is not allowed in the test URL`)
    }
  }

  const hostname = normalizeHostname(databaseUrl.hostname)
  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    invalidConfiguration('the PostgreSQL host must be localhost, 127.0.0.1, or ::1')
  }

  let databaseName: string
  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
  } catch {
    invalidConfiguration('the PostgreSQL database name is not valid URL encoding')
  }
  if (!databaseName || databaseName.includes('/') || !databaseName.endsWith('_test')) {
    invalidConfiguration('the PostgreSQL database name must end with _test')
  }

  return Object.freeze({
    enabled: true,
    databaseUrl: rawDatabaseUrl,
    databaseName,
    hostname,
  })
}
