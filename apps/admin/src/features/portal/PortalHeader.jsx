import ThemeToggle from '../../components/ui/ThemeToggle'
import { formatDate } from './portalStatus'

export default function PortalHeader({ clientName, expiresAt, isAuthenticated, onLogout }) {
  return (
    <header className="portal-brand-header sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[52px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex shrink-0 items-center">
            <svg
              viewBox="0 0 220 72"
              role="img"
              aria-label="20Cinco Comunicação"
              className="h-8 w-auto shrink-0 sm:h-9"
            >
              <text x="4" y="58" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="58" fill="white">2</text>
              <circle cx="60" cy="36" r="22" fill="none" stroke="white" strokeWidth="3.5" />
              <circle cx="60" cy="36" r="3" fill="#A7014B" />
              <line x1="60" y1="36" x2="60" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="60" y1="36" x2="72" y2="42" stroke="#A0A0A0" strokeWidth="2.5" strokeLinecap="round" />
              <text x="88" y="46" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="34" fill="white">CINCO</text>
              <text x="89" y="64" fontFamily="Arial" fontSize="13" fill="rgba(255,255,255,0.55)" letterSpacing="2">comunicação</text>
            </svg>
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
