import { CheckCircle, Loader2, XCircle } from 'lucide-react'

export default function PortalReviewActions({ onReject, onApprove, busy, compact = false, className = '', decision = null }) {
  const buttonSize = compact ? 'min-h-10 px-3 py-2 text-xs' : 'min-h-12 flex-1 px-4 py-3 text-sm'

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={onReject}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label="Reprovar"
        aria-pressed={decision === 'rejected'}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-neutral-950 ${decision === 'rejected' ? 'border-red-600 bg-red-600 text-white ring-2 ring-red-200' : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'} ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <XCircle size={compact ? 16 : 19} aria-hidden="true" />}
        {decision === 'rejected' ? 'Reprovado' : 'Reprovar'}
      </button>
      <button
        type="button"
        onClick={onApprove}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label="Aprovar"
        aria-pressed={decision === 'approved'}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-black text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-neutral-950 ${decision === 'approved' ? 'bg-green-700 ring-2 ring-green-200' : 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500'} ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={compact ? 16 : 19} aria-hidden="true" />}
        {decision === 'approved' ? 'Aprovado' : 'Aprovar'}
      </button>
    </div>
  )
}
