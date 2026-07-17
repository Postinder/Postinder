import { CheckCircle, Loader2, XCircle } from 'lucide-react'

export default function PortalReviewActions({ fileName, onReject, onApprove, busy, compact = false, className = '' }) {
  const buttonSize = compact ? 'min-h-10 px-3 py-2 text-xs' : 'min-h-12 flex-1 px-4 py-3 text-sm'

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={onReject}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label={`Solicitar ajuste para ${fileName}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 font-black text-red-700 shadow-sm transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950 dark:focus-visible:ring-offset-neutral-950 ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <XCircle size={compact ? 16 : 19} aria-hidden="true" />}
        Solicitar ajuste
      </button>
      <button
        type="button"
        onClick={onApprove}
        onPointerDown={event => event.stopPropagation()}
        disabled={busy}
        aria-label={`Aprovar ${fileName}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 font-black text-white shadow-sm transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500 dark:focus-visible:ring-offset-neutral-950 ${buttonSize}`}
      >
        {busy ? <Loader2 size={compact ? 16 : 19} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={compact ? 16 : 19} aria-hidden="true" />}
        Aprovar
      </button>
    </div>
  )
}
