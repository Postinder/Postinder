import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, PlusSquare, CheckCircle,
  Grid, BarChart2, UserCog, Mail, Plug, LogOut, Menu, X, Bell, Search
} from 'lucide-react'
import { useAuthStore }  from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import ThemeToggle from '../ui/ThemeToggle'
import { logout } from '../../services/auth.service'
import { supabase } from '../../services/supabase'
import { fetchNotifications, markAsRead, markAllAsRead } from '../../services/notifications.service'
import toast from 'react-hot-toast'

// ── Notification Center ──
function NotificationCenter({ userId }) {
  const [open,   setOpen]   = useState(false)
  const [notifs, setNotifs] = useState([])
  const panelRef = useRef(null)
  const unread = notifs.filter(n => !n.is_read).length

  async function load() {
    try { setNotifs(await fetchNotifications(userId)) } catch (e) { console.error(e) }
  }

  useEffect(() => { if (userId) load() }, [userId])

  // Realtime — new notifications appear instantly
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => setNotifs(prev => [payload.new, ...prev]))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleRead(id) {
    await markAsRead(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleReadAll() {
    await markAllAsRead(userId)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'agora'
    if (mins < 60) return `${mins}min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  const dotColor = { approved:'bg-green-500', rejected:'bg-red-500', info:'bg-blue-500' }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
        <Bell size={18} className="text-neutral-500" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-mag-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="font-bold text-sm">
              Notificações {unread > 0 && <span className="text-mag-500">({unread})</span>}
            </h3>
            {unread > 0 && (
              <button onClick={handleReadAll} className="text-xs text-neutral-400 hover:text-mag-500 transition-colors">
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-neutral-50 dark:divide-neutral-800">
            {notifs.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} onClick={() => !n.is_read && handleRead(n.id)}
                className={`flex gap-3 px-4 py-3 transition-colors ${
                  !n.is_read
                    ? 'bg-mag-50/50 dark:bg-mag-950/20 cursor-pointer hover:bg-mag-50 dark:hover:bg-mag-950/30'
                    : 'opacity-60'
                }`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor[n.type] || 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{n.title}</p>
                  {n.description && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{n.description}</p>}
                  <p className="text-[10px] text-neutral-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-mag-500 flex-shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch]           = useState('')
  const [showSearch, setShowSearch]   = useState(false)

  const isAdmin  = user?.role === 'admin'
  const isGestor = user?.role === 'gestor' || isAdmin
  const isEquipe = user?.role === 'equipe'

  function canAccess(screen) {
    if (isAdmin || isGestor) return true
    if (isEquipe) return (user?.permissions || []).includes(screen)
    return false
  }

  function handleSearch(e) {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/admin/dashboard?q=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  async function handleLogout() {
    try { await logout() } catch {}
    clearUser()
    navigate('/login')
  }

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
        {canAccess('dashboard')  && <NavItem to="/admin/dashboard"  icon={LayoutDashboard} label="Dashboard" />}
        {canAccess('clients')    && <NavItem to="/admin/clients"    icon={Users}           label="Clientes" />}
        {canAccess('posts/new')  && <NavItem to="/admin/posts/new"  icon={PlusSquare}      label="Nova Postagem" />}
        {canAccess('approvals')  && <NavItem to="/admin/approvals"  icon={CheckCircle}     label="Aprovações" />}
        {canAccess('feed')       && <NavItem to="/admin/feed"       icon={Grid}            label="Prévia do Feed" />}
        {canAccess('insights')   && <NavItem to="/admin/insights"   icon={BarChart2}       label="Insights & Feedbacks" />}

        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-5 pt-4 pb-1">Sistema</div>
        {isAdmin                  && <NavItem to="/admin/users"        icon={UserCog} label="Usuários" />}
        {(isAdmin || isGestor)    && <NavItem to="/admin/email"        icon={Mail}    label="E-mail" />}
        {(isAdmin || isGestor)    && <NavItem to="/admin/integrations" icon={Plug}    label="Integrações" />}

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
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white hidden md:block" id="page-title">
              Dashboard
            </h1>
          </div>

          {/* Global search */}
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Buscar..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-mag-400 focus:bg-white dark:focus:bg-neutral-700 rounded-full text-sm outline-none transition-all placeholder-neutral-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            <NotificationCenter userId={user?.id} />
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
