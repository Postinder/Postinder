import clsx from 'clsx'

export default function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-2xl border bg-white dark:bg-neutral-900',
        'border-neutral-200 dark:border-neutral-800',
        hover && 'transition-shadow hover:shadow-lg cursor-pointer',
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
