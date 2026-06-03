export default function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} className="shrink-0 text-mag-500" />}
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h1>
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
