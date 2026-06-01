import Card from './Card'

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = 'p-12',
}) {
  return (
    <Card className={`${className} text-center`}>
      {icon && <div className="mx-auto mb-3 flex justify-center text-neutral-300 dark:text-neutral-600">{icon}</div>}
      <h3 className="mb-1 text-base font-bold text-neutral-800 dark:text-neutral-100">{title}</h3>
      {description && (
        <p className="mx-auto max-w-md text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}
