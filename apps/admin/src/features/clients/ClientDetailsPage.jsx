import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart2, CalendarDays, CheckCircle, Clock, Copy, ExternalLink, Grid, Link2, Mail, MessageCircle, PieChart, RefreshCw, UserRound } from 'lucide-react'
import { fetchClientPortalLink, fetchClients, generateClientPortalLink, replaceClientPortalLink, updateClient } from '../../services/clients.service'
import { computePostStatus, fetchPosts } from '../../services/posts.service'
import { fetchMonthlyFeedbacks } from '../../services/insights.service'
import { Avatar, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import toast from 'react-hot-toast'
import { formatClientDocument } from '../../utils/clientDocument'
import { usePlatformSettings } from '../../hooks/usePlatformSettings'
import { isFieldVisible } from '../../utils/fieldPolicies'

function getPostClientId(post) {
  return post.client_id || post.clientId
}

function getPostDate(post) {
  const value = post.updatedAt || post.updated_at || post.createdAt || post.created_at
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value || 0)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getHistoricalStatus(post) {
  if (post?.status === 'executed') return 'approved'
  return computePostStatus(post)
}

function MetricCard({ icon, label, value, sub, color = 'text-neutral-900 dark:text-white' }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
          {icon}
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={`mt-2 text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-400">{sub}</div>}
    </Card>
  )
}

function MiniBarChart({ data }) {
  const max = Math.max(...data.map(item => item.value), 1)

  if (!data.length) {
    return <div className="py-8 text-center text-sm text-neutral-400">Nenhum canal utilizado ainda.</div>
  }

  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-600 dark:text-neutral-300">{item.label}</span>
            <span className="text-neutral-400">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${Math.max(6, Math.round((item.value / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [posts, setPosts] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [portalLink, setPortalLink] = useState(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalDays, setPortalDays] = useState(15)
  const [portalLinkAccess, setPortalLinkAccess] = useState(true)
  const [preferenceBusy, setPreferenceBusy] = useState(false)
  const { settings } = usePlatformSettings()
  const fieldPolicies = settings.client_fields

  useEffect(() => {
    Promise.all([
      fetchClients({ includeInactive: true }),
      fetchPosts({ limit: 500 }),
      fetchMonthlyFeedbacks({ clientId: id }),
      fetchClientPortalLink(id).catch(() => {
        setPortalLinkAccess(false)
        return null
      }),
    ])
      .then(([loadedClients, loadedPosts, loadedFeedbacks, loadedPortalLink]) => {
        setClients(loadedClients)
        setPosts(loadedPosts)
        setFeedbacks(loadedFeedbacks)
        setPortalLink(loadedPortalLink)
      })
      .catch(error => toast.error(error.message || 'Não foi possível carregar o cliente.'))
      .finally(() => setLoading(false))
  }, [])

  const client = clients.find(item => item.id === id)
  const inactive = client?.is_active === false || client?.isActive === false
  const clientPosts = useMemo(
    () => posts.filter(post => getPostClientId(post) === id),
    [posts, id]
  )

  const stats = useMemo(() => {
    const total = clientPosts.length
    const approved = clientPosts.filter(post => getHistoricalStatus(post) === 'approved').length
    const pending = clientPosts.filter(post => getHistoricalStatus(post) === 'pending_approval').length
    const currentlyRejected = clientPosts.filter(post => getHistoricalStatus(post) === 'rejected').length
    const postIds = new Set(clientPosts.map(post => post.id))
    const rejectedPostIds = new Set()

    feedbacks.forEach(feedback => {
      const postId = feedback.post_id || feedback.postId
      if (postId && postIds.has(postId)) rejectedPostIds.add(postId)
    })

    clientPosts.forEach(post => {
      if ((post.files || []).some(file => file.status === 'rejected' || file.rejection_reason || file.rejection_tags?.length)) {
        rejectedPostIds.add(post.id)
      }
    })

    const initiallyRejected = rejectedPostIds.size
    const initiallyApproved = clientPosts.filter(post => getHistoricalStatus(post) === 'approved' && !rejectedPostIds.has(post.id)).length
    const initialDecisionTotal = initiallyApproved + initiallyRejected
    const approvalRate = initialDecisionTotal ? Math.round((initiallyApproved / initialDecisionTotal) * 100) : 0
    const rejectionRate = initialDecisionTotal ? Math.round((initiallyRejected / initialDecisionTotal) * 100) : 0
    const concludedWithRevision = clientPosts.filter(post => getHistoricalStatus(post) === 'approved' && rejectedPostIds.has(post.id)).length
    const concludedWithoutRevision = clientPosts.filter(post => getHistoricalStatus(post) === 'approved' && !rejectedPostIds.has(post.id)).length

    return { total, approved, pending, currentlyRejected, initiallyRejected, initiallyApproved, approvalRate, rejectionRate, concludedWithRevision, concludedWithoutRevision }
  }, [clientPosts, feedbacks])

  const channelData = useMemo(() => {
    const counts = {}
    clientPosts.forEach(post => {
      ;(post.channels || []).forEach(channel => {
        const label = channel.split('/')[0] || channel
        counts[label] = (counts[label] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
  }, [clientPosts])

  const recentPosts = [...clientPosts]
    .sort((a, b) => (getPostDate(b)?.getTime() || 0) - (getPostDate(a)?.getTime() || 0))
    .slice(0, 6)

  const lastPostDate = recentPosts[0] ? getPostDate(recentPosts[0]) : null
  const lastAccess = client?.last_access_at || client?.lastAccessAt

  async function handleGeneratePortalLink() {
    if (inactive) return
    setPortalBusy(true)
    try {
      const result = await generateClientPortalLink(id, portalDays)
      setPortalLink(result)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.portalUrl)
        toast.success('Link do portal gerado e copiado.')
      } else {
        toast.success('Link do portal gerado.')
      }
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel gerar o link do portal.')
    } finally {
      setPortalBusy(false)
    }
  }

  async function handleCopyPortalLink() {
    if (!portalLink?.portalUrl) return
    try {
      await navigator.clipboard.writeText(portalLink.portalUrl)
      toast.success('Link copiado.')
    } catch {
      toast.error('Nao foi possivel copiar automaticamente.')
    }
  }

  function handleOpenPortalLink() {
    if (!portalLink?.portalUrl) return
    window.open(portalLink.portalUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleReplacePortalLink() {
    if (inactive || !confirm('Substituir o link ativo? O link anterior deixara de funcionar somente quando o novo estiver pronto.')) return
    setPortalBusy(true)
    try {
      const result = await replaceClientPortalLink(id, portalDays)
      setPortalLink(result)
      toast.success('Link do portal substituido com seguranca.')
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel substituir o link do portal.')
    } finally {
      setPortalBusy(false)
    }
  }

  async function handlePortalModeChange(event) {
    const portalMode = event.target.value || null
    setPreferenceBusy(true)
    try {
      const updated = await updateClient(id, { portal_mode_override: portalMode })
      setClients(current => current.map(item => item.id === id ? { ...item, ...updated } : item))
      toast.success(portalMode ? 'Override do portal atualizado.' : 'O cliente agora usa a configuracao da plataforma.')
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel atualizar o portal.')
    } finally {
      setPreferenceBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <EmptyState
        icon={<UserRound size={36} />}
        title="Cliente não encontrado"
        description="O cliente pode ter sido removido ou o link acessado não existe."
        action={<Button variant="secondary" onClick={() => navigate('/admin/clients')}>Voltar para clientes</Button>}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => navigate('/admin/clients')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-mag-500"
        >
          <ArrowLeft size={16} />
          Voltar para clientes
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} color={client.color} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-neutral-950 dark:text-white">{client.name}</h1>
                {inactive ? <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">Desativado</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                {client.email && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"><Mail size={13} />{client.email}</span>}
                {isFieldVisible(fieldPolicies.whatsapp) && client.whatsapp && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"><MessageCircle size={13} />{client.whatsapp}</span>}
                {isFieldVisible(fieldPolicies.document) ? <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800">
                  <UserRound size={13} />
                  {client.document_number
                    ? `${String(client.document_type || 'documento').toUpperCase()}: ${formatClientDocument(client.document_number, client.document_type)}`
                    : 'Documento: —'}
                </span> : null}
                {isFieldVisible(fieldPolicies.segment) && client.segment && <span className="rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800">{client.segment}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {portalLinkAccess ? <>
            <select
              value={portalDays}
              onChange={event => setPortalDays(Number(event.target.value))}
              disabled={inactive}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
            </select>
            {portalLink?.portalUrl ? (
              <>
                <Button variant="secondary" onClick={handleCopyPortalLink} icon={<Copy size={16} />}>Copiar link</Button>
                <Button variant="secondary" onClick={handleOpenPortalLink} icon={<ExternalLink size={16} />}>Abrir portal</Button>
              </>
            ) : null}
            {!portalLink?.hasActiveLink ? (
              <Button variant="secondary" loading={portalBusy} disabled={inactive} onClick={handleGeneratePortalLink} icon={<Link2 size={16} />}>
                Gerar link do portal
              </Button>
            ) : (
              <Button variant="secondary" loading={portalBusy} disabled={inactive} onClick={handleReplacePortalLink} icon={<RefreshCw size={16} />}>
                Substituir link
              </Button>
            )}
            </> : null}
            <Button variant="secondary" onClick={() => navigate(`/admin/dashboard?client=${client.id}`)}>Ver posts</Button>
            <Button onClick={() => navigate(`/admin/feed?client=${client.id}`)}>Ver feed</Button>
          </div>
        </div>
        {portalLinkAccess && portalLink?.hasActiveLink ? (
          <div className="mt-4 rounded-lg border border-mag-100 bg-mag-50 p-3 text-sm text-mag-900 dark:border-mag-500/20 dark:bg-mag-500/10 dark:text-mag-100">
            <div className="font-bold">Link ativo do portal</div>
            {portalLink.portalUrl ? <div className="mt-1 break-all text-xs">{portalLink.portalUrl}</div> : <div className="mt-1 text-xs">Este link antigo continua valido, mas nao pode ser recuperado. Substitua-o explicitamente para voltar a copiar.</div>}
            <div className="mt-1 text-xs opacity-70">Criado ou substituido em {formatDate(portalLink.createdAt)} · valido ate {formatDate(portalLink.expiresAt)}.</div>
          </div>
        ) : null}
        <label className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/60">
          <span>
            <span className="block text-sm font-bold text-neutral-900 dark:text-white">Experiencia do portal</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-300">Use o padrao global ou escolha um comportamento explicito para este cliente.</span>
          </span>
          <select
            value={client.portal_mode_override || client.portalModeOverride || ((client.portal_detailed_view === true || client.portalDetailedView === true) ? 'detailed' : '')}
            onChange={handlePortalModeChange}
            disabled={inactive || preferenceBusy}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Usar configuracao da plataforma</option>
            <option value="simplified">Portal simplificado</option>
            <option value="detailed">Portal detalhado</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Grid size={20} />} label="Total de posts" value={stats.total} sub="postagens vinculadas" />
        <MetricCard icon={<CheckCircle size={20} />} label="Aprovacao inicial" value={`${stats.approvalRate}%`} sub={`${stats.initiallyApproved} sem revisao`} color="text-green-600" />
        <MetricCard icon={<Clock size={20} />} label="Último acesso" value={lastAccess ? formatDate(lastAccess) : 'Não registrado'} sub="aguardando dados de login" color="text-amber-600" />
        <MetricCard icon={<CalendarDays size={20} />} label="Última atividade" value={lastPostDate ? formatDate(lastPostDate) : 'Sem posts'} sub="post mais recente" color="text-teal-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<RefreshCw size={20} />} label="Recusa inicial" value={`${stats.rejectionRate}%`} sub={`${stats.initiallyRejected} com apontamento`} color="text-red-600" />
        <MetricCard icon={<CheckCircle size={20} />} label="Concluidos sem revisao" value={stats.concludedWithoutRevision} sub="aprovados direto" color="text-green-600" />
        <MetricCard icon={<RefreshCw size={20} />} label="Concluidos com revisao" value={stats.concludedWithRevision} sub="corrigidos e aprovados" color="text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-mag-500" />
            <h2 className="text-sm font-bold">Resumo por status</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-950/40">
              <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{stats.pending}</div>
              <div className="text-xs font-semibold text-amber-700/70 dark:text-amber-300/70">Pendentes</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-950/40">
              <div className="text-2xl font-extrabold text-green-700 dark:text-green-300">{stats.approved}</div>
              <div className="text-xs font-semibold text-green-700/70 dark:text-green-300/70">Aprovados</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-950/40">
              <div className="text-2xl font-extrabold text-red-700 dark:text-red-300">{stats.currentlyRejected}</div>
              <div className="text-xs font-semibold text-red-700/70 dark:text-red-300/70">Recusados</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart2 size={18} className="text-mag-500" />
            <h2 className="text-sm font-bold">Canais utilizados</h2>
          </div>
          <MiniBarChart data={channelData} />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-bold">Posts recentes</h2>
          <p className="mt-1 text-xs text-neutral-400">Últimas postagens vinculadas a este cliente.</p>
        </div>

        {recentPosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">Nenhum post cadastrado para este cliente.</div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentPosts.map(post => (
              <button
                key={post.id}
                type="button"
                onClick={() => navigate(`/admin/feed?client=${client.id}&post=${post.id}`)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-mag-50/40 dark:hover:bg-mag-500/10"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{post.title || 'Post sem título'}</div>
                  <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">{post.description || 'Sem descrição cadastrada.'}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={computePostStatus(post)} />
                  <span className="hidden text-xs text-neutral-400 sm:inline">{formatDate(getPostDate(post))}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
