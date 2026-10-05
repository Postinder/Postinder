import { useRef, useState } from 'react'
import PortalDialog from './PortalDialog'

const limitFeedback = value => Array.from(value).slice(0, 5000).join('')

export default function PositiveFeedbackDialog({ intent, onConfirm, onClose, busy }) {
  const [feedback, setFeedback] = useState(() => limitFeedback(intent.feedback || ''))
  const [sending, setSending] = useState(false)
  const inFlight = useRef(false)
  const input = useRef(null)
  const disabled = busy || sending
  async function confirm() {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setSending(true)
    try {
      const saved = await onConfirm(intent, feedback.trim() || null)
      if (saved !== false) onClose()
    } finally { inFlight.current = false; setSending(false) }
  }
  return <PortalDialog labelledBy="portal-love-title" describedBy="portal-love-description"
    initialFocusRef={input} onClose={() => { if (!disabled) onClose() }}>
    <h3 id="portal-love-title" className="text-lg font-black">Que bom que adorou esse conteúdo!</h3>
    <p id="portal-love-description" className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">O que você mais gostou? Tem alguma sugestão para ampliarmos esse tema?</p>
    <label className="mt-4 block text-sm font-bold" htmlFor="portal-positive-feedback">Feedback positivo (opcional)</label>
    <textarea id="portal-positive-feedback" ref={input} value={feedback} disabled={disabled}
      onChange={event => setFeedback(limitFeedback(event.target.value))}
      className="mt-2 h-28 w-full rounded-lg border border-blue-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-neutral-950" />
    <p className="text-xs text-neutral-500">{Array.from(feedback).length}/5.000 caracteres</p>
    <div className="mt-4 flex gap-3">
      <button type="button" disabled={disabled} onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 disabled:opacity-50">Cancelar</button>
      <button type="button" disabled={disabled} onClick={confirm} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">{disabled ? 'Salvando…' : 'Confirmar Adorei'}</button>
    </div>
  </PortalDialog>
}
