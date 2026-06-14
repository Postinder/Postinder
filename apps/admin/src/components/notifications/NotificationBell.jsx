import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCheck, CheckCircle, Clock, XCircle } from 'lucide-react'
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
} from '../../services/notifications.service'

function getPostClientId(post) {
  return post?.client_id || post?.clientId
}

function formatDate(value) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getNotificationIcon(notification) {
  if (notification.type === 'correction') return CheckCircle
  return notification.type === 'rejected' ? XCircle : Clock
}

function getNotificationIconClass(notification) {
  if (notification.type === 'rejected') return 'text-red-500 bg-red-50 dark:bg-red-950/40'
  if (notification.type === 'correction') return 'text-teal-500 bg-teal-50 dark:bg-teal-950/40'
  return 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('unread')

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: fetchNotifications,
    staleTime: 30000,
  })

  const notifications = useMemo(
    () => data.map(notification => ({
      ...notification,
      read: Boolean(notification.read),
    })),
    [data],
  )

  const unreadNotifications = notifications.filter(notification => !notification.read)
  const readNotifications = notifications.filter(notification => notification.read)
  const filteredNotifications = filter === 'read'
    ? readNotifications
    : filter === 'all'
      ? notifications
      : unreadNotifications

  useEffect(() => {
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function markAsRead(ids) {
    if (!ids.length) return
    await markNotificationsAsRead(ids)
    await refetch()
  }

  async function markAllAsRead() {
    await markAllNotificationsAsRead()
    await refetch()
  }

  function handleToggle() {
    setOpen(current => !current)
    if (!open) refetch()
  }

  async function openNotification(notification) {
    if (!notification.read) await markAsRead([notification.id])

    const clientId = getPostClientId(notification.post)
    const postId = notification.post?.id
    const target = clientId && postId
      ? `/admin/feed?client=${clientId}&post=${postId}`
      : '/admin/dashboard'

    setOpen(false)
    navigate(target)
  }

  const count = unreadNotifications.length
  const countLabel = count > 9 ? '9+' : String(count)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
        aria-label="Abrir notificações"
        aria-expanded={open}
      >
        <Bell size={18} className="text-neutral-500" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-mag-500 text-white text-[10px] font-bold leading-[18px] text-center">
            {countLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <div>
              <div className="text-sm font-bold text-neutral-900 dark:text-white">Notificações</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {count ? `${count} não lida${count !== 1 ? 's' : ''}` : 'Tudo em dia por aqui'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadNotifications.length === 0}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-teal-300"
                >
                  <CheckCheck size={14} />
                  Marcar todas
                </button>
              )}
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs font-semibold text-mag-500 hover:text-mag-600"
              >
                Atualizar
              </button>
            </div>
          </div>

          <div className="flex gap-2 border-b border-neutral-100 px-4 py-2 dark:border-neutral-800">
            {[
              { key: 'unread', label: 'Não lidas', count: unreadNotifications.length },
              { key: 'read', label: 'Lidas', count: readNotifications.length },
              { key: 'all', label: 'Todas', count: notifications.length },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === item.key
                    ? 'bg-mag-500 text-white'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {item.label} {item.count}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map(item => (
                  <div key={item} className="flex gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                      <div className="h-3 w-full rounded bg-neutral-100 dark:bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="p-5 text-center">
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  Não foi possível carregar
                </div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-2 text-xs font-semibold text-mag-500 hover:text-mag-600"
                >
                  Tentar novamente
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/40">
                  <CheckCircle size={20} />
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  Nenhuma notificação agora
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Postagens enviadas para o cliente ou recusadas aparecerão aqui.
                </p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
                  <CheckCircle size={20} />
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  Nenhum item nesta visualização
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Use os filtros acima para alternar entre lidas, não lidas e todas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredNotifications.map(notification => {
                  const Icon = getNotificationIcon(notification)

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/70 ${notification.read ? 'opacity-70' : 'bg-mag-50/40 dark:bg-mag-500/5'}`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${getNotificationIconClass(notification)}`}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-mag-500 align-middle" />
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] font-medium text-neutral-400">
                          {formatDate(notification.date)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
