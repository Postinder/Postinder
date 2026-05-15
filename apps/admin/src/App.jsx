import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useThemeStore } from './store/themeStore'
import { useAuthStore } from './store/authStore'
import { loginClientWithToken } from './services/auth.service'
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
function RequireClient({ children }) {
  const { user, setUser } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const token = new URLSearchParams(location.search).get('token')
  const [loadingToken, setLoadingToken] = useState(Boolean(token && user?.type !== 'client'))

  useEffect(() => {
    let cancelled = false

    async function authenticateWithToken() {
      if (!token || user?.type === 'client') {
        setLoadingToken(false)
        return
      }

      try {
        const clientUser = await loginClientWithToken(token)
        if (cancelled) return
        setUser(clientUser)
        navigate(location.pathname, { replace: true })
      } catch {
        if (!cancelled) {
          setLoadingToken(false)
          navigate('/login', { replace: true })
        }
      }
    }

    authenticateWithToken()

    return () => {
      cancelled = true
    }
  }, [token, user?.type, setUser, navigate, location.pathname])

  if (loadingToken) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-700 border-t-mag-500 rounded-full animate-spin" />
      </div>
    )
  }

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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="posts/new" element={<NewPostPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="feed" element={<FeedPreviewPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
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
