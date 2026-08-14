import { AdminCapability } from '../../modules/auth/domain/AdminCapability'

export type AdminRoutePolicy = Readonly<{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: `/api/v1/${string}`
  capability: AdminCapability
}>

export const ADMIN_ROUTE_POLICIES = Object.freeze<readonly AdminRoutePolicy[]>([
  { method: 'GET', path: '/api/v1/notifications', capability: 'notifications:read' },
  { method: 'POST', path: '/api/v1/notifications/read', capability: 'notifications:update' },
  { method: 'POST', path: '/api/v1/notifications/read-all', capability: 'notifications:update' },

  { method: 'GET', path: '/api/v1/posts', capability: 'posts:read' },
  { method: 'POST', path: '/api/v1/posts', capability: 'posts:create' },
  { method: 'POST', path: '/api/v1/posts/send-batch-for-approval', capability: 'posts:submit' },
  { method: 'GET', path: '/api/v1/posts/:id', capability: 'posts:read' },
  { method: 'PUT', path: '/api/v1/posts/:id', capability: 'posts:update' },
  { method: 'DELETE', path: '/api/v1/posts/:id', capability: 'posts:delete' },
  { method: 'POST', path: '/api/v1/posts/:id/duplicate', capability: 'posts:duplicate' },
  { method: 'GET', path: '/api/v1/posts/:id/soundtrack', capability: 'soundtracks:read' },
  { method: 'PUT', path: '/api/v1/posts/:id/soundtrack', capability: 'soundtracks:update' },
  { method: 'POST', path: '/api/v1/posts/:id/soundtrack/file', capability: 'soundtracks:upload' },
  { method: 'PATCH', path: '/api/v1/posts/:id/status', capability: 'posts:change-status' },
  { method: 'POST', path: '/api/v1/posts/:id/execute', capability: 'posts:execute' },
  { method: 'POST', path: '/api/v1/posts/:id/reopen-for-editing', capability: 'posts:update' },
  { method: 'POST', path: '/api/v1/posts/:id/files', capability: 'files:upload' },
  { method: 'PATCH', path: '/api/v1/posts/:id/files/reorder', capability: 'files:reorder' },
  { method: 'POST', path: '/api/v1/posts/:id/files/:fileId/replace', capability: 'files:replace' },
  { method: 'DELETE', path: '/api/v1/posts/:id/files/:fileId', capability: 'files:delete' },
  { method: 'POST', path: '/api/v1/posts/:id/submit-for-approval', capability: 'posts:submit' },
  { method: 'POST', path: '/api/v1/posts/:id/send-for-approval', capability: 'posts:submit' },
  { method: 'POST', path: '/api/v1/posts/:id/resubmit', capability: 'posts:resubmit' },

  { method: 'GET', path: '/api/v1/clients', capability: 'clients:read' },
  { method: 'POST', path: '/api/v1/clients', capability: 'clients:create' },
  { method: 'GET', path: '/api/v1/clients/:id', capability: 'clients:read' },
  { method: 'POST', path: '/api/v1/clients/:id/notify', capability: 'clients:notify' },
  { method: 'PATCH', path: '/api/v1/clients/:id/activate', capability: 'clients:update' },
  { method: 'GET', path: '/api/v1/clients/:id/portal-link', capability: 'clients:portal-access' },
  { method: 'POST', path: '/api/v1/clients/:id/portal-link', capability: 'clients:portal-access' },
  { method: 'POST', path: '/api/v1/clients/:id/portal-link/replace', capability: 'clients:portal-access' },
  { method: 'PUT', path: '/api/v1/clients/:id', capability: 'clients:update' },
  { method: 'DELETE', path: '/api/v1/clients/:id/permanent', capability: 'clients:delete' },
  { method: 'DELETE', path: '/api/v1/clients/:id', capability: 'clients:deactivate' },

  { method: 'GET', path: '/api/v1/users', capability: 'admin-users:read' },
  { method: 'POST', path: '/api/v1/users', capability: 'admin-users:create' },
  { method: 'PUT', path: '/api/v1/users/:id', capability: 'admin-users:update' },
  { method: 'DELETE', path: '/api/v1/users/:id', capability: 'admin-users:delete' },

  { method: 'GET', path: '/api/v1/approvals/queue', capability: 'approvals:read' },
  { method: 'POST', path: '/api/v1/files/:id/approve', capability: 'files:review' },
  { method: 'POST', path: '/api/v1/files/:id/reject', capability: 'files:review' },
  { method: 'GET', path: '/api/v1/feedback/monthly', capability: 'metrics:read' },
  { method: 'POST', path: '/api/v1/feedback', capability: 'feedback:create' },
  { method: 'GET', path: '/api/v1/activities', capability: 'activities:read' },
  { method: 'POST', path: '/api/v1/activities', capability: 'activities:create' },

  { method: 'POST', path: '/api/v1/integrations/ai-insights', capability: 'ai-insights:generate' },

  { method: 'GET', path: '/api/v1/platform-settings', capability: 'platform-settings:read' },
  { method: 'PATCH', path: '/api/v1/platform-settings', capability: 'platform-settings:update' },

  { method: 'POST', path: '/api/v1/branding/logo', capability: 'branding:update' },
  { method: 'DELETE', path: '/api/v1/branding/logo', capability: 'branding:update' },

  { method: 'POST', path: '/api/v1/maintenance/reset-demo-data', capability: 'demo-reset:execute' },
])

function normalizePath(path: string) {
  const withoutQuery = path.split('?')[0] || '/'
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery
}

function routeMatches(template: string, actual: string) {
  const templateSegments = normalizePath(template).split('/').filter(Boolean)
  const actualSegments = normalizePath(actual).split('/').filter(Boolean)
  if (templateSegments.length !== actualSegments.length) return false
  return templateSegments.every((segment, index) =>
    segment.startsWith(':') || segment === actualSegments[index]
  )
}

export function resolveAdminRouteCapability(method: string, path: string): AdminCapability | null {
  const normalizedMethod = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase()
  return ADMIN_ROUTE_POLICIES.find(policy =>
    policy.method === normalizedMethod && routeMatches(policy.path, path)
  )?.capability || null
}
