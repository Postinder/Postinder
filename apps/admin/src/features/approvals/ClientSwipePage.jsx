import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, RotateCcw, FileText, Mail, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { fetchClientQueue, approveFile, rejectFile, submitClientFeedback } from '../../services/approvals.service'
import { REJECTION_TAGS } from '../../utils/constants'
import { StatusDot, getStatusDotClass } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

// ─── helpers ───────────────────────────────────────────────────────────────
function fileIcon(ft) {
  const t = (ft || '').toUpperCase()
  if (t === 'VIDEO') return '🎬'
  if (t === 'AUDIO') return '🎵'
  if (t === 'PDF')   return '📄'
  if (t === 'DOC')   return '📝'
  if (t === 'SHEET') return '📊'
  if (t === 'PPTX')  return '📋'
  return '📎'
}

function MediaPreview({ file, isEmail, post, compact = false }) {
  const [imgErr, setImgErr] = useState(false)
  const ft = (file?.file_type || '').toUpperCase()
  const name = file?.name || ''
  const h = compact ? 'min-h-[120px]' : 'min-h-[260px]'

  if (isEmail) return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 bg-blue-950/30 ${h}`}>
      <Mail size={compact ? 32 : 48} className="text-blue-400" />
      <a href={post?.email_link} target="_blank" rel="noopener noreferrer"
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
        Visualizar E-mail
      </a>
    </div>
  )

  if (ft === 'VIDEO' || /\.(mp4|mov|avi|webm|mkv)$/i.test(name)) return (
    <div className={`bg-black flex items-center justify-center ${h}`}>
      {compact
        ? <span className="text-4xl">🎬</span>
        : <video src={file?.storage_url} controls className="w-full max-h-[400px] outline-none" preload="metadata" />
      }
    </div>
  )

  if (ft === 'AUDIO' || /\.(mp3|wav|ogg|aac|flac)$/i.test(name)) return (
    <div className={`flex flex-col items-center justify-center gap-3 bg-purple-950/30 ${h}`}>
      <span className="text-5xl">🎵</span>
      {!compact && <audio src={file?.storage_url} controls className="w-full max-w-xs px-4" />}
      <p className="text-xs text-purple-300 px-4 text-center truncate max-w-full">{name}</p>
    </div>
  )

  if (ft === 'PDF' || /\.pdf$/i.test(name)) return (
    <div className={`flex flex-col items-center justify-center gap-3 bg-orange-950/30 ${h}`}>
      <FileText size={compact ? 32 : 52} className="text-orange-400" />
      <p className="text-sm font-medium text-center px-4 line-clamp-2">{name}</p>
      {!compact && file?.storage_url &&
        <a href={file.storage_url} target="_blank" rel="noopener noreferrer"
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold">
          ⬇ Abrir PDF
        </a>
      }
    </div>
  )

  if (ft === 'IMAGE' || /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)) {
    if (!imgErr && file?.storage_url) return (
      <img src={file.storage_url} alt={name} onError={() => setImgErr(true)}
        className={`w-full object-contain bg-neutral-900 ${compact ? 'h-[120px]' : 'max-h-[400px]'}`} />
    )
  }

  if (!imgErr && file?.storage_url && ft !== 'DOC' && ft !== 'SHEET' && ft !== 'PPTX') return (
    <img src={file.storage_url} alt={name} onError={() => setImgErr(true)}
      className={`w-full object-contain bg-neutral-900 ${compact ? 'h-[120px]' : 'max-h-[400px]'}`} />
  )

  const icon = fileIcon(ft)
  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-neutral-900 ${h}`}>
      <span className={compact ? 'text-3xl' : 'text-6xl'}>{icon}</span>
      <p className="text-xs text-neutral-400 px-4 text-center truncate max-w-full">{name}</p>
    </div>
  )
}

// ─── swipe card ────────────────────────────────────────────────────────────
function SwipeCard({ item, onApprove, onReject, stackIndex = 0 }) {
  const cardRef = useRef(null)
  const drag = useRef({ on: false, sx: 0, cx: 0 })
  const { post, file, fileIndex, totalFiles, isEmail } = item

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
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`
      const approve = card.querySelector('.hint-approve')
      const reject  = card.querySelector('.hint-reject')
      if (approve) approve.style.opacity = dx > 40 ? Math.min(1, (dx - 40) / 60) : 0
      if (reject)  reject.style.opacity  = dx < -40 ? Math.min(1, (-dx - 40) / 60) : 0
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
      if (dx > 80) {
        card.style.transition = 'transform .35s, opacity .35s'
        card.style.transform = 'translateX(150%) rotate(20deg)'
        card.style.opacity = '0'
        setTimeout(onApprove, 350)
      } else if (dx < -80) {
        card.style.transition = 'transform .35s, opacity .35s'
        card.style.transform = 'translateX(-150%) rotate(-20deg)'
        card.style.opacity = '0'
        setTimeout(onReject, 350)
      } else {
        card.style.transition = 'transform .3s'
        card.style.transform = ''
        const approve = card.querySelector('.hint-approve')
        const reject  = card.querySelector('.hint-reject')
        if (approve) approve.style.opacity = 0
        if (reject)  reject.style.opacity  = 0
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
  }

  const scale = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.96 : 0.92
  const translateY = stackIndex === 0 ? 0 : stackIndex === 1 ? 8 : 16

  return (
    <div
      ref={stackIndex === 0 ? cardRef : null}
      onMouseDown={stackIndex === 0 ? startDrag : undefined}
      onTouchStart={stackIndex === 0 ? startDrag : undefined}
      className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
      style={{
        transform: `scale(${scale}) translateY(-${translateY}px)`,
        zIndex: 10 - stackIndex,
        cursor: stackIndex === 0 ? 'grab' : 'default',
        pointerEvents: stackIndex === 0 ? 'auto' : 'none',
      }}
    >
      {stackIndex === 0 && <>
        {/* Swipe hints */}
        <div className="hint-approve absolute inset-0 bg-green-500/20 border-4 border-green-500 rounded-2xl flex items-center justify-center opacity-0 z-20 pointer-events-none transition-none">
          <span className="bg-green-500 text-white px-6 py-3 rounded-full font-extrabold text-xl -rotate-12">APROVAR ✓</span>
        </div>
        <div className="hint-reject absolute inset-0 bg-red-500/20 border-4 border-red-500 rounded-2xl flex items-center justify-center opacity-0 z-20 pointer-events-none transition-none">
          <span className="bg-red-500 text-white px-6 py-3 rounded-full font-extrabold text-xl rotate-12">RECUSAR ✗</span>
        </div>

        {/* File counter */}
        {totalFiles > 1 && (
          <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {fileIndex + 1}/{totalFiles}
          </div>
        )}

        {/* Media */}
        <MediaPreview file={file} isEmail={isEmail} post={post} />

        {/* Info */}
        <div className="p-4">
          <h3 className="font-bold text-base text-neutral-900 dark:text-white leading-tight mb-1 line-clamp-1">
            {post?.title || 'Sem título'}
          </h3>
          {post?.caption && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">{post.caption}</p>
          )}
          {totalFiles > 1 && (
            <p className="text-xs text-neutral-400 mt-1">Arquivo {fileIndex + 1} de {totalFiles}: <strong>{file?.name}</strong></p>
          )}
        </div>
      </>}
    </div>
  )
}

// ─── status drawer ──────────────────────────────────────────────────────────
function StatusDrawer({ title, items, emptyMsg, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-t-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {items.length === 0
            ? <p className="text-center text-neutral-400 py-8">{emptyMsg}</p>
            : <div className="grid grid-cols-3 gap-2">
                {items.map((item, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative">
                    <MediaPreview file={item.file} isEmail={item.isEmail} post={item.post} compact />
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

// ─── reject sheet ────────────────────────────────────────────────────────────
function RejectSheet({ open, onClose, onSubmit }) {
  const [selTags, setSelTags] = useState([])
  const [comment, setComment] = useState('')

  function handleSubmit() {
    if (!selTags.length && !comment.trim()) { toast.error('Selecione um motivo.'); return }
    onSubmit(selTags, comment)
    setSelTags([]); setComment('')
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-t-3xl p-5">
        <h3 className="font-bold text-base mb-1">Por que você recusou?</h3>
        <p className="text-sm text-neutral-500 mb-4">Selecione os motivos e deixe um comentário.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {REJECTION_TAGS.map(tag => (
            <button key={tag} onClick={() => setSelTags(s => s.includes(tag) ? s.filter(t => t !== tag) : [...s, tag])}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selTags.includes(tag) ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'}`}>
              {tag}
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Descreva o que precisa ser ajustado..."
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm bg-white dark:bg-neutral-800 h-24 resize-none mb-4 outline-none focus:border-red-400" />
        <button onClick={handleSubmit}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-colors">
          Enviar feedback
        </button>
      </div>
    </div>
  )
}

// ─── feedback modal ──────────────────────────────────────────────────────────
function FeedbackModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-t-3xl p-6">
        <h3 className="text-lg font-bold mb-1">Sua opinião importa 💙</h3>
        <p className="text-sm text-neutral-500 mb-4">Deixe um comentário para a agência.</p>
        <div className="flex gap-2 mb-4">
          {[1,2,3,4,5].map(i => (
            <button key={i} onClick={() => setRating(i)}
              className={`text-3xl transition-transform active:scale-125 ${i <= rating ? 'text-amber-400' : 'text-neutral-200 dark:text-neutral-700'}`}>★</button>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Sugestões, elogios ou melhorias..."
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm bg-white dark:bg-neutral-800 h-28 resize-none mb-4 outline-none focus:border-teal-400" />
        <button onClick={() => { if (!text.trim()) { toast.error('Escreva um comentário.'); return } onSubmit(rating, text) }}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl transition-colors mb-2">
          Enviar 😊
        </button>
        <button onClick={onClose} className="w-full text-center text-sm text-neutral-400 py-2">Pular por agora</button>
      </div>
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────────────
export default function ClientSwipePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [queue, setQueue]         = useState([])
  const [idx, setIdx]             = useState(0)
  const [history, setHistory]     = useState([]) // [{item, approved}]
  const [loading, setLoading]     = useState(true)
  const [rejectOpen, setRejectOpen]   = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [drawer, setDrawer]       = useState(null) // 'pending' | 'approved' | 'rejected'
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

  const isDone      = idx >= queue.length
  const current     = queue[idx]
  const approvedItems = history.filter(h => h.approved).map(h => h.item)
  const rejectedItems = history.filter(h => !h.approved).map(h => h.item)
  const pendingItems  = queue.slice(idx)
  const pendingCount  = queue.length - idx

  const handleApprove = useCallback(async () => {
    const item = queue[idx]
    if (!item) return
    try {
      if (item.file?.id) await approveFile(item.file.id)
      setHistory(h => [...h, { item, approved: true }])
      setIdx(i => i + 1)
      toast.success('Aprovado! ✓', { icon: '✅', duration: 1500 })
    } catch (e) { toast.error(e.message) }
  }, [idx, queue])

  function openReject() {
    setPendingRejectIdx(idx)
    setRejectOpen(true)
  }

  async function submitReject(tags, comment) {
    const item = queue[pendingRejectIdx]
    try {
      if (item?.file?.id) await rejectFile(item.file.id, tags, comment)
      setHistory(h => [...h, { item, approved: false }])
      setIdx(i => i + 1)
      setRejectOpen(false)
      toast('Feedback enviado.', { icon: '📝', duration: 1500 })
    } catch (e) { toast.error(e.message) }
  }

  function handleBack() {
    if (idx <= 0 || history.length === 0) return
    setIdx(i => i - 1)
    setHistory(h => h.slice(0, -1))
    toast('Voltando um passo.', { duration: 1200 })
  }

  async function handleFeedback(rating, text) {
    try {
      const month = new Date().toISOString().slice(0, 7)
      await submitClientFeedback(user.id, rating, text, month)
      setFeedbackOpen(false)
      toast.success('Obrigado pelo feedback! 😊')
    } catch (e) { toast.error(e.message) }
  }

  function handleExit() { logout(); navigate('/login') }

  // Stat pill config
  const stats = [
    { key: 'pending', count: pendingCount,          label: 'pendente',  labelPlural: 'pendentes' },
    { key: 'approved', count: approvedItems.length,   label: 'aprovado',  labelPlural: 'aprovados' },
    { key: 'rejected', count: rejectedItems.length,   label: 'recusado',  labelPlural: 'recusados' },
  ]

  const drawerMeta = {
    pending:  { title: `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`,         items: pendingItems,  empty: 'Nenhum conteúdo pendente.' },
    approved: { title: `${approvedItems.length} aprovado${approvedItems.length !== 1 ? 's' : ''}`, items: approvedItems, empty: 'Nenhum conteúdo aprovado ainda.' },
    rejected: { title: `${rejectedItems.length} recusado${rejectedItems.length !== 1 ? 's' : ''}`, items: rejectedItems, empty: 'Nenhum conteúdo recusado ainda.' },
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-neutral-400">
      <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-mag-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando conteúdos...</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stat pills ── */}
      <div className="flex gap-2 justify-center flex-wrap">
        {stats.map(s => (
          <button key={s.key} onClick={() => setDrawer(s.key)}
            className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-sm border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors active:scale-95">
            <StatusDot status={s.key} className="h-2 w-2" />
            <strong>{s.count}</strong>
            <span className="text-neutral-400">{s.count === 1 ? s.label : s.labelPlural}</span>
          </button>
        ))}
      </div>

      {/* ── Hint ── */}
      {!isDone && (
        <p className="text-center text-xs text-neutral-400">
          {window.innerWidth <= 768
            ? 'Deslize → para aprovar · ← para recusar'
            : 'Use → para aprovar · ← para recusar · ↓ para voltar'}
        </p>
      )}

      {/* ── Main area ── */}
      {isDone ? (
        /* ── Done screen ── */
        <div className="flex flex-col items-center text-center py-6 animate-fade-in">
          <div className="text-6xl mb-3">🎉</div>
          <h2 className="text-2xl font-extrabold mb-1">Você está em dia!</h2>
          <p className="text-neutral-500 text-sm mb-6">Todos os conteúdos foram revisados.</p>

          {/* Summary stats */}
          <div className="flex gap-3 mb-6">
            {[
              { status: 'approved', count: approvedItems.length, label: 'aprovados' },
              { status: 'rejected', count: rejectedItems.length, label: 'recusados' },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-full px-4 py-2 shadow border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
                <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotClass(s.status)}`} />
                <strong>{s.count}</strong> {s.label}
              </div>
            ))}
          </div>

          {/* Approved grid preview */}
          {approvedItems.length > 0 && (
            <div className="w-full mb-6">
              <button onClick={() => setDrawer('approved')}
                className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1 mx-auto hover:text-green-500 transition-colors">
                Conteúdos aprovados <span className="text-xs">→</span>
              </button>
              <div className="grid grid-cols-3 gap-2">
                {approvedItems.slice(0, 6).map((item, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <MediaPreview file={item.file} isEmail={item.isEmail} post={item.post} compact />
                  </div>
                ))}
              </div>
              {approvedItems.length > 6 && (
                <button onClick={() => setDrawer('approved')}
                  className="text-xs text-neutral-400 mt-2 hover:text-neutral-600">
                  +{approvedItems.length - 6} mais →
                </button>
              )}
            </div>
          )}

          {/* Rejected preview */}
          {rejectedItems.length > 0 && (
            <div className="w-full mb-6">
              <button onClick={() => setDrawer('rejected')}
                className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1 mx-auto hover:text-red-500 transition-colors">
                Conteúdos recusados <span className="text-xs">→</span>
              </button>
              <div className="grid grid-cols-3 gap-2">
                {rejectedItems.slice(0, 3).map((item, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative">
                    <MediaPreview file={item.file} isEmail={item.isEmail} post={item.post} compact />
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                      <XCircle size={24} className="text-red-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => setFeedbackOpen(true)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl transition-colors">
              💬 Enviar sugestão à agência
            </button>
            <button onClick={handleExit}
              className="w-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold py-3.5 rounded-xl transition-colors">
              ↩ Sair do sistema
            </button>
          </div>
        </div>
      ) : (
        /* ── Swipe area ── */
        <div className="flex flex-col gap-5">
          {/* Card stack */}
          <div className="relative w-full" style={{ height: 480 }}>
            {[2, 1, 0].map(offset => {
              const item = queue[idx + offset]
              if (!item) return null
              return <SwipeCard key={idx + offset} item={item} stackIndex={offset} onApprove={handleApprove} onReject={openReject} />
            })}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center items-center gap-5 pb-2">
            <button onClick={openReject}
              className="w-16 h-16 rounded-full bg-white dark:bg-neutral-900 border-2 border-red-400 text-red-400 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
              title="Recusar">
              <XCircle size={28} />
            </button>
            <button onClick={handleBack} disabled={idx === 0}
              className="w-12 h-12 rounded-full bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 text-neutral-400 flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform disabled:opacity-30"
              title="Voltar">
              <RotateCcw size={18} />
            </button>
            <button onClick={handleApprove}
              className="w-16 h-16 rounded-full bg-white dark:bg-neutral-900 border-2 border-green-500 text-green-500 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
              title="Aprovar">
              <CheckCircle size={28} />
            </button>
          </div>
        </div>
      )}

      {/* ── Drawers / Modals ── */}
      {drawer && (
        <StatusDrawer
          title={drawerMeta[drawer].title}
          items={drawerMeta[drawer].items}
          emptyMsg={drawerMeta[drawer].empty}
          onClose={() => setDrawer(null)}
        />
      )}

      <RejectSheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={submitReject}
      />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={handleFeedback}
      />
    </div>
  )
}
