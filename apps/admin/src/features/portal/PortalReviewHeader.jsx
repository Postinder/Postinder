import { CalendarDays, RefreshCw, RotateCcw } from 'lucide-react'
import PortalChannelChips from './PortalChannelChips'
import { formatDate, isCorrectionPost } from './portalStatus'

export default function PortalReviewHeader({ content, currentPosition, totalFiles, onUndo, canUndo, busy }) {
  const date = content?.scheduledDate || content?.scheduled_date

  return (
    <header className="mb-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
        <span className="shrink-0 rounded-full bg-[var(--portal-brand-soft)] px-2.5 py-1 text-xs font-black text-[var(--portal-brand-foreground)]">
          {currentPosition} de {totalFiles}
        </span>
        {isCorrectionPost(content) ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <RefreshCw size={12} aria-hidden="true" /> Correção
          </span>
        ) : null}
        <h2 className="min-w-[7rem] flex-1 truncate text-base font-black leading-tight text-neutral-950 dark:text-white sm:text-lg">
          {content?.title || 'Conteúdo sem título'}
        </h2>
        <PortalChannelChips channels={content?.channels || []} compact />
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-300/80">
          <CalendarDays size={14} aria-hidden="true" />
          {formatDate(date, 'Sem data prevista')}
        </span>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || busy}
          aria-label="Desfazer a última decisão"
          title="Desfazer a última decisão"
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-600 transition hover:border-[var(--portal-brand-border)] hover:text-[var(--portal-brand-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:focus-visible:ring-offset-neutral-950"
        >
          <RotateCcw size={15} aria-hidden="true" />
          <span className="hidden 2xl:inline">Desfazer</span>
        </button>
      </div>
    </header>
  )
}
