import clsx from 'clsx'

export default function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-lg border bg-white dark:bg-neutral-900',
        'border-neutral-200 dark:border-neutral-800',
        hover && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-mag-300 hover:shadow-lg hover:shadow-neutral-900/5 dark:hover:border-mag-500/60 dark:hover:shadow-black/20',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={clsx('px-5 py-4 border-b border-neutral-200 dark:border-neutral-800', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }) {
  return <div className={clsx('p-5', className)}>{children}</div>
}
