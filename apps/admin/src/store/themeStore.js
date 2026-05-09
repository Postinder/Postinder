import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set, get) => ({
      // Default: respect OS preference
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      toggle: () => set({ isDark: !get().isDark }),
      setDark:  () => set({ isDark: true }),
      setLight: () => set({ isDark: false }),
    }),
    { name: 'postinder-theme' }
  )
)
