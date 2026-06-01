import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCircle, Clock, XCircle } from 'lucide-react'
import { fetchClients } from '../../services/clients.service'
import { computePostStatus, fetchPosts } from '../../services/posts.service'

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function getPostDate(post) {
  return post.updatedAt || post.updated_at || post.createdAt || post.created_at
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

function buildNotifications(posts, clients) {
  const clientById = new Map(clients.map(client => [client.id, client]))

  return posts
    .map(post => {
      const status = computePostStatus(post)
      const client = clientById.get(getPostClientId(post))

      if (status === 'rejected') {
        return {
          id: `rejected-${post.id}`,
          post,
          client,
          type: 'rejected',
          title: 'Postagem recusada',
          message: `${client?.name || 'Cliente'} solicitou ajustes em "${post.title || 'sem titulo'}".`,
          date: getPostDate(post),
          icon: XCircle,
          iconClass: 'text-red-500 bg-red-50 dark:bg-red-950/40',
        }
      }

      if (status === 'pending_approval') {
        return {
          id: `pending-${post.id}`,
          post,
          client,
          type: 'pending',
          title: 'Aguardando aprovação',
          message: `"${post.title || 'Postagem sem título'}" está aguardando retorno do cliente.`,
          date: getPostDate(post),
          icon: Clock,
          iconClass: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
        }
      }

      return null
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const [open, setOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const [posts, clients] = await Promise.all([fetchPosts(), fetchClients()])
      return { posts, clients }
    },
    staleTime: 30000,
  })

  const notifications = useMemo(
    () => buildNotifications(data?.posts || [], data?.clients || []),
    [data]
  )

  useEffect(() => {
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
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

  function handleToggle() {
    setOpen(current => !current)
    if (!open) refetch()
  }

  function openNotification(notification) {
    const clientId = getPostClientId(notification.post)
    const postId = notification.post.id
    const target = clientId
      ? `/admin/feed?client=${clientId}&post=${postId}`
      : '/admin/dashboard'

    setOpen(false)
    navigate(target)
  }

  const count = notifications.length
  const countLabel = count > 9 ? '9+' : String(count)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
        aria-label="Abrir notificacoes"
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
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <div>
              <div className="text-sm font-bold text-neutral-900 dark:text-white">Notificacoes</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {count ? `${count} item${count !== 1 ? 's' : ''} precisam de atencao` : 'Tudo em dia por aqui'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-semibold text-mag-500 hover:text-mag-600"
            >
              Atualizar
            </button>
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
            ) : count === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/40">
                  <CheckCircle size={20} />
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  Nenhuma notificação agora
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Postagens pendentes ou recusadas aparecerao aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {notifications.map(notification => {
                  const Icon = notification.icon

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
                    >
                      <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${notification.iconClass}`}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                          {notification.title}
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
