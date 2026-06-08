import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from './store/themeStore'
import { useAuthStore } from './store/authStore'
import AdminLayout from './components/layout/AdminLayout'
import ClientLayout from './components/layout/ClientLayout'
import LoginPage from './features/auth/LoginPage'
import RecoverPage from './features/auth/RecoverPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ClientsPage from './features/clients/ClientsPage'
import NewPostPage from './features/posts/NewPostPage'
import ApprovalsPage from './features/approvals/ApprovalsPage'
import FeedPreviewPage from './features/posts/FeedPreviewPage'
import InsightsPage from './features/insights/InsightsPage'
import UsersPage from './features/users/UsersPage'
import EmailPage from './features/settings/EmailPage'
import IntegrationsPage from './features/settings/IntegrationsPage'
import ClientSwipePage from './features/approvals/ClientSwipePage'
import ClientSummary from './features/approvals/ClientSummary'

function RequireAdmin({ children }) {
  const { user } = useAuthStore()
  if (!user || user.type !== 'admin') return <Navigate to="/login" replace />
  return children
}

function RequireRole({ children, screen, roles }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  const isAdmin  = user.role === 'admin'
  const isGestor = user.role === 'gestor'
  const isEquipe = user.role === 'equipe'

  // Admin and gestor always have access (unless adminOnly)
  if (roles === 'adminOnly' && !isAdmin) return <Navigate to="/admin/dashboard" replace />
  if (isAdmin || isGestor) return children

  // Equipe: check individual permissions
  if (isEquipe && screen && (user.permissions || []).includes(screen)) return children

  return <Navigate to="/admin/dashboard" replace />
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
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="clients"      element={<RequireRole screen="clients"    roles="adminOrGestor"><ClientsPage /></RequireRole>} />
        <Route path="posts/new"    element={<RequireRole screen="posts/new"                      ><NewPostPage /></RequireRole>} />
        <Route path="approvals"    element={<RequireRole screen="approvals"                      ><ApprovalsPage /></RequireRole>} />
        <Route path="feed"         element={<RequireRole screen="feed"                           ><FeedPreviewPage /></RequireRole>} />
        <Route path="insights"     element={<RequireRole screen="insights"   roles="adminOrGestor"><InsightsPage /></RequireRole>} />
        <Route path="users"        element={<RequireRole                     roles="adminOnly"    ><UsersPage /></RequireRole>} />
        <Route path="email"        element={<RequireRole                     roles="adminOrGestor"><EmailPage /></RequireRole>} />
        <Route path="integrations" element={<RequireRole                     roles="adminOrGestor"><IntegrationsPage /></RequireRole>} />
      </Route>
      <Route path="/aprovar" element={<RequireClient><ClientLayout /></RequireClient>}>
        <Route index element={<ClientSwipePage />} />
        <Route path="resumo" element={<ClientSummary />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
