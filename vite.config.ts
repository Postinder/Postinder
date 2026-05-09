// Este arquivo existe para referência.
// O frontend deve ser rodado de: apps/admin/
// Comando: cd apps/admin && npm run dev
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
