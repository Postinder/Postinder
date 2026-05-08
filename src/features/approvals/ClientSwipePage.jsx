import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, RotateCcw, FileText, Mail, Star } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { fetchClientQueue, approveFile, rejectFile, submitClientFeedback } from '../../services/approvals.service'
import { REJECTION_TAGS, CHANNELS } from '../../utils/constants'
import { FunnelBadge } from '../../components/ui/Badge'
import { BottomSheet } from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import toast from 'react-hot-toast'

// ── Swipe card ──
function SwipeCard({ item, onApprove, onReject }) {
  const cardRef = useRef(null)
  const drag = useRef({ on: false, sx: 0, cx: 0 })
  const { post, file, fileIndex, totalFiles, isEmail } = item
  const isMobile = window.innerWidth <= 768

  function startDrag(e) {
    const pt = e.touches ? e.touches[0] : e
    drag.current = { on: true, sx: pt.clientX, cx: pt.clientX }
    const card = cardRef.current
    if (card) { card.style.transition = 'none'; card.classList.add('cursor-grabbing') }

    function onMove(ev) {
      if (!drag.current.on) return
      if (ev.cancelable) ev.preventDefault()
      const p = ev.touches ? ev.touches[0] : ev
      drag.current.cx = p.clientX
      const dx = drag.current.cx - drag.current.sx
      const card = cardRef.current
      if (!card) return
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.06}deg)`
      const ahn = card.querySelector('.hint-approve')
      const rhn = card.querySelector('.hint-reject')
      if (ahn) ahn.style.opacity = dx > 60 ? Math.min(1, (dx - 60) / 60) : 0
      if (rhn) rhn.style.opacity = dx < -60 ? Math.min(1, (-dx - 60) / 60) : 0
    }

    function onEnd() {
      drag.current.on = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchend', onEnd)
      const card = cardRef.current
      if (!card) return
      card.classList.remove('cursor-grabbing')
      const dx = drag.current.cx - drag.current.sx
      if (dx > 80) { card.style.transition = 'transform 0.4s, opacity 0.4s'; card.style.transform = 'translateX(140%) rotate(20deg)'; card.style.opacity = '0'; setTimeout(onApprove, 400) }
      else if (dx < -80) { card.style.transition = 'transform 0.4s, opacity 0.4s'; card.style.transform = 'translateX(-140%) rotate(-20deg)'; card.style.opacity = '0'; setTimeout(onReject, 400) }
      else { card.style.transition = 'transform 0.3s'; card.style.transform = ''; const ahn = card.querySelector('.hint-approve'); const rhn = card.querySelector('.hint-reject'); if (ahn) ahn.style.opacity = 0; if (rhn) rhn.style.opacity = 0 }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
  }

  const channels = (post.channels || []).map(ch => ({ name: ch, icon: CHANNELS[ch]?.icon || '📌', formats: post.formats?.[ch] || [] }))

  const mediaContent = () => {
    if (isEmail) return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 bg-blue-50 dark:bg-blue-950/30 min-h-[260px]">
        <Mail size={52} className="text-blue-500" />
        <a href={post.email_link} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700">Visualizar E-mail</a>
        <p className="text-xs text-blue-600 dark:text-blue-400 text-center">Abra o link, visualize e volte para aprovar ou recusar</p>
      </div>
    )
    if (file?.file_type === 'PDF' || file?.name?.endsWith('.pdf')) return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 bg-orange-50 dark:bg-orange-950/30 min-h-[260px]">
        <FileText size={52} className="text-orange-500" />
        <p className="text-sm font-medium text-center">{file.name}</p>
        {file.storage_url && <a href={file.storage_url} download className="bg-orange-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-orange-600">⬇ Baixar PDF</a>}
      </div>
    )
    if (file?.storage_url) return <img src={file.storage_url} alt={file.name} className="w-full object-contain bg-neutral-900" style={{ maxHeight: '480px' }} />
    return (
      <div className="flex flex-col items-center justify-center gap-2 min-h-[260px] bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
        <span className="text-5xl">🖼️</span>
        <span className="text-sm">{file?.name || 'Sem arquivo'}</span>
      </div>
    )
  }

  return (
    <div ref={cardRef} onMouseDown={isMobile ? undefined : startDrag} onTouchStart={startDrag}
      className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden select-none border border-neutral-200 dark:border-neutral-800 cursor-grab">
      <div className="hint-approve absolute top-5 left-5 bg-green-500 text-white px-4 py-1.5 rounded-full font-bold text-sm opacity-0 -rotate-12 z-10 pointer-events-none">APROVAR ✓</div>
      <div className="hint-reject absolute top-5 right-5 bg-red-500 text-white px-4 py-1.5 rounded-full font-bold text-sm opacity-0 rotate-12 z-10 pointer-events-none">RECUSAR ✗</div>
      {totalFiles > 1 && <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-bold px-2.5 py-1 rounded-full z-10">{fileIndex + 1}/{totalFiles}</div>}
      {file?.updated_badge && <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full z-10">Conteúdo atualizado</div>}
      <div className="relative">{mediaContent()}</div>
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {channels.map(ch => (
            <span key={ch.name} className="flex items-center gap-1 text-xs bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full font-medium">
              {ch.icon} {ch.name}{ch.formats.length > 0 && <span className="text-neutral-400"> · {ch.formats.join(', ')}</span>}
            </span>
          ))}
        </div>
        <h3 className="font-bold text-lg text-neutral-900 dark:text-white mb-1">{post.title}</h3>
        {totalFiles > 1 && <p className="text-xs text-neutral-500 mb-1">Arquivo {fileIndex+1} de {totalFiles}: <strong>{file?.name}</strong></p>}
        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{post.caption}</p>
        {post.funnel_tag && <div className="mt-3"><FunnelBadge tag={post.funnel_tag} /></div>}
      </div>
    </div>
  )
}

// ── Monthly feedback modal ──
function MonthlyFeedbackModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')

  function handleSubmit() {
    if (!text.trim()) { toast.error('Escreva um comentário.'); return }
    onSubmit(rating, text)
    setRating(0); setText('')
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-3xl p-6 animate-slide-up">
        <h3 className="text-lg font-bold mb-1">Sua opinião importa 💙</h3>
        <p className="text-sm text-neutral-500 mb-4">Deixe uma sugestão ou comentário para a agência.</p>
        <div className="flex gap-2 mb-4">
          {[1,2,3,4,5].map(i => (
            <button key={i} onClick={() => setRating(i)} className={`text-3xl transition-transform hover:scale-110 ${i <= rating ? 'text-amber-400' : 'text-neutral-200'}`}>★</button>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Sugestões, elogios ou melhorias..." className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm outline-none bg-white dark:bg-neutral-800 h-28 resize-none mb-4 focus:border-mag-500" />
        <Button className="w-full justify-center" onClick={handleSubmit}>Enviar 😊</Button>
        <button onClick={onClose} className="w-full text-center text-sm text-neutral-400 mt-3 hover:text-neutral-600">Pular por agora</button>
      </div>
    </div>
  )
}

// ── Summary screen ──
function SummaryScreen({ approvedItems, onFeedback, onExit }) {
  return (
    <div className="text-center py-8 animate-slide-up">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-extrabold mb-2">Você está em dia!</h2>
      <p className="text-neutral-500 text-sm mb-6">Todos os arquivos foram revisados.</p>

      {/* Approved grid */}
      {approvedItems.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-sm text-neutral-600 dark:text-neutral-400 mb-3">Conteúdos aprovados</h3>
          <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto">
            {approvedItems.map((item, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative">
                {item.isEmail
                  ? <div className="w-full h-full flex items-center justify-center text-2xl">📧</div>
                  : item.file?.storage_url
                    ? <img src={item.file.storage_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button onClick={onFeedback} variant="teal" className="justify-center">💬 Enviar sugestão à agência</Button>
        <Button variant="secondary" onClick={onExit} className="justify-center">↩ Sair do sistema</Button>
      </div>
    </div>
  )
}

// ── Main page ──
export default function ClientSwipePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [rejectOpen, setRejectOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [selTags, setSelTags] = useState([])
  const [comment, setComment] = useState('')
  const [pendingRejectIdx, setPendingRejectIdx] = useState(null)

  useEffect(() => {
    fetchClientQueue(user.id)
      .then(q => setQueue(q))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [user.id])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (idx >= queue.length) return
      if (e.key === 'ArrowRight') handleApprove()
      else if (e.key === 'ArrowLeft') openReject()
      else if (e.key === 'ArrowDown' || e.key === 'Backspace') handleBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, queue])

  const isDone = idx >= queue.length
  const current = queue[idx]

  const approvedItems = history.filter(h => h.approved).map(h => queue[h.idx])
  const rejectedCount = history.filter(h => !h.approved).length

  const handleApprove = useCallback(async () => {
    const item = queue[idx]
    if (!item) return
    try {
      if (item.file?.id) await approveFile(item.file.id)
      setHistory(h => [...h, { idx, approved: true }])
      setIdx(i => i + 1)
      toast.success('Aprovado! ✓')
    } catch (e) { toast.error(e.message) }
  }, [idx, queue])

  function openReject() {
    setPendingRejectIdx(idx)
    setRejectOpen(true)
  }

  async function submitReject() {
    if (!selTags.length && !comment.trim()) { toast.error('Selecione um motivo.'); return }
    const item = queue[pendingRejectIdx]
    try {
      if (item?.file?.id) await rejectFile(item.file.id, selTags, comment)
      setHistory(h => [...h, { idx: pendingRejectIdx, approved: false }])
      setIdx(i => i + 1)
      setRejectOpen(false)
      setSelTags([])
      setComment('')
      toast('Feedback enviado.')
    } catch (e) { toast.error(e.message) }
  }

  function handleBack() {
    if (idx <= 0 || history.length === 0) return
    setIdx(i => i - 1)
    setHistory(h => h.slice(0, -1))
    toast('Voltando um passo.')
  }

  async function handleMonthlyFeedback(rating, text) {
    try {
      const month = new Date().toISOString().slice(0, 7)
      await submitClientFeedback(user.id, rating, text, month)
      setFeedbackOpen(false)
      toast.success('Obrigado pelo feedback! 😊')
    } catch (e) { toast.error(e.message) }
  }

  function handleExit() {
    logout()
    navigate('/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-neutral-400">Carregando conteúdos...</div>
  )

  return (
    <div className="py-2">
      {/* Stats */}
      <div className="flex gap-2 justify-center mb-3 flex-wrap">
        {[
          { dot: 'bg-amber-400', count: queue.length - idx, label: 'pendentes' },
          { dot: 'bg-green-500', count: history.filter(h => h.approved).length, label: 'aprovados' },
          { dot: 'bg-red-500',   count: rejectedCount, label: 'recusados' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm border border-neutral-200 dark:border-neutral-800">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <strong>{s.count}</strong> {s.label}
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-neutral-400 mb-3">
        {window.innerWidth <= 768 ? 'Deslize → para aprovar · ← para recusar' : 'Use → para aprovar · ← para recusar · ↓ para voltar'}
      </p>

      {isDone ? (
        <SummaryScreen
          approvedItems={approvedItems}
          onFeedback={() => setFeedbackOpen(true)}
          onExit={handleExit}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SwipeCard
            key={`${current?.post?.id}-${current?.file?.id}-${idx}`}
            item={current}
            onApprove={handleApprove}
            onReject={openReject}
          />
          <p className="text-center text-xs text-neutral-400">
            {queue.length - idx} item{queue.length - idx !== 1 ? 's' : ''} restante{queue.length - idx !== 1 ? 's' : ''}
          </p>
          <div className="flex justify-center gap-4">
            <button onClick={openReject} className="w-14 h-14 rounded-full border-2 border-red-400 text-red-400 bg-white dark:bg-neutral-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform" title="Recusar">
              <XCircle size={24} />
            </button>
            <button onClick={handleBack} disabled={idx === 0} className="w-14 h-14 rounded-full border-2 border-neutral-300 dark:border-neutral-600 text-neutral-400 bg-white dark:bg-neutral-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-30" title="Voltar">
              <RotateCcw size={20} />
            </button>
            <button onClick={handleApprove} className="w-14 h-14 rounded-full border-2 border-green-500 text-green-500 bg-white dark:bg-neutral-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform" title="Aprovar">
              <CheckCircle size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Reject sheet */}
      <BottomSheet open={rejectOpen} onClose={() => setRejectOpen(false)} title="Por que você recusou?" subtitle="Selecione os motivos e deixe um comentário.">
        <div className="flex flex-wrap gap-2 mb-4">
          {REJECTION_TAGS.map(tag => (
            <button key={tag} onClick={() => setSelTags(s => s.includes(tag) ? s.filter(t => t !== tag) : [...s, tag])}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selTags.includes(tag) ? 'bg-mag-500 border-mag-500 text-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'}`}>
              {tag}
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Descreva o que precisa ser ajustado..."
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm outline-none bg-white dark:bg-neutral-800 h-24 resize-none mb-4 focus:border-mag-500" />
        <Button className="w-full justify-center" onClick={submitReject}>Enviar feedback</Button>
      </BottomSheet>

      {/* Monthly feedback */}
      <MonthlyFeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={handleMonthlyFeedback}
      />
    </div>
  )
}
