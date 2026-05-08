import clsx from 'clsx'

const variants = {
  primary:   'bg-mag-500 hover:bg-mag-600 text-white',
  secondary: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-teal-500 hover:text-teal-500 text-neutral-700 dark:text-neutral-200',
  danger:    'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100',
  ghost:     'bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
  teal:      'bg-teal-500 hover:bg-teal-600 text-white',
}

const sizes = {
  sm:  'px-3 py-1.5 text-xs',
  md:  'px-4 py-2.5 text-sm',
  lg:  'px-6 py-3 text-base',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  className, disabled, loading, icon, ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-lg',
        'transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {!loading && icon && <span>{icon}</span>}
      {children}
    </button>
  )
}
