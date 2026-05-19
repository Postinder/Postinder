import { Children, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

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
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const options = Children.toArray(children)
    .filter(child => child?.type === 'option')
    .map(child => ({
      value: child.props.value ?? '',
      label: child.props.children,
      disabled: child.props.disabled,
    }))
  const selected = options.find(option => String(option.value) === String(props.value)) || options[0]

  useEffect(() => {
    function handleClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function choose(option) {
    if (option.disabled) return
    props.onChange?.({ target: { value: option.value, name: props.name } })
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </label>
      )}
      <div ref={rootRef} className={clsx('relative', className)}>
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => setOpen(current => !current)}
          className={clsx(
            'flex w-full items-center justify-between gap-3 rounded-xl border py-2.5 pl-3.5 pr-3 text-left text-sm font-semibold outline-none transition-all',
            'bg-neutral-50/80 dark:bg-neutral-800/80',
            'text-neutral-900 dark:text-neutral-100',
            'border-neutral-200 dark:border-neutral-700',
            'hover:border-neutral-300 dark:hover:border-neutral-600',
            open && 'border-mag-500 bg-white shadow-[0_0_0_3px_rgba(167,1,75,0.12)] dark:bg-neutral-800',
            props.disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <span className="truncate">{selected?.label || 'Selecione'}</span>
          <ChevronDown size={16} className={clsx('shrink-0 text-neutral-400 transition-transform', open && 'rotate-180 text-mag-500')} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-black/10 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-black/40">
            {options.map(option => {
              const active = String(option.value) === String(props.value)
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => choose(option)}
                  className={clsx(
                    'flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-mag-500 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
                    option.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
