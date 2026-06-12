import clsx from 'clsx'

const statusStyles = {
  draft:            'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  ready:            'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  sent:             'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pending:          'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pending_approval: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved:         'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  executed:         'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  rejected:         'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  archived:         'bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500',
  updated:          'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  delivered:        'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  completed:        'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  concluded:        'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  topo:             'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  meio:             'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  fundo:            'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const statusLabels = {
  draft: 'Rascunho', ready: 'Pronto', sent: 'Enviado',
  pending: 'Pendente', pending_approval: 'Aguardando',
  approved: 'Aprovado', executed: 'Executado', rejected: 'Recusado',
  archived: 'Arquivado',
  updated: 'Atualizado', delivered: 'Entregue',
  completed: 'Concluido', concluded: 'Concluido',
  topo: 'Topo', meio: 'Meio', fundo: 'Fundo',
}

const statusDots = {
  draft: 'bg-neutral-300',
  ready: 'bg-blue-500',
  sent: 'bg-amber-400',
  pending: 'bg-amber-400',
  pending_approval: 'bg-amber-400',
  approved: 'bg-green-500',
  executed: 'bg-teal-500',
  rejected: 'bg-red-500',
  archived: 'bg-neutral-400',
  updated: 'bg-blue-500',
  delivered: 'bg-blue-500',
  completed: 'bg-blue-500',
  concluded: 'bg-blue-500',
}

export const STATUS_LEGEND = [
  { status: 'approved', label: statusLabels.approved },
  { status: 'pending_approval', label: statusLabels.pending_approval },
  { status: 'rejected', label: statusLabels.rejected },
  { status: 'completed', label: statusLabels.completed },
]

export function getStatusDotClass(status) {
  return statusDots[status] || 'bg-neutral-400'
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

export function StatusDot({ status, className }) {
  return <span className={clsx('inline-block h-2.5 w-2.5 rounded-full', getStatusDotClass(status), className)} />
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
