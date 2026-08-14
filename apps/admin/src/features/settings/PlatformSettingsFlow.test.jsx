import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformSettingsPage from './PlatformSettingsPage'
import { usePlatformSettings } from '../../hooks/usePlatformSettings'
import { updatePlatformSettings } from '../../services/platformSettings.service'
import toast from 'react-hot-toast'

vi.mock('../../hooks/usePlatformSettings', () => ({
  PLATFORM_SETTINGS_QUERY_KEY: ['platform-settings'],
  usePlatformSettings: vi.fn(),
}))

vi.mock('../../services/platformSettings.service', () => ({
  updatePlatformSettings: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const settings = {
  retention: { executed_attachment_hours: 24 },
  features: { soundtrack: false },
  client_fields: { whatsapp: 'optional', segment: 'optional', deadline_days: 'optional', document: 'hidden' },
  post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'hidden' },
  post_field_client_visibility: { funnel_tag: false },
  portal: { show_post_list: false, show_supplementary_info: false, sequential_approval: true, approval_mode: 'content' },
  updated_at: null,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><PlatformSettingsPage /></QueryClientProvider>)
}

describe('platform settings real component flow', () => {
  beforeEach(() => {
    usePlatformSettings.mockReset()
    updatePlatformSettings.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
    usePlatformSettings.mockReturnValue({ settings, isLoading: false, isError: false })
  })

  afterEach(() => cleanup())

  it('renders independent loading and load-error states', () => {
    usePlatformSettings.mockReturnValue({ settings, isLoading: true, isError: false })
    const view = renderPage()
    expect(screen.getByText('Carregando configurações...')).toBeTruthy()
    view.unmount()

    usePlatformSettings.mockReturnValue({ settings, isLoading: false, isError: true })
    renderPage()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar')
  })

  it('edits retention, feature, field and portal controls and saves one coherent payload', async () => {
    let finishSave
    updatePlatformSettings.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    renderPage()

    fireEvent.change(screen.getByLabelText('Retenção de arquivos após execução (horas)'), { target: { value: '48' } })
    fireEvent.click(screen.getByLabelText(/Habilitar fundo sonoro/))

    const clientSection = screen.getByRole('heading', { name: 'Cadastro de clientes' }).closest('div.rounded-lg')
    fireEvent.click(within(clientSection).getAllByRole('button', { name: 'Obrigatorio' })[0])
    const postSection = screen.getByRole('heading', { name: 'Criação de postagens' }).closest('div.rounded-lg')
    fireEvent.click(within(postSection).getAllByRole('button', { name: 'Oculto' })[0])
    const funnelVisibility = screen.getByLabelText(/Exibir esta informação ao cliente/)
    expect(funnelVisibility.disabled).toBe(true)
    fireEvent.click(within(postSection).getAllByRole('button', { name: 'Opcional' })[2])
    expect(funnelVisibility.disabled).toBe(false)
    fireEvent.click(funnelVisibility)
    fireEvent.click(screen.getByLabelText(/Mostrar lista de postagens/))
    fireEvent.click(screen.getByRole('button', { name: /Aprovar item por item/ }))

    const save = screen.getByRole('button', { name: 'Salvar configurações' })
    fireEvent.click(save)
    expect(save.disabled).toBe(true)
    expect(updatePlatformSettings).toHaveBeenCalledWith({
      retention: { executed_attachment_hours: 48 },
      features: { soundtrack: true },
      client_fields: { ...settings.client_fields, whatsapp: 'required' },
      post_fields: { ...settings.post_fields, description: 'hidden', funnel_tag: 'optional' },
      post_field_client_visibility: { funnel_tag: true },
      portal: { ...settings.portal, show_post_list: true, approval_mode: 'item' },
    })

    finishSave({ ...settings, retention: { executed_attachment_hours: 48 } })
    await waitFor(() => expect(save.disabled).toBe(false))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('reports save failure and restores submission controls without claiming success', async () => {
    updatePlatformSettings.mockRejectedValue({ response: { data: { error: 'Configuracao invalida' } } })
    renderPage()
    const save = screen.getByRole('button', { name: 'Salvar configurações' })
    fireEvent.click(save)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Configuracao invalida'))
    expect(toast.success).not.toHaveBeenCalled()
    expect(save.disabled).toBe(false)
  })
})
