import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Outlet } from 'react-router-dom'
import App from './App'
import { useAuthStore } from './store/authStore'
import { fetchBranding } from './services/branding.service'

vi.mock('./services/branding.service', () => ({
  fetchBranding: vi.fn(),
  uploadBrandingLogo: vi.fn(),
  removeBrandingLogo: vi.fn(),
}))

vi.mock('./store/themeStore', () => ({
  useThemeStore: () => ({ isDark: false, toggle: vi.fn(), setDark: vi.fn(), setLight: vi.fn() }),
}))

vi.mock('./components/layout/AdminLayout', () => ({
  default: () => <div data-testid="admin-layout"><Link to="/admin/clients">Ir para clientes</Link><Outlet /></div>,
}))
vi.mock('./features/dashboard/DashboardPage', () => ({
  default: () => <div>Dashboard interno</div>,
}))
vi.mock('./features/clients/ClientsPage', () => ({
  default: () => <div>Clientes internos</div>,
}))
vi.mock('./features/portal/ClientPortalPage', () => ({
  default: ({ mode }) => <div>{mode === 'auth' ? 'Área autenticada do cliente' : 'Portal por token'}</div>,
}))

const publicBranding = {
  institutional_name: 'Postinder',
  logo_url: '/uploads/branding/logo/company.png',
  logo_configured: true,
  logo_version: 3,
  updated_at: null,
}

function renderRoute(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application branding route boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ user: null })
    fetchBranding.mockReset()
    fetchBranding.mockResolvedValue(publicBranding)
  })

  afterEach(() => cleanup())

  it('renders the Postinder login without mounting or calling configurable branding', async () => {
    fetchBranding.mockRejectedValue(new Error('branding unavailable'))
    renderRoute('/login')

    expect(screen.getByRole('heading', { name: /Post\s*inder/ })).toBeTruthy()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it('keeps password recovery under Postinder without calling configurable branding', () => {
    renderRoute('/recover')

    expect(screen.getByLabelText('Postinder')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Recuperar Senha' })).toBeTruthy()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it('redirects an unauthenticated administrative entry before mounting branding', async () => {
    renderRoute('/admin/dashboard')

    expect(await screen.findByRole('heading', { name: /Post\s*inder/ })).toBeTruthy()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it('mounts one stable provider for the authenticated administrative tree', async () => {
    useAuthStore.setState({ user: { type: 'admin', role: 'admin', name: 'Admin' } })
    renderRoute('/admin/dashboard')

    expect(await screen.findByText('Dashboard interno')).toBeTruthy()
    await waitFor(() => expect(fetchBranding).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('link', { name: 'Ir para clientes' }))
    expect(await screen.findByText('Clientes internos')).toBeTruthy()
    expect(fetchBranding).toHaveBeenCalledTimes(1)
  })

  it('loads branding for the portal by token', async () => {
    renderRoute('/portal/public-token')

    expect(await screen.findByText('Portal por token')).toBeTruthy()
    await waitFor(() => expect(fetchBranding).toHaveBeenCalledTimes(1))
  })

  it('loads branding for the authenticated client area', async () => {
    useAuthStore.setState({ user: { type: 'client', name: 'Cliente' } })
    renderRoute('/aprovar')

    expect(await screen.findByText('Área autenticada do cliente')).toBeTruthy()
    await waitFor(() => expect(fetchBranding).toHaveBeenCalledTimes(1))
  })
})
