import { CheckCircle, Heart, Loader2, MessageSquareWarning } from 'lucide-react'

export default function PortalReviewActions({ onReject, onApprove, onLove, busy, compact = false, className = '', decision = null, positiveReaction = null }) {
  const buttonSize = compact ? 'min-h-10 px-2 py-2 text-[11px]' : 'min-h-12 flex-1 px-3 py-3 text-sm'
  const loved = decision === 'approved' && positiveReaction === 'loved'
  const normallyApproved = decision === 'approved' && !loved

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={onLove}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label="Adorei"
        aria-pressed={loved}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-neutral-950 ${loved ? 'border-rose-600 bg-rose-600 text-white ring-2 ring-rose-200' : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950'} ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <Heart size={compact ? 16 : 19} fill={loved ? 'currentColor' : 'none'} aria-hidden="true" />}
        Adorei
      </button>
      <button
        type="button"
        onClick={onApprove}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label="Aprovar"
        aria-pressed={normallyApproved}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-black text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-neutral-950 ${normallyApproved ? 'bg-green-700 ring-2 ring-green-200' : 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500'} ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={compact ? 16 : 19} aria-hidden="true" />}
        Aprovar
      </button>
      <button
        type="button"
        onClick={onReject}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label="Solicitar ajuste"
        aria-pressed={decision === 'rejected'}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-neutral-950 ${decision === 'rejected' ? 'border-red-600 bg-red-600 text-white ring-2 ring-red-200' : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'} ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <MessageSquareWarning size={compact ? 16 : 19} aria-hidden="true" />}
        Solicitar ajuste
      </button>
    </div>
  )
}
