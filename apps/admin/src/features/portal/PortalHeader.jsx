import ThemeToggle from '../../components/ui/ThemeToggle'
import { formatDate } from './portalStatus'

export default function PortalHeader({ clientName, expiresAt, isAuthenticated, onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[52px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mag-600 text-xs font-black text-white">P</div>
          <div className="flex min-w-0 items-baseline gap-2">
            <div className="text-sm font-black tracking-tight text-neutral-950 dark:text-white">Postinder</div>
            <div className="hidden text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400 md:block">Portal de revisão</div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {isAuthenticated && clientName ? (
            <span className="hidden max-w-[15rem] truncate text-sm font-semibold text-neutral-600 dark:text-neutral-300 sm:block">
              Olá, <strong>{clientName}</strong>
            </span>
          ) : null}
          {!isAuthenticated && expiresAt ? (
            <span className="inline-flex max-w-[8.5rem] truncate rounded-full border border-neutral-200 px-2 py-1.5 text-[10px] font-semibold text-neutral-500 dark:border-neutral-700 dark:text-neutral-400 sm:max-w-none sm:px-3 sm:text-xs">
              Válido até {formatDate(expiresAt)}
            </span>
          ) : null}
          <ThemeToggle />
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair do portal"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-500 transition hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mag-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:text-neutral-300 dark:focus-visible:ring-offset-neutral-900"
            >
              Sair
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
