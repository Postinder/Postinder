const REDACTED = '[REDACTED]'
const CIRCULAR = '[Circular]'
const TRUNCATED = '[Truncated]'

const SENSITIVE_KEYS = new Set([
  'token',
  'portaltoken',
  'privatetoken',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'setcookie',
  'password',
  'secret',
  'apikey',
  'clientsecret',
  'providertoken',
  'upstreamrequest',
  'prompt',
  'messages',
])

const PORTAL_PATH_PATTERN = /(\/(?:api\/v1\/)?portal\/)([^/?#\s"'<>]+)/gi
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|portalToken|privateToken|accessToken|refreshToken|authorization|cookie|password|secret|apiKey|clientSecret|providerToken)=)([^&#\s]*)/gi
const LABELED_SECRET_PATTERN = /\b(token|portalToken|privateToken|accessToken|refreshToken|authorization|cookie|password|secret|apiKey|clientSecret|providerToken)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s}\]&]+)/gi
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi
const PORTAL_TOKEN_FORMAT_PATTERN = /\b[a-f0-9]{64}\b/gi

export type LogSanitizerOptions = {
  secrets?: readonly unknown[]
  maxDepth?: number
  maxEntries?: number
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeSecrets(values: readonly unknown[] = []) {
  return [...new Set(
    values
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .filter(value => value !== REDACTED)
      .sort((a, b) => b.length - a.length),
  )]
}

export function extractPortalTokenCandidates(requestTarget: unknown): string[] {
  if (typeof requestTarget !== 'string') return []

  const candidates: string[] = []
  for (const match of requestTarget.matchAll(PORTAL_PATH_PATTERN)) {
    const raw = match[2]
    if (!raw || raw === REDACTED) continue
    candidates.push(raw)
    try {
      const decoded = decodeURIComponent(raw)
      if (decoded !== raw) candidates.push(decoded)
    } catch {
      // The raw path segment is still safe to use as an exact redaction candidate.
    }
  }
  return normalizeSecrets(candidates)
}

export function sanitizeLogText(value: string, options: LogSanitizerOptions = {}): string {
  let sanitized = value
  for (const secret of normalizeSecrets(options.secrets)) {
    sanitized = sanitized.split(secret).join(REDACTED)
  }

  return sanitized
    .replace(PORTAL_PATH_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED}`)
    .replace(LABELED_SECRET_PATTERN, (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(PORTAL_TOKEN_FORMAT_PATTERN, REDACTED)
}

export function sanitizeRequestTarget(requestTarget: unknown): string {
  if (typeof requestTarget !== 'string') return ''
  return sanitizeLogText(requestTarget, {
    secrets: extractPortalTokenCandidates(requestTarget),
  })
}

export function sanitizeForLogging(value: unknown, options: LogSanitizerOptions = {}): unknown {
  const secrets = normalizeSecrets(options.secrets)
  const maxDepth = Math.max(1, options.maxDepth ?? 8)
  const maxEntries = Math.max(1, options.maxEntries ?? 100)
  const seen = new WeakSet<object>()

  function visit(current: unknown, depth: number): unknown {
    if (typeof current === 'string') return sanitizeLogText(current, { secrets })
    if (
      current === null
      || current === undefined
      || typeof current === 'number'
      || typeof current === 'boolean'
    ) return current
    if (typeof current === 'bigint') return current.toString()
    if (typeof current === 'symbol') return current.toString()
    if (typeof current === 'function') return `[Function${current.name ? `: ${current.name}` : ''}]`
    if (Buffer.isBuffer(current)) return `[Buffer redacted: ${current.length} bytes]`
    if (current instanceof Date) return current.toISOString()
    if (depth >= maxDepth) return TRUNCATED
    if (typeof current !== 'object') return sanitizeLogText(String(current), { secrets })
    if (seen.has(current)) return CIRCULAR

    seen.add(current)
    if (current instanceof Error) {
      const serialized: Record<string, unknown> = {
        name: sanitizeLogText(current.name, { secrets }),
        message: sanitizeLogText(current.message, { secrets }),
      }
      if (current.stack) serialized.stack = sanitizeLogText(current.stack, { secrets })
      const errorWithCause = current as Error & { cause?: unknown }
      if (errorWithCause.cause !== undefined) serialized.cause = visit(errorWithCause.cause, depth + 1)
      for (const key of Object.keys(current).slice(0, maxEntries)) {
        if (key in serialized) continue
        serialized[key] = SENSITIVE_KEYS.has(normalizeKey(key))
          ? REDACTED
          : visit((current as unknown as Record<string, unknown>)[key], depth + 1)
      }
      return serialized
    }

    if (Array.isArray(current)) {
      const items = current.slice(0, maxEntries).map(item => visit(item, depth + 1))
      if (current.length > maxEntries) items.push(`[Truncated: ${current.length - maxEntries} items]`)
      return items
    }

    const output: Record<string, unknown> = {}
    const keys = Object.keys(current).slice(0, maxEntries)
    for (const key of keys) {
      if (SENSITIVE_KEYS.has(normalizeKey(key))) {
        output[key] = REDACTED
        continue
      }
      try {
        output[key] = visit((current as Record<string, unknown>)[key], depth + 1)
      } catch {
        output[key] = '[Unreadable]'
      }
    }
    if (Object.keys(current).length > maxEntries) {
      output._truncated = `${Object.keys(current).length - maxEntries} fields`
    }
    return output
  }

  return visit(value, 0)
}

export { REDACTED as LOG_REDACTED_VALUE }
