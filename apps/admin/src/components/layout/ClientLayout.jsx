import { Outlet } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function ClientLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col items-center">
      {/* Client Header */}
      <header className="w-full max-w-xl px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold text-neutral-900 dark:text-white">
            Post<span className="text-mag-500">inder</span>
          </div>
          {user && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Olá, <strong className="text-neutral-700 dark:text-neutral-200">{user.name}</strong> 👋
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-xs text-neutral-400 hover:text-red-500 transition-colors px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="w-full max-w-xl px-4 pb-8">
        <Outlet />
      </div>
    </div>
  )
}
