import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', className }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className={clsx(
        'relative w-full rounded-2xl bg-white dark:bg-neutral-900',
        'border border-neutral-200 dark:border-neutral-800',
        'shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto',
        sizes[size], className
      )}>
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between p-6 pb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{title}</h2>
              {subtitle && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
              <X size={18} />
            </button>
          </div>
        )}
        {/* Body */}
        <div className={title ? 'px-6 pb-6' : 'p-6'}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function BottomSheet({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-3xl p-6 animate-slide-up">
        {title && (
          <div className="mb-4">
            <h3 className="text-lg font-bold">{title}</h3>
            {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
