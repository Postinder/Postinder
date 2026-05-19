import { useState, useEffect } from 'react'
import { BarChart2, MessageSquare } from 'lucide-react'
import { fetchMonthlyFeedbacks } from '../../services/insights.service'
import { fetchPosts, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import Card from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import AIInsightsPanel from '../../components/ai/AIInsightsPanel'
import toast from 'react-hot-toast'

function VerticalBarChart({ data, colorFn }) {
  if (!data.length) return <div className="text-center text-neutral-400 py-8 text-sm">Sem dados no período</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2" style={{ height: '110px' }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">{d.value}</span>
          <div className="w-full rounded-t transition-all"
            style={{ height: `${Math.max(4, Math.round(d.value / max * 80))}px`, background: colorFn(i) }} />
          <span className="text-[9px] text-neutral-400 text-center leading-tight truncate w-full">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function HorizontalBarChart({ data, color }) {
  if (!data.length) return <div className="text-center text-neutral-400 py-4 text-sm">Sem dados</div>
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate" style={{ width: '70px', flexShrink: 0 }}>
            {d.label.split(' ')[0]}
          </div>
          <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${d.value}%`, background: color(d.value) }} />
          </div>
          <div className="text-xs font-semibold w-8 text-right" style={{ color: color(d.value) }}>
            {d.value}%
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ concluded, total, pending }) {
  const pct = total ? Math.round(concluded / total * 100) : 0
  const r = 30
  const ci = Math.round(2 * Math.PI * r)
  const offset = Math.round(ci * (1 - pct / 100))
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', width: 72, height: 72 }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#3087A6" strokeWidth="8"
            strokeDasharray={ci} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-extrabold text-sm" style={{ color: '#3087A6' }}>
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-3xl font-extrabold" style={{ color: '#3087A6' }}>{concluded}</div>
        <div className="text-xs text-neutral-400">concluídos</div>
        <div className="text-xs mt-1" style={{ color: '#d97706' }}>{pending} em andamento</div>
      </div>
    </div>
  )
}

function FeedbacksCard({ posts, clients, clientFilter }) {
  const filtered = posts.filter(p =>
    (p.files || []).some(f => f.feedbacks?.length > 0) &&
    (!clientFilter || p.client_id === clientFilter)
  )
  if (!filtered.length) return (
    <div className="text-center py-6 text-neutral-400 text-sm">Nenhum feedback registrado.</div>
  )
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {filtered.map(p => {
        const client = clients.find(c => c.id === p.client_id)
        const ini = client ? client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
        return (p.files || []).filter(f => f.feedbacks?.length).map(f => (
          f.feedbacks.map((fb, i) => (
            <div key={`${f.id}-${i}`} className="flex items-start gap-3 py-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: client?.color || '#888' }}>{ini}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-1">
                  {p.title} · <span className="font-normal text-neutral-400">{client?.name || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(fb.tags || []).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#f4e6ed', color: '#A7014B' }}>{t}</span>
                  ))}
                  {fb.comment && <span className="text-xs text-neutral-400 italic">"{fb.comment}"</span>}
                </div>
              </div>
            </div>
          ))
        ))
      })}
    </div>
  )
}

const COLORS = ['#A7014B','#e05577','#3087A6','#E65A00','#6B21A8','#0F766E','#B45309','#1D4ED8']
const PERIODS = [{ key:'week', label:'Semanal' }, { key:'month', label:'Mensal' }, { key:'year', label:'Anual' }]
const MONTHS  = ['2025-05','2025-04','2025-03','2025-02']

function MetricCard({ label, value, color, sub }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </Card>
  )
}

export default function InsightsPage() {
  const [period, setPeriod]   = useState('week')
  const [tab, setTab]         = useState('metrics')
  const [clients, setClients] = useState([])
  const [posts, setPosts]     = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [fbFilter, setFbFilter]   = useState('')
  const [fbClientFilter, setFbClientFilter] = useState('')
  const [fbMonth, setFbMonth] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchClients(), fetchPosts()])
      .then(([c, p]) => { setClients(c); setPosts(p) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'feedbacks') {
      fetchMonthlyFeedbacks({ clientId: fbFilter || undefined, month: fbMonth || undefined })
        .then(setFeedbacks).catch(() => {})
    }
  }, [tab, fbFilter, fbMonth])

  const total     = posts.length
  const approved  = posts.filter(p => computePostStatus(p.files||[]) === 'approved').length
  const rejected  = posts.filter(p => computePostStatus(p.files||[]) === 'rejected').length
  const pending   = posts.filter(p => ['pending','updated'].includes(computePostStatus(p.files||[]))).length
  const approvalRate  = total ? Math.round(approved / total * 100) : 0
  const rejectionRate = total ? Math.round(rejected / total * 100) : 0

  const tagCounts = {}
  posts.forEach(p => (p.files||[]).forEach(f =>
    (f.feedbacks||[]).forEach(fb =>
      (fb.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0) + 1 })
    )
  ))
  const rejTagsData = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([label, value]) => ({ label, value }))

  const chanCounts = {}
  posts.forEach(p => (p.channels||[]).forEach(ch => {
    const k = ch.split('/')[0].slice(0, 10)
    chanCounts[k] = (chanCounts[k]||0) + 1
  }))
  const chanData = Object.entries(chanCounts).map(([label, value]) => ({ label, value }))

  const actLabels = period === 'week'
    ? ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
    : period === 'month'
      ? ['S1','S2','S3','S4']
      : ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const actValues = period === 'week' ? [3,5,2,6,4,1,2]
    : period === 'month' ? [12,18,9,15]
    : [8,12,15,10,18,22,16,14,20,11,9,13]
  const actData = actLabels.map((label, i) => ({ label, value: actValues[i] }))

  const clientApproval = clients.map(c => {
    const cp = posts.filter(p => p.client_id === c.id)
    const r  = cp.length ? Math.round(cp.filter(p => computePostStatus(p.files||[]) === 'approved').length / cp.length * 100) : 0
    return { label: c.name, value: r }
  })
  const clientRejection = clients.map(c => {
    const cp = posts.filter(p => p.client_id === c.id)
    const r  = cp.length ? Math.round(cp.filter(p => computePostStatus(p.files||[]) === 'rejected').length / cp.length * 100) : 0
    return { label: c.name, value: r }
  })

  const monthLabel = m => new Date(m + '-01').toLocaleDateString('pt-BR', { month:'long', year:'numeric' })

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 size={20} className="text-mag-500" />
        <h1 className="text-xl font-bold">Insights & Feedbacks</h1>
      </div>

      <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden w-fit mb-6">
        {[{ key:'metrics', label:'📊 Métricas' }, { key:'feedbacks', label:'💬 Feedbacks' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold transition-all ${tab === t.key ? 'bg-mag-500 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && (
        <>
          <div className="flex border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden w-fit mb-6">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 text-sm font-semibold transition-all ${period === p.key ? 'bg-mag-500 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16 text-neutral-400">Carregando métricas...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Total de Posts"     value={total}              color="text-neutral-900 dark:text-white" sub="no período" />
                <MetricCard label="Taxa de Aprovação"  value={`${approvalRate}%`} color="text-green-600"  sub="dos conteúdos" />
                <MetricCard label="Taxa de Reprovação" value={`${rejectionRate}%`}color="text-red-600"    sub="precisam ajuste" />
                <MetricCard label="Concluídos"         value={approved}           color="text-teal-600"   sub="aprovados" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Motivos de reprovação</h3>
                  <VerticalBarChart
                    data={rejTagsData.length ? rejTagsData : [{ label:'Cor', value:5 },{ label:'Luz', value:4 },{ label:'Qualidade', value:3 }]}
                    colorFn={i => COLORS[i % COLORS.length]}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Posts por canal</h3>
                  <VerticalBarChart
                    data={chanData.length ? chanData : [{ label:'Instagram', value:0 }]}
                    colorFn={i => COLORS[(i + 2) % COLORS.length]}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Taxa de aprovação</h3>
                  <HorizontalBarChart
                    data={clientApproval}
                    color={v => v >= 60 ? '#16a34a' : v >= 30 ? '#d97706' : '#dc2626'}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Atividade</h3>
                  <VerticalBarChart data={actData} colorFn={() => '#3087A6'} />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Taxa de reprovação</h3>
                  <HorizontalBarChart
                    data={clientRejection}
                    color={v => v > 40 ? '#dc2626' : v > 20 ? '#d97706' : '#16a34a'}
                  />
                </Card>

                <Card className="p-5">
                  <h3 className="font-bold text-sm mb-4">Projetos concluídos</h3>
                  <DonutChart concluded={approved} total={total} pending={pending} />
                </Card>

              </div>

              <Card className="p-5 mb-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-bold text-sm">Feedbacks de reprovação (por arquivo)</h3>
                  <Select value={fbClientFilter} onChange={e => setFbClientFilter(e.target.value)} className="w-52">
                    <option value="">Todos os clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <FeedbacksCard posts={posts} clients={clients} clientFilter={fbClientFilter} />
              </Card>

              <AIInsightsPanel posts={posts} clients={clients} period={period} />
            </>
          )}
        </>
      )}

      {tab === 'feedbacks' && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <Select value={fbFilter} onChange={e => setFbFilter(e.target.value)} className="w-56">
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={fbMonth} onChange={e => setFbMonth(e.target.value)} className="w-48">
              <option value="">Todos os meses</option>
              {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Total"     value={feedbacks.length}                           color="text-neutral-900 dark:text-white" sub="feedbacks" />
            <MetricCard label="Positivos" value={feedbacks.filter(f => f.rating >= 4).length} color="text-green-600"  sub="4-5 estrelas" />
            <MetricCard label="Negativos" value={feedbacks.filter(f => f.rating < 4).length}  color="text-red-600"    sub="1-3 estrelas" />
          </div>

          {feedbacks.length === 0 ? (
            <Card className="p-12 text-center text-neutral-400">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum feedback encontrado.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {feedbacks.map(fb => {
                const isPos = fb.rating >= 4
                const stars = Array.from({ length:5 }, (_,i) => i < fb.rating ? '⭐' : '☆').join('')
                return (
                  <Card key={fb.id} className={`p-4 border-l-4 ${isPos ? 'border-green-400' : 'border-red-400'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fb.client?.name || 'Cliente'}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPos ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                          {isPos ? 'Positivo' : 'Negativo'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400">{new Date(fb.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-base mb-2">{stars}</div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 leading-relaxed">{fb.text}</p>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
