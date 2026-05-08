import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useThemeStore()

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
      className={`
        relative w-14 h-7 rounded-full transition-all duration-300 flex items-center
        ${isDark
          ? 'bg-mag-500 justify-end'
          : 'bg-neutral-200 justify-start'
        }
        ${className}
      `}
    >
      <span className={`
        w-6 h-6 rounded-full flex items-center justify-center mx-0.5
        transition-all duration-300 shadow-sm
        ${isDark ? 'bg-white text-mag-600' : 'bg-white text-amber-500'}
      `}>
        {isDark
          ? <Moon size={13} strokeWidth={2.5} />
          : <Sun  size={13} strokeWidth={2.5} />
        }
      </span>
    </button>
  )
}
