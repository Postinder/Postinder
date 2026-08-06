import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { useThemeStore } from './store/themeStore'
import './styles/globals.css'
import { BrandingProvider } from './components/branding/BrandingProvider'

const queryClient = new QueryClient()

document.documentElement.classList.toggle('dark', useThemeStore.getState().isDark)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BrandingProvider>
          <App />
        </BrandingProvider>
        <Toaster position="bottom-right" toastOptions={{ duration: 3500, style: { fontFamily: 'system-ui', fontSize: '14px' } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
