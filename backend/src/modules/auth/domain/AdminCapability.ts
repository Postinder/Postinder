import { isAdminAccessToken } from './AuthToken'
import { UserRole } from './UserRole'

export const ADMIN_CAPABILITIES = Object.freeze([
  'clients:read',
  'clients:create',
  'clients:update',
  'clients:deactivate',
  'clients:delete',
  'clients:notify',
  'clients:portal-access',
  'admin-users:read',
  'admin-users:create',
  'admin-users:update',
  'admin-users:delete',
  'posts:read',
  'posts:create',
  'posts:update',
  'posts:change-status',
  'posts:submit',
  'posts:resubmit',
  'posts:execute',
  'posts:delete',
  'posts:duplicate',
  'files:upload',
  'files:reorder',
  'files:replace',
  'files:delete',
  'files:review',
  'approvals:read',
  'feedback:create',
  'metrics:read',
  'activities:read',
  'activities:create',
  'notifications:read',
  'notifications:update',
  'soundtracks:read',
  'soundtracks:update',
  'soundtracks:upload',
  'ai-insights:generate',
  'platform-settings:read',
  'platform-settings:update',
  'branding:update',
  'demo-reset:execute',
] as const)

export type AdminCapability = typeof ADMIN_CAPABILITIES[number]

const ADMIN_ROLE_CAPABILITIES = Object.freeze({
  [UserRole.ADMIN]: ADMIN_CAPABILITIES,
  [UserRole.MANAGER]: Object.freeze<AdminCapability[]>([
    'clients:read',
    'clients:create',
    'clients:update',
    'clients:deactivate',
    'clients:notify',
    'clients:portal-access',
    'posts:read',
    'posts:create',
    'posts:update',
    'posts:change-status',
    'posts:submit',
    'posts:resubmit',
    'posts:execute',
    'posts:duplicate',
    'files:upload',
    'files:reorder',
    'files:replace',
    'approvals:read',
    'metrics:read',
    'activities:read',
    'notifications:read',
    'notifications:update',
    'soundtracks:read',
    'soundtracks:update',
    'soundtracks:upload',
    'platform-settings:read',
  ]),
  [UserRole.EDITOR]: Object.freeze<AdminCapability[]>([
    'clients:read',
    'posts:read',
    'posts:create',
    'posts:update',
    'posts:change-status',
    'posts:submit',
    'posts:resubmit',
    'posts:duplicate',
    'files:upload',
    'files:reorder',
    'files:replace',
    'approvals:read',
    'metrics:read',
    'activities:read',
    'notifications:read',
    'notifications:update',
    'soundtracks:read',
    'soundtracks:update',
    'soundtracks:upload',
    'platform-settings:read',
  ]),
  [UserRole.VIEWER]: Object.freeze<AdminCapability[]>([
    'clients:read',
    'posts:read',
    'approvals:read',
    'metrics:read',
    'activities:read',
    'notifications:read',
    'soundtracks:read',
    'platform-settings:read',
  ]),
} satisfies Record<UserRole, readonly AdminCapability[]>)

export function normalizeAdminRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toLowerCase()
  return Object.values(UserRole).includes(normalized as UserRole)
    ? normalized as UserRole
    : null
}

export function isKnownAdminRole(role: unknown): role is UserRole {
  return normalizeAdminRole(role) !== null
}

export function isAdminCapability(capability: unknown): capability is AdminCapability {
  return typeof capability === 'string'
    && (ADMIN_CAPABILITIES as readonly string[]).includes(capability)
}

export function getAdminCapabilities(role: unknown): readonly AdminCapability[] {
  const normalized = normalizeAdminRole(role)
  if (!normalized) return Object.freeze([])
  return Object.freeze([...ADMIN_ROLE_CAPABILITIES[normalized]])
}

export function hasAdminCapability(identity: unknown, capability: unknown): boolean {
  if (!isAdminAccessToken(identity) || !isAdminCapability(capability)) return false
  const role = normalizeAdminRole(identity.role)
  if (!role) return false
  return ADMIN_ROLE_CAPABILITIES[role].includes(capability)
}
