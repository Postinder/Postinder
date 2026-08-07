import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, FileText, Search, UserCog, X } from 'lucide-react'
import { fetchClients } from '../../services/clients.service'
import { computePostStatus, fetchPosts } from '../../services/posts.service'
import { fetchUsers } from '../../services/users.service'
import { onlyClientDocumentDigits } from '../../utils/clientDocument'

const STATUS_LABELS = {
  draft: 'Rascunho',
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Recusado',
}

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matchesSearch(value, query) {
  return normalize(value).includes(normalize(query))
}

async function safeLoad(loader) {
  try {
    return await loader()
  } catch {
    return []
  }
}

function ResultSection({ title, items, emptyLabel, onSelect }) {
  return (
    <div>
      <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        {title}
      </div>
      {items.length ? (
        <div className="space-y-1 px-2">
          {items.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="px-5 py-2 text-xs text-neutral-400">{emptyLabel}</div>
      )}
    </div>
  )
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['global-search-data'],
    queryFn: async () => {
      const [posts, clients, users] = await Promise.all([
        safeLoad(fetchPosts),
        safeLoad(fetchClients),
        safeLoad(fetchUsers),
      ])

      return { posts, clients, users }
    },
    enabled: false,
    staleTime: 30000,
  })

  useEffect(() => {
    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
        refetch()
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [refetch])

  const results = useMemo(() => {
    const term = query.trim()
    const clients = data?.clients || []
    const posts = data?.posts || []
    const users = data?.users || []
    const clientById = new Map(clients.map(client => [client.id, client]))

    if (term.length < 2) {
      return { clients: [], posts: [], users: [] }
    }

    return {
      clients: clients
        .filter(client => {
          const documentQuery = onlyClientDocumentDigits(term)
          const documentNumber = onlyClientDocumentDigits(client.document_number)
          return [
            client.name,
            client.email,
            client.whatsapp,
            client.segment,
          ].some(value => matchesSearch(value, term))
            || Boolean(documentQuery && documentNumber.includes(documentQuery))
        })
        .slice(0, 5)
        .map(client => ({
          id: `client-${client.id}`,
          type: 'client',
          title: client.name || 'Cliente sem nome',
          description: [client.email, client.segment].filter(Boolean).join(' · ') || 'Cliente cadastrado',
          target: `/admin/dashboard?client=${client.id}`,
          icon: Building2,
          iconClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300',
        })),
      posts: posts
        .filter(post => {
          const client = clientById.get(getPostClientId(post))
          return [
            post.title,
            post.description,
            post.caption,
            post.funnel_tag,
            client?.name,
          ].some(value => matchesSearch(value, term))
        })
        .slice(0, 6)
        .map(post => {
          const client = clientById.get(getPostClientId(post))
          const status = computePostStatus(post)
          const clientId = getPostClientId(post)

          return {
            id: `post-${post.id}`,
            type: 'post',
            title: post.title || 'Postagem sem título',
            description: `${client?.name || 'Cliente'} · ${STATUS_LABELS[status] || status}`,
            target: clientId ? `/admin/feed?client=${clientId}&post=${post.id}` : `/admin/feed?post=${post.id}`,
            icon: FileText,
            iconClass: 'bg-mag-50 text-mag-600 dark:bg-mag-950/40 dark:text-mag-300',
          }
        }),
      users: users
        .filter(user => [
          user.name,
          user.email,
          user.role,
        ].some(value => matchesSearch(value, term)))
        .slice(0, 4)
        .map(user => ({
          id: `user-${user.id}`,
          type: 'user',
          title: user.name || 'Usuário sem nome',
          description: [user.email, user.role].filter(Boolean).join(' · ') || 'Usuário do sistema',
          target: '/admin/users',
          icon: UserCog,
          iconClass: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
        })),
    }
  }, [data, query])

  const totalResults = results.clients.length + results.posts.length + results.users.length
  const hasQuery = query.trim().length >= 2

  function openSearch() {
    setOpen(true)
    refetch()
  }

  function selectResult(item) {
    setOpen(false)
    setQuery('')
    navigate(item.target)
  }

  return (
    <div ref={wrapperRef} className="relative hidden min-w-0 sm:block">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={openSearch}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar..."
          className="h-10 w-44 rounded-full border border-neutral-200 bg-neutral-50 pl-9 pr-8 text-sm outline-none transition-all placeholder:text-neutral-400 focus:w-72 focus:border-mag-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900 md:w-56 md:focus:w-80"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <div className="text-sm font-bold text-neutral-900 dark:text-white">Busca global</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Busque por clientes, postagens e usuários.
            </div>
          </div>

          {isLoading ? (
            <div className="p-5 text-sm text-neutral-400">Carregando dados da busca...</div>
          ) : !hasQuery ? (
            <div className="p-5 text-sm text-neutral-400">
              Digite ao menos 2 caracteres para pesquisar.
            </div>
          ) : totalResults === 0 ? (
            <div className="p-5 text-sm text-neutral-400">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto pb-3">
              <ResultSection
                title={`Clientes (${results.clients.length})`}
                items={results.clients}
                emptyLabel="Nenhum cliente encontrado."
                onSelect={selectResult}
              />
              <ResultSection
                title={`Postagens (${results.posts.length})`}
                items={results.posts}
                emptyLabel="Nenhuma postagem encontrada."
                onSelect={selectResult}
              />
              <ResultSection
                title={`Usuários (${results.users.length})`}
                items={results.users}
                emptyLabel="Nenhum usuario encontrado."
                onSelect={selectResult}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
