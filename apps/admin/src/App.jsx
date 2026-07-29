import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from './store/themeStore'
import { useAuthStore } from './store/authStore'
import AdminLayout from './components/layout/AdminLayout'
import LoginPage from './features/auth/LoginPage'
import RecoverPage from './features/auth/RecoverPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ClientsPage from './features/clients/ClientsPage'
import ClientDetailsPage from './features/clients/ClientDetailsPage'
import NewPostPage from './features/posts/NewPostPage'
import ManagePostsPage from './features/posts/ManagePostsPage'
import ApprovalsPage from './features/approvals/ApprovalsPage'
import FeedPreviewPage from './features/posts/FeedPreviewPage'
import InsightsPage from './features/insights/InsightsPage'
import UsersPage from './features/users/UsersPage'
import EmailPage from './features/settings/EmailPage'
import IntegrationsPage from './features/settings/IntegrationsPage'
import ResetDataPage from './features/settings/ResetDataPage'
import ClientPortalPage from './features/portal/ClientPortalPage'
import { ROLE_PERMISSIONS } from './utils/constants'
import { isDemoDeploymentMode } from './config/deploymentMode'

const demoResetVisible = isDemoDeploymentMode(import.meta.env.VITE_DEPLOYMENT_MODE)

function getAllowedPermissions(user) {
  if (!user) return []
  const role = String(user.role || '').trim().toLowerCase()
  if (role === 'admin') return ROLE_PERMISSIONS.admin
  if (role === 'viewer') return ROLE_PERMISSIONS.viewer
  if (Array.isArray(user.permissions) && user.permissions.length) return user.permissions
  return ROLE_PERMISSIONS[role] || []
}

function RequireAdmin({ children }) {
  const { user } = useAuthStore()
  if (!user || user.type !== 'admin') return <Navigate to="/login" replace />
  return children
}

function RequirePermission({ permission, children }) {
  const { user } = useAuthStore()
  if (!user || user.type !== 'admin') return <Navigate to="/login" replace />
  const role = String(user.role || '').trim().toLowerCase()
  if (role === 'admin') return children
  if (permission === 'integrations' && role === 'gestor') return children
  if (!getAllowedPermissions(user).includes(permission)) {
    return <Navigate to="/admin/dashboard" replace />
  }
  return children
}

function RequireClient({ children }) {
  const { user } = useAuthStore()
  if (!user || user.type !== 'client') return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { isDark } = useThemeStore()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recover" element={<RecoverPage />} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<RequirePermission permission="dashboard"><DashboardPage /></RequirePermission>} />
        <Route path="clients" element={<RequirePermission permission="clients"><ClientsPage /></RequirePermission>} />
        <Route path="clients/:id" element={<RequirePermission permission="clients"><ClientDetailsPage /></RequirePermission>} />
        <Route path="posts" element={<RequirePermission permission="posts"><ManagePostsPage /></RequirePermission>} />
        <Route path="posts/new" element={<RequirePermission permission="posts/new"><NewPostPage /></RequirePermission>} />
        <Route path="approvals" element={<RequirePermission permission="approvals"><ApprovalsPage /></RequirePermission>} />
        <Route path="feed" element={<RequirePermission permission="feed"><FeedPreviewPage /></RequirePermission>} />
        <Route path="insights" element={<RequirePermission permission="insights"><InsightsPage /></RequirePermission>} />
        <Route path="users" element={<RequirePermission permission="users"><UsersPage /></RequirePermission>} />
        <Route path="email" element={<RequirePermission permission="email"><EmailPage /></RequirePermission>} />
        <Route path="integrations" element={<RequirePermission permission="integrations"><IntegrationsPage /></RequirePermission>} />
        <Route
          path="reset"
          element={demoResetVisible
            ? <RequirePermission permission="users"><ResetDataPage /></RequirePermission>
            : <Navigate to="/admin/dashboard" replace />}
        />
      </Route>
      <Route path="/aprovar" element={<RequireClient><ClientPortalPage mode="auth" /></RequireClient>} />
      <Route path="/aprovar/resumo" element={<Navigate to="/aprovar" replace />} />
      <Route path="/portal/:token" element={<ClientPortalPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
