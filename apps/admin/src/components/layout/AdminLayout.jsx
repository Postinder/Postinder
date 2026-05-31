import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, PlusSquare, CheckCircle,
  Grid, BarChart2, UserCog, Mail, Plug, LogOut, Menu
} from 'lucide-react'
import { useAuthStore }  from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import ThemeToggle from '../ui/ThemeToggle'
import NotificationBell from '../notifications/NotificationBell'
import GlobalSearch from '../search/GlobalSearch'
import { logout } from '../../services/auth.service'
import toast from 'react-hot-toast'

const Logo20Cinco = () => (
  <svg viewBox="0 0 260 80" className="w-full max-w-[180px]">
    <text x="4" y="58" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="58" fill="white">2</text>
    <circle cx="60" cy="36" r="22" fill="none" stroke="white" strokeWidth="3.5"/>
    <circle cx="60" cy="36" r="3" fill="#A7014B"/>
    <line x1="60" y1="36" x2="60" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <line x1="60" y1="36" x2="72" y2="42" stroke="#A0A0A0" strokeWidth="2.5" strokeLinecap="round"/>
    <text x="88" y="46" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="34" fill="white">CINCO</text>
    <text x="89" y="64" fontFamily="Arial" fontSize="13" fill="rgba(255,255,255,0.45)" letterSpacing="2">comunicação</text>
  </svg>
)

function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all relative
        ${isActive
          ? 'bg-white/15 text-white before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-white before:rounded-r'
          : 'text-white/70 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      <Icon size={16} />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="bg-mag-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}

export default function AdminLayout() {
  const { user, logout: clearUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin  = user?.role === 'admin'
  const isGestor = user?.role === 'gestor' || isAdmin

  async function handleLogout() {
    try { await logout() } catch {}
    clearUser()
    navigate('/login')
  }

  const pageTitle = [
    { path: '/admin/dashboard', title: 'Dashboard' },
    { path: '/admin/clients', title: 'Clientes' },
    { path: '/admin/posts/new', title: 'Nova Postagem' },
    { path: '/admin/approvals', title: 'Aprovações' },
    { path: '/admin/feed', title: 'Prévia do Feed' },
    { path: '/admin/insights', title: 'Insights & Feedbacks' },
    { path: '/admin/users', title: 'Usuários' },
    { path: '/admin/email', title: 'E-mail' },
    { path: '/admin/integrations', title: 'Integrações' },
  ].find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.title || 'Postinder'

  const sidebar = (
    <aside className="flex flex-col h-full bg-mag-600 dark:bg-neutral-950">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <Logo20Cinco />
      </div>

      {/* User */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-mag-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-white text-sm font-semibold truncate">{user?.name}</div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white/80 px-2 py-0.5 rounded">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-5 pt-3 pb-1">Principal</div>
        <NavItem to="/admin/dashboard"  icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/admin/clients"    icon={Users}           label="Clientes" />
        <NavItem to="/admin/posts/new"  icon={PlusSquare}      label="Nova Postagem" />
        <NavItem to="/admin/approvals"  icon={CheckCircle}     label="Aprovações" />
        <NavItem to="/admin/feed"       icon={Grid}            label="Prévia do Feed" />
        <NavItem to="/admin/insights"   icon={BarChart2}       label="Insights & Feedbacks" />

        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-5 pt-4 pb-1">Sistema</div>
        {isAdmin && <NavItem to="/admin/users" icon={UserCog} label="Usuários" />}
        <NavItem to="/admin/email" icon={Mail} label="E-mail" />
        <NavItem to="/admin/integrations" icon={Plug} label="Integrações" />

        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-5 pt-4 pb-1">Conta</div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-red-300/80 hover:text-red-300 hover:bg-white/5 transition-all"
        >
          <LogOut size={16} />
          Sair do sistema
        </button>
      </nav>

      {/* Version */}
      <div className="px-5 py-3 text-[10px] text-white/20 border-t border-white/10">
        Postinder v2.0
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-60 flex-shrink-0 flex-col">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 flex flex-col">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white" id="page-title">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
