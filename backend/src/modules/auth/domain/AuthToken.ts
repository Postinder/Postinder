import { UserRole } from './UserRole'

const ADMIN_ROLES = new Set<string>(Object.values(UserRole))

export interface AdminAccessToken {
  type: 'admin'
  userId: string
  email: string
  role: string
  companyId?: string | null
  permissions?: string[]
}

export interface ClientAccessToken {
  type: 'client'
  clientId: string
  email: string
  companyId?: string | null
}

export interface AdminRefreshToken {
  type: 'refresh'
  context: 'admin'
  userId: string
  email: string
}

export interface ClientRefreshToken {
  type: 'refresh'
  context: 'client'
  clientId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isAdminAccessToken(payload: unknown): payload is AdminAccessToken {
  if (!isRecord(payload)) return false

  const role = isNonEmptyString(payload.role) ? payload.role.trim().toLowerCase() : ''
  return payload.type === 'admin'
    && isNonEmptyString(payload.userId)
    && isNonEmptyString(payload.email)
    && ADMIN_ROLES.has(role)
}

export function isClientAccessToken(payload: unknown): payload is ClientAccessToken {
  return isRecord(payload)
    && payload.type === 'client'
    && isNonEmptyString(payload.clientId)
    && isNonEmptyString(payload.email)
}

export function isAdminRefreshToken(payload: unknown): payload is AdminRefreshToken {
  return isRecord(payload)
    && payload.type === 'refresh'
    && payload.context === 'admin'
    && isNonEmptyString(payload.userId)
    && isNonEmptyString(payload.email)
    && !isNonEmptyString(payload.clientId)
}

export function isClientRefreshToken(payload: unknown): payload is ClientRefreshToken {
  return isRecord(payload)
    && payload.type === 'refresh'
    && payload.context === 'client'
    && isNonEmptyString(payload.clientId)
    && !isNonEmptyString(payload.userId)
}
