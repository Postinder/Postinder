import clsx from 'clsx'

const statusStyles = {
  draft:            'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  pending:          'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pending_approval: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved:         'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected:         'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  updated:          'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  delivered:        'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  topo:             'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  meio:             'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  fundo:            'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const statusLabels = {
  draft: 'Rascunho', pending: 'Pendente', pending_approval: 'Aguardando',
  approved: 'Aprovado', rejected: 'Recusado',
  updated: 'Atualizado', delivered: 'Entregue',
  topo: 'Topo', meio: 'Meio', fundo: 'Fundo',
}

export function StatusBadge({ status, className }) {
  return (
    <span className={clsx(
      'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border border-transparent',
      statusStyles[status] || 'bg-neutral-100 text-neutral-600',
      className
    )}>
      {statusLabels[status] || status}
    </span>
  )
}

export function FunnelBadge({ tag }) {
  if (!tag) return null
  return (
    <span className={clsx(
      'inline-block px-2.5 py-0.5 rounded-full text-xs font-bold',
      statusStyles[tag]
    )}>
      {statusLabels[tag]}
    </span>
  )
}

export function Avatar({ name = '', color = '#A7014B', size = 'md' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  return (
    <div
      className={clsx('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', sizes[size])}
      style={{ background: color }}
    >
      {initials}
    </div>
  )
}
