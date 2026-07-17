export default function PortalMetricsBar({ items }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 xl:grid-cols-4">
      {items.map(({ id, icon, label, value, sub }) => (
        <div
          key={id}
          className="min-w-0 border-b border-r border-neutral-100 p-3 last:border-r-0 dark:border-neutral-800 sm:p-4 xl:border-b-0"
        >
          <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
            <span className="text-mag-600 dark:text-mag-300" aria-hidden="true">{icon}</span>
            <span className="truncate text-[10px] font-black uppercase tracking-wide sm:text-[11px]">{label}</span>
          </div>
          <div className="mt-1.5 truncate text-lg font-black text-neutral-950 dark:text-white sm:text-xl">{value}</div>
          {sub ? <div className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{sub}</div> : null}
        </div>
      ))}
    </div>
  )
}
