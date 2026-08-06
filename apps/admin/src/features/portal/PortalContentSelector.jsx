import { CalendarDays, CheckCircle, RefreshCw } from 'lucide-react'
import PortalChannelChips from './PortalChannelChips'
import { formatDate, hasSafeEmailPreview, isCorrectionPost, isPendingFile } from './portalStatus'

function scheduledDate(content) {
  return content?.scheduledDate || content?.scheduled_date
}

function ContentOption({ content, active, interactive, onSelect }) {
  const pendingCount = (content.files || []).filter(isPendingFile).length
    + (!(content.files || []).length && hasSafeEmailPreview(content) ? 1 : 0)
  const correction = isCorrectionPost(content)
  const sharedClassName = `w-full min-w-[16rem] rounded-xl border p-3 text-left transition xl:min-w-0 xl:px-3 xl:py-2.5 ${
    active
      ? 'border-[var(--portal-brand-border)] bg-[var(--portal-brand-soft)] shadow-sm ring-1 ring-[var(--portal-brand-selection-ring)]'
      : 'border-neutral-200 bg-white hover:border-[var(--portal-brand-border)] dark:border-neutral-800 dark:bg-neutral-900'
  }`

  const contentBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-extrabold leading-5 text-neutral-950 dark:text-white">
          {content.title || 'Conteúdo sem título'}
        </h3>
        {pendingCount ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {pendingCount}
          </span>
        ) : (
          <CheckCircle size={16} className="shrink-0 text-green-600" aria-label="Sem itens pendentes" />
        )}
      </div>

      <div className="mt-2 xl:mt-1.5">
        <PortalChannelChips channels={content.channels || []} compact />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-300/80 xl:mt-1.5">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} aria-hidden="true" />
          {formatDate(scheduledDate(content), 'Sem data prevista')}
        </span>
        {correction ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <RefreshCw size={11} aria-hidden="true" /> Correção
          </span>
        ) : null}
      </div>
    </>
  )

  if (!interactive) {
    return <div className={sharedClassName}>{contentBody}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(content.id)}
      aria-pressed={active}
      className={`${sharedClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-brand-focus)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950`}
    >
      {contentBody}
    </button>
  )
}

export default function PortalContentSelector({ contents, totalPendingItems, selectedContentId, onSelectContent }) {
  const interactive = contents.length > 1
  const itemLabel = totalPendingItems === 1 ? 'item' : 'itens'
  const contentLabel = contents.length === 1 ? 'conteúdo' : 'conteúdos'

  return (
    <aside className="min-w-0 xl:w-[clamp(15rem,17vw,16.5rem)] xl:shrink-0" aria-label="Conteúdos para aprovar">
      <div className="mb-2 px-1 text-center">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-300">Conteúdos para aprovar</h2>
        <p className="mt-1 text-xs font-bold text-[var(--portal-brand-foreground)]">
          {totalPendingItems} {itemLabel} em {contents.length} {contentLabel}
        </p>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-2 xl:max-h-[calc(100vh-8rem)] xl:flex-col xl:gap-2 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
        {contents.map(content => (
          <div key={content.id} className="snap-start xl:w-full">
            <ContentOption
              content={content}
              active={content.id === selectedContentId}
              interactive={interactive}
              onSelect={onSelectContent}
            />
          </div>
        ))}
      </div>
    </aside>
  )
}
