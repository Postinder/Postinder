import ThemeToggle from '../../components/ui/ThemeToggle'
import { formatDate } from './portalStatus'
import InstitutionalBrand from '../../components/branding/InstitutionalBrand'

export default function PortalHeader({ clientName, expiresAt, isAuthenticated, onLogout }) {
  return (
    <header className="portal-brand-header sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[52px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex shrink-0 items-center">
            <InstitutionalBrand className="h-9 min-w-[108px] justify-start" imageClassName="max-h-9 max-w-[190px]" fallbackClassName="text-white" />
          </div>
          <div className="hidden truncate text-[9px] font-bold uppercase tracking-[0.14em] text-white/70 md:block">Portal de revisão</div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {isAuthenticated && clientName ? (
            <span className="hidden max-w-[15rem] truncate text-sm font-semibold text-white/90 sm:block">
              Olá, <strong>{clientName}</strong>
            </span>
          ) : null}
          {!isAuthenticated && expiresAt ? (
            <span className="inline-flex max-w-[8.5rem] truncate rounded-full border border-white/25 bg-white/10 px-2 py-1.5 text-[10px] font-semibold text-white/90 sm:max-w-none sm:px-3 sm:text-xs">
              Válido até {formatDate(expiresAt)}
            </span>
          ) : null}
          <ThemeToggle className="portal-theme-toggle" />
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair do portal"
              className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--portal-brand-header-background)]"
            >
              Sair
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
