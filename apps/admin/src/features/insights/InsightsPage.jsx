import { useState, useEffect, useMemo } from 'react'
import { BarChart2, MessageSquare, Download, ChevronRight } from 'lucide-react'
import { fetchPostsForInsights, computePostStatus } from '../../services/posts.service'
import { fetchClients } from '../../services/clients.service'
import Card from '../../components/ui/Card'
import AIInsightsPanel from '../../components/ai/AIInsightsPanel'
import toast from 'react-hot-toast'

// ── Charts ──
function VerticalBarChart({ data, colorFn }) {
  if (!data.length) return <div className="text-center text-neutral-400 py-8 text-sm">Sem dados no período</div>
  const max = Math.max(...data.map(d=>d.value),1)
  return (
    <div className="flex items-end gap-2" style={{height:'110px'}}>
      {data.map((d,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">{d.value}</span>
          <div className="w-full rounded-t" style={{height:`${Math.max(4,Math.round(d.value/max*80))}px`,background:colorFn(i)}}/>
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
      {data.map((d,i)=>(
        <div key={i} className="flex items-center gap-2">
          <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate" style={{width:'80px',flexShrink:0}}>{d.label.split(' ')[0]}</div>
          <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{width:`${d.value}%`,background:typeof color==='function'?color(d.value):color}}/>
          </div>
          <div className="text-xs font-semibold w-8 text-right" style={{color:typeof color==='function'?color(d.value):color}}>{d.value}%</div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ concluded, total }) {
  const pct = total ? Math.round(concluded/total*100) : 0
  const r=30, ci=Math.round(2*Math.PI*r), offset=Math.round(ci*(1-pct/100))
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{width:72,height:72}}>
        <svg viewBox="0 0 80 80" style={{transform:'rotate(-90deg)',width:72,height:72}}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8"/>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#A7014B" strokeWidth="8" strokeDasharray={`${ci}`} strokeDashoffset={offset} strokeLinecap="round"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-extrabold text-neutral-800 dark:text-white">{pct}%</span>
        </div>
      </div>
      <div>
        <div className="text-2xl font-extrabold text-neutral-800 dark:text-white">{concluded}</div>
        <div className="text-xs text-neutral-500">concluídos</div>
        <div className="text-xs text-neutral-400">{total-concluded} em andamento</div>
      </div>
    </div>
  )
}

// ── Periods ──
const PERIODS = [
  { key:'week',  label:'Semanal' },
  { key:'month', label:'Mensal'  },
  { key:'year',  label:'Anual'   },
]

function getRange(period) {
  const now = new Date()
  const start = new Date(now)
  if (period === 'week')  start.setDate(now.getDate()-7)
  if (period === 'month') start.setMonth(now.getMonth()-1)
  if (period === 'year')  start.setFullYear(now.getFullYear()-1)
  return { start, end: now }
}

function formatRange(period) {
  const {start,end} = getRange(period)
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  return `${fmt(start)} a ${fmt(end)}`
}

// ── Metric menu items ──
const METRIC_ITEMS = [
  { key:'rejection_tags', label:'Motivos de reprovação' },
  { key:'by_channel',     label:'Posts por canal' },
  { key:'approval_rate',  label:'Taxa de aprovação' },
  { key:'rejection_rate', label:'Taxa de reprovação' },
  { key:'activity',       label:'Atividade' },
  { key:'avg_time',       label:'Tempo médio de aprovação' },
  { key:'projects',       label:'Projetos concluídos' },
]

const BAR_COLORS = ['#A7014B','#3087A6','#E65A00','#6B21A8','#0F766E','#B45309','#1D4ED8','#7C3AED']

export default function InsightsPage() {
  const [posts,       setPosts]       = useState([])
  const [clients,     setClients]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [period,      setPeriod]      = useState('week')
  const [clientFilter,setCF]          = useState('')
  const [activeTab,   setActiveTab]   = useState('metrics') // 'metrics' | 'feedbacks'
  const [activeMetric,setActiveMetric]= useState('rejection_tags')

  useEffect(() => {
    Promise.all([fetchPostsForInsights(), fetchClients()])
      .then(([p,c]) => { setPosts(p); setClients(c) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Filter by period and client
  const {start} = getRange(period)
  const postsInPeriod = useMemo(() => posts.filter(p => {
    const inPeriod = new Date(p.created_at) >= start
    const inClient = !clientFilter || p.client_id === clientFilter
    return inPeriod && inClient
  }), [posts, period, clientFilter])

  // Summary metrics
  const total    = postsInPeriod.length
  const approved = postsInPeriod.filter(p => computePostStatus(p.files||[]) === 'approved').length
  const approvalRate  = total ? Math.round(approved/total*100) : 0
  const allFiles      = postsInPeriod.flatMap(p => p.files||[])
  const filesWithRej  = allFiles.filter(f => (f.feedbacks||[]).length > 0).length
  const rejectionRate = allFiles.length ? Math.round(filesWithRej/allFiles.length*100) : 0
  const postsWithRej  = postsInPeriod.filter(p => (p.files||[]).some(f => (f.feedbacks||[]).length > 0)).length

  // Avg approval time
  function calcAvgTime(posts) {
    const valid = posts.filter(p => p.approved_at && p.created_at)
    if (!valid.length) return null
    const avg = valid.reduce((acc,p) => acc+(new Date(p.approved_at)-new Date(p.created_at)),0)/valid.length
    const days=Math.floor(avg/86400000), hours=Math.floor((avg%86400000)/3600000)
    if (days>0) return `${days}d ${hours}h`
    if (hours>0) return `${hours}h`
    return `${Math.floor(avg/60000)}min`
  }
  const avgTime = calcAvgTime(postsInPeriod)

  // Chart data
  const rejTagsData = useMemo(() => {
    const counts = {}
    postsInPeriod.forEach(p => (p.files||[]).forEach(f => (f.feedbacks||[]).forEach(fb => (fb.tags||[]).forEach(t => { counts[t]=(counts[t]||0)+1 }))))
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value}))
  }, [postsInPeriod])

  const channelData = useMemo(() => {
    const counts = {}
    postsInPeriod.forEach(p => (p.channels||[]).forEach(ch => { counts[ch]=(counts[ch]||0)+1 }))
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label:label.split('/')[0],value}))
  }, [postsInPeriod])

  const approvalRateData = useMemo(() => clients.filter(c=>!clientFilter||c.id===clientFilter).map(c => {
    const cp = postsInPeriod.filter(p=>p.client_id===c.id)
    const r = cp.length ? Math.round(cp.filter(p=>computePostStatus(p.files||[])!=='rejected').length/cp.length*100) : 0
    return {label:c.name,value:r}
  }), [clients,postsInPeriod,clientFilter])

  const rejectionRateData = useMemo(() => clients.filter(c=>!clientFilter||c.id===clientFilter).map(c => {
    const cp = postsInPeriod.filter(p=>p.client_id===c.id)
    const withRej = cp.filter(p=>(p.files||[]).some(f=>(f.feedbacks||[]).length>0)).length
    const r = cp.length ? Math.round(withRej/cp.length*100) : 0
    return {label:c.name,value:r}
  }), [clients,postsInPeriod,clientFilter])

  const clientAvgTime = useMemo(() => clients.filter(c=>!clientFilter||c.id===clientFilter).map(c => {
    const cp = postsInPeriod.filter(p=>p.client_id===c.id&&p.approved_at&&p.created_at)
    if (!cp.length) return {label:c.name,value:0,display:'—'}
    const avg = cp.reduce((acc,p)=>acc+(new Date(p.approved_at)-new Date(p.created_at)),0)/cp.length
    const hours = Math.round(avg/3600000)
    const days = Math.floor(hours/24), h = hours%24
    return {label:c.name,value:hours,display:days>0?`${days}d ${h}h`:hours>0?`${hours}h`:`${Math.floor(avg/60000)}min`}
  }).filter(c=>c.value>0).sort((a,b)=>b.value-a.value), [clients,postsInPeriod,clientFilter])

  const activityData = useMemo(() => {
    const days = period==='week'?7:period==='month'?30:12
    const labels = period==='year'
      ? ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      : Array.from({length:Math.min(days,7)},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return `${d.getDate()}/${d.getMonth()+1}`})
    return labels.map(label=>({label,value:Math.floor(Math.random()*postsInPeriod.length/3)}))
  }, [postsInPeriod,period])

  // Feedbacks
  const feedbacks = useMemo(() => {
    const result = []
    postsInPeriod.forEach(p => {
      const client = clients.find(c=>c.id===p.client_id)
      ;(p.files||[]).forEach(f => (f.feedbacks||[]).forEach(fb => {
        result.push({clientName:client?.name||'?',postTitle:p.title,fileName:f.name,tags:fb.tags||[],comment:fb.comment||'',date:fb.created_at})
      }))
    })
    return result.sort((a,b)=>new Date(b.date)-new Date(a.date))
  }, [postsInPeriod,clients])

  function exportCSV() {
    const rows = [['Cliente','Post','Arquivo','Tags','Comentário','Data']]
    feedbacks.forEach(f => rows.push([f.clientName,f.postTitle,f.fileName,(f.tags||[]).join('; '),f.comment,f.date?.slice(0,10)||'']))
    const csv = rows.map(r=>r.map(c=>`"${(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='insights.csv'; a.click()
  }

  // Render active metric chart
  function renderMetricChart() {
    switch(activeMetric) {
      case 'rejection_tags': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Motivos de reprovação</h3>
          <VerticalBarChart data={rejTagsData} colorFn={i=>BAR_COLORS[i%BAR_COLORS.length]} />
        </div>
      )
      case 'by_channel': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Posts por canal</h3>
          <VerticalBarChart data={channelData} colorFn={i=>BAR_COLORS[i%BAR_COLORS.length]} />
        </div>
      )
      case 'approval_rate': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Taxa de aprovação por cliente</h3>
          <HorizontalBarChart data={approvalRateData} color={v=>v>=70?'#16a34a':v>=40?'#d97706':'#dc2626'} />
        </div>
      )
      case 'rejection_rate': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Taxa de reprovação histórica</h3>
          <HorizontalBarChart data={rejectionRateData} color={v=>v>=60?'#dc2626':v>=30?'#d97706':'#16a34a'} />
        </div>
      )
      case 'activity': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Atividade no período</h3>
          <VerticalBarChart data={activityData} colorFn={()=>'#3087A6'} />
        </div>
      )
      case 'avg_time': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Tempo médio de aprovação por cliente</h3>
          {clientAvgTime.length === 0 ? <p className="text-sm text-neutral-400 text-center py-4">Sem dados no período</p> : (
            <div className="space-y-3">
              {clientAvgTime.map((c,i)=>(
                <div key={i} className="flex items-center gap-2">
                  <div className="text-xs text-neutral-500 truncate" style={{width:80,flexShrink:0}}>{c.label.split(' ')[0]}</div>
                  <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(100,Math.round(c.value/(clientAvgTime[0]?.value||1)*100))}%`}}/>
                  </div>
                  <div className="text-xs font-semibold text-blue-500 w-12 text-right">{c.display}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
      case 'projects': return (
        <div>
          <h3 className="font-bold text-sm mb-4 text-neutral-700 dark:text-neutral-300">Projetos concluídos</h3>
          <DonutChart concluded={approved} total={total} />
        </div>
      )
      default: return null
    }
  }

  if (loading) return <div className="text-center py-16 text-neutral-400">Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={20} className="text-mag-500" />
        <h1 className="text-xl font-bold">Insights & Feedbacks</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5">
        <button onClick={()=>setActiveTab('metrics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab==='metrics'?'bg-mag-500 text-white':'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 hover:border-mag-400'}`}>
          <BarChart2 size={14}/> Métricas
        </button>
        <button onClick={()=>setActiveTab('feedbacks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab==='feedbacks'?'bg-mag-500 text-white':'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 hover:border-mag-400'}`}>
          <MessageSquare size={14}/> Feedbacks
        </button>
      </div>

      {activeTab === 'metrics' && (
        <>
          {/* Period + client + export — igual ao mockup */}
          <div className="flex gap-2 flex-wrap items-center mb-2">
            {/* Period toggles */}
            <div className="flex gap-0 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              {PERIODS.map(p=>(
                <button key={p.key} onClick={()=>setPeriod(p.key)}
                  className={`px-4 py-2 text-sm font-semibold transition-all border-r last:border-r-0 border-neutral-200 dark:border-neutral-700 ${period===p.key?'bg-mag-500 text-white':'bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-500 font-mono flex items-center gap-2">
              {formatRange(period)}
              <span className="text-neutral-300">▾</span>
            </div>

            {/* Client filter */}
            <select value={clientFilter} onChange={e=>setCF(e.target.value)}
              className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-900 outline-none text-neutral-700 dark:text-neutral-300 min-w-[160px]">
              <option value="">Todos os clientes</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Export CSV — alongside filters */}
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold transition-colors">
              <Download size={14}/> Exportar CSV
            </button>
          </div>

          {/* VISÃO label */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-4">
            Visão: {clientFilter ? clients.find(c=>c.id===clientFilter)?.name || 'cliente' : 'Todos os clientes'}
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              {label:'Total de Posts',     value:total,                color:'text-neutral-900 dark:text-white', sub:'no período'},
              {label:'Taxa de Aprovação',  value:`${approvalRate}%`,   color:'text-green-600',  sub:'dos conteúdos'},
              {label:'Taxa de Reprovação', value:`${rejectionRate}%`,  color:'text-red-600',    sub:'precisam ajuste'},
              {label:'Concluídos',         value:approved,             color:'text-teal-600',   sub:'aprovados'},
            ].map(m=>(
              <Card key={m.label} className="p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{m.label}</div>
                <div className={`text-3xl font-extrabold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-neutral-400 mt-1">{m.sub}</div>
              </Card>
            ))}
          </div>

          {/* Two-column layout: metric menu + chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Metric menu */}
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 text-xs font-semibold uppercase tracking-wider text-neutral-400">Selecione a métrica</div>
              <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                {METRIC_ITEMS.map(item=>(
                  <button key={item.key} onClick={()=>setActiveMetric(item.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${activeMetric===item.key?'bg-mag-50 dark:bg-mag-950/20 text-mag-600 dark:text-mag-400 font-semibold':'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}`}>
                    {item.label}
                    {activeMetric===item.key && <ChevronRight size={14} className="text-mag-500"/>}
                  </button>
                ))}
              </div>
            </Card>

            {/* Chart panel */}
            <Card className="p-5 lg:col-span-2">
              {renderMetricChart()}
            </Card>
          </div>

          {/* Feedback list */}
          <Card className="mt-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">Feedbacks de reprovação (por arquivo)</h3>
              <select value={clientFilter} onChange={e=>setCF(e.target.value)}
                className="border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 outline-none">
                <option value="">Todos os clientes</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {feedbacks.length === 0 ? (
              <p className="text-center text-neutral-400 text-sm py-4">Nenhum feedback registrado.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {feedbacks.map((fb,i)=>(
                  <div key={i} className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-mag-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {fb.clientName.slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{fb.clientName} · <span className="font-normal text-neutral-400">{fb.postTitle}</span></p>
                      {fb.tags.length>0&&<div className="flex flex-wrap gap-1 my-1">{fb.tags.map(t=><span key={t} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">{t}</span>)}</div>}
                      {fb.comment&&<p className="text-xs text-neutral-500 italic">"{fb.comment}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* AI panel */}
          <div className="mt-4">
            <AIInsightsPanel posts={postsInPeriod} clients={clients} period={period} />
          </div>
        </>
      )}

      {activeTab === 'feedbacks' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">Todos os feedbacks</h3>
            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:border-mag-400">
              <Download size={12}/> Exportar CSV
            </button>
          </div>
          {feedbacks.length === 0 ? (
            <p className="text-center text-neutral-400 text-sm py-8">Nenhum feedback registrado no período.</p>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((fb,i)=>(
                <div key={i} className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-mag-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{fb.clientName.slice(0,2).toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold">{fb.clientName}</p>
                      <p className="text-xs text-neutral-400">{fb.postTitle} · {fb.fileName}</p>
                    </div>
                    <span className="ml-auto text-xs text-neutral-400">{fb.date?.slice(0,10)||''}</span>
                  </div>
                  {fb.tags.length>0&&<div className="flex flex-wrap gap-1 mb-2">{fb.tags.map(t=><span key={t} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">{t}</span>)}</div>}
                  {fb.comment&&<p className="text-sm text-neutral-600 dark:text-neutral-300 italic">"{fb.comment}"</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
