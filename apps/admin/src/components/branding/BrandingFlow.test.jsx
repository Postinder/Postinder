import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrandingProvider, useBranding } from './BrandingProvider'
import InstitutionalBrand from './InstitutionalBrand'
import BrandingPage from '../../features/settings/BrandingPage'
import { fetchBranding, removeBrandingLogo, uploadBrandingLogo } from '../../services/branding.service'

vi.mock('../../services/branding.service', () => ({
  fetchBranding: vi.fn(),
  uploadBrandingLogo: vi.fn(),
  removeBrandingLogo: vi.fn(),
}))

const fallback = {
  institutional_name: 'Postinder',
  logo_url: null,
  logo_configured: false,
  logo_version: 0,
  updated_at: null,
}

function renderWithBranding(ui) {
  return render(<BrandingProvider>{ui}</BrandingProvider>)
}

function BrandingStateProbe() {
  const { branding } = useBranding()
  return <output data-testid="branding-state">{JSON.stringify(branding)}</output>
}

describe('real branding component behavior', () => {
  beforeEach(() => {
    fetchBranding.mockReset()
    uploadBrandingLogo.mockReset()
    removeBrandingLogo.mockReset()
    fetchBranding.mockResolvedValue(fallback)
    URL.createObjectURL = vi.fn(() => 'blob:branding-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => cleanup())

  it('distinguishes the company image from the Postinder fallback after an image error', async () => {
    fetchBranding.mockResolvedValue({
      ...fallback,
      logo_url: '/uploads/branding/logo/company.png',
      logo_configured: true,
      logo_version: 4,
    })
    renderWithBranding(<InstitutionalBrand />)

    const image = await screen.findByRole('img', { name: 'Logo da empresa' })
    expect(image.getAttribute('src')).toContain('company.png?v=4')
    fireEvent.error(image)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByLabelText('Postinder')).toBeTruthy()
  })

  it('falls back safely when the branding API fails', async () => {
    fetchBranding.mockRejectedValue(new Error('temporary failure'))
    renderWithBranding(<InstitutionalBrand />)

    expect(await screen.findByLabelText('Postinder')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('uploads only after confirmation and applies the response to the provider', async () => {
    let finishUpload
    uploadBrandingLogo.mockReturnValue(new Promise(resolve => { finishUpload = resolve }))
    renderWithBranding(<BrandingPage />)

    const input = await screen.findByLabelText('Selecionar novo logo')
    const selected = new File(['valid-client-preview'], 'logo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [selected] } })
    expect(screen.getByRole('img', { name: 'Previa do novo logo institucional' })).toBeTruthy()
    expect(uploadBrandingLogo).not.toHaveBeenCalled()

    const saveButton = screen.getByRole('button', { name: /Salvar novo logo/ })
    fireEvent.click(saveButton)
    expect(uploadBrandingLogo).toHaveBeenCalledWith(selected)
    expect(saveButton.disabled).toBe(true)

    await act(async () => {
      finishUpload({
        ...fallback,
        logo_url: '/uploads/branding/logo/new.png',
        logo_configured: true,
        logo_version: 2,
      })
    })
    expect(await screen.findByRole('img', { name: 'Logo da empresa' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Previa do novo logo institucional' })).toBeNull()
  })

  it('allows removal when a logo is configured even if its public URL is unavailable', async () => {
    fetchBranding.mockResolvedValue({ ...fallback, logo_configured: true, logo_version: 7 })
    removeBrandingLogo.mockResolvedValue({ ...fallback, logo_version: 8 })
    renderWithBranding(<BrandingPage />)

    const removeButton = await screen.findByRole('button', { name: /Remover logo/ })
    await waitFor(() => expect(removeButton.disabled).toBe(false))
    fireEvent.click(removeButton)
    await waitFor(() => expect(removeBrandingLogo).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(removeButton.disabled).toBe(true))
    expect(screen.getByLabelText('Postinder')).toBeTruthy()
  })

  it.each([
    ['new backend with configured URL', { ...fallback, logo_url: '/logo.png', logo_configured: true }, true],
    ['new backend with unavailable URL', { ...fallback, logo_url: null, logo_configured: true }, true],
    ['new backend without configured logo', { ...fallback, logo_url: '/stale.png', logo_configured: false }, false],
    ['legacy backend with URL', { institutional_name: 'Postinder', logo_url: '/legacy.png', logo_version: 1 }, true],
    ['legacy backend without URL', { institutional_name: 'Postinder', logo_url: null, logo_version: 1 }, false],
    ['unexpected field with URL', { ...fallback, logo_url: '/legacy.png', logo_configured: 'true' }, true],
    ['unexpected field without URL', { ...fallback, logo_url: null, logo_configured: 'true' }, false],
  ])('normalizes logo configuration from %s', async (_name, response, expected) => {
    fetchBranding.mockResolvedValue(response)
    renderWithBranding(<BrandingStateProbe />)

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('branding-state').textContent)
      expect(state.logoConfigured).toBe(expected)
    })
  })

  it('enables legacy logo removal when the backend has no logo_configured field', async () => {
    fetchBranding.mockResolvedValue({ institutional_name: 'Postinder', logo_url: '/legacy.png', logo_version: 1 })
    renderWithBranding(<BrandingPage />)

    const removeButton = await screen.findByRole('button', { name: /Remover logo/ })
    await waitFor(() => expect(removeButton.disabled).toBe(false))
  })

  it('clears an invalid file input for reselection without discarding a valid preview', async () => {
    renderWithBranding(<BrandingPage />)
    const input = await screen.findByLabelText('Selecionar novo logo')
    const valid = new File(['preview'], 'logo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [valid] } })
    const preview = screen.getByRole('img', { name: 'Previa do novo logo institucional' })

    let assignedValue = 'C:\\fakepath\\logo.svg'
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => assignedValue,
      set: value => { assignedValue = value },
    })
    const invalid = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    fireEvent.change(input, { target: { files: [invalid] } })

    expect(assignedValue).toBe('')
    expect(screen.getByRole('alert').textContent).toContain('PNG, JPEG ou WebP')
    expect(screen.getByRole('img', { name: 'Previa do novo logo institucional' })).toBe(preview)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    assignedValue = 'C:\\fakepath\\logo.svg'
    fireEvent.change(input, { target: { files: [invalid] } })
    expect(assignedValue).toBe('')
    expect(screen.getByRole('img', { name: 'Previa do novo logo institucional' })).toBe(preview)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes only the previous preview when switching between valid files', async () => {
    URL.createObjectURL
      .mockReturnValueOnce('blob:first-preview')
      .mockReturnValueOnce('blob:second-preview')
    renderWithBranding(<BrandingPage />)
    const input = await screen.findByLabelText('Selecionar novo logo')

    fireEvent.change(input, { target: { files: [new File(['one'], 'one.png', { type: 'image/png' })] } })
    expect(screen.getByRole('img', { name: 'Previa do novo logo institucional' }).getAttribute('src')).toBe('blob:first-preview')
    fireEvent.change(input, { target: { files: [new File(['two'], 'two.png', { type: 'image/png' })] } })

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-preview')
    expect(screen.getByRole('img', { name: 'Previa do novo logo institucional' }).getAttribute('src')).toBe('blob:second-preview')
  })

  it('revokes a pending preview on unmount', async () => {
    URL.createObjectURL.mockReturnValueOnce('blob:pending-preview')
    const view = renderWithBranding(<BrandingPage />)
    const input = await screen.findByLabelText('Selecionar novo logo')
    fireEvent.change(input, { target: { files: [new File(['pending'], 'pending.png', { type: 'image/png' })] } })

    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pending-preview')
  })

  it('tolerates revoking the same object URL for distinct preview lifecycles', async () => {
    URL.createObjectURL.mockReturnValue('blob:reused-by-environment')
    uploadBrandingLogo.mockResolvedValue({ ...fallback, logo_url: '/saved.png', logo_configured: true, logo_version: 1 })
    const view = renderWithBranding(<BrandingPage />)
    const input = await screen.findByLabelText('Selecionar novo logo')
    fireEvent.change(input, { target: { files: [new File(['one'], 'one.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar novo logo/ }))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { files: [new File(['two'], 'two.png', { type: 'image/png' })] } })

    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:reused-by-environment')
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:reused-by-environment')
  })
})
