import clsx from 'clsx'

export default function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </label>
      )}
      <input
        {...props}
        className={clsx(
          'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all',
          'bg-white dark:bg-neutral-800',
          'text-neutral-900 dark:text-neutral-100',
          'placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
          error
            ? 'border-red-400 focus:border-red-500'
            : 'border-neutral-200 dark:border-neutral-700 focus:border-mag-500',
          className
        )}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </label>
      )}
      <textarea
        {...props}
        className={clsx(
          'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all resize-y min-h-[90px]',
          'bg-white dark:bg-neutral-800',
          'text-neutral-900 dark:text-neutral-100',
          'placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
          error
            ? 'border-red-400 focus:border-red-500'
            : 'border-neutral-200 dark:border-neutral-700 focus:border-mag-500',
          className
        )}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </label>
      )}
      <select
        {...props}
        className={clsx(
          'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all',
          'bg-white dark:bg-neutral-800',
          'text-neutral-900 dark:text-neutral-100',
          'border-neutral-200 dark:border-neutral-700 focus:border-mag-500',
          className
        )}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
