import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import InsightsPage from './InsightsPage'

const api = vi.hoisted(() => ({ posts: vi.fn(), feedbacks: vi.fn() }))
vi.mock('../../services/posts.service', async importOriginal => ({ ...(await importOriginal()), fetchPosts: api.posts }))
vi.mock('../../services/insights.service', () => ({ fetchMonthlyFeedbacks: api.feedbacks }))
vi.mock('../../services/clients.service', () => ({ fetchClients: async () => [{ id: 'client', name: 'Cliente' }] }))
vi.mock('../../services/activities.service', () => ({ createActivity: vi.fn().mockResolvedValue({}) }))
vi.mock('../../components/ai/AIInsightsPanel', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

it('preserves the four-file historical dashboard and CSV after administrative certification', async () => {
  const date = new Date().toISOString()
  const approved = { id: 'a', clientId: 'client', title: 'A', status: 'approved', approvalSource: 'client', createdAt: date,
    files: [{ id: 'a1', status: 'approved' }, { id: 'a2', status: 'approved' }] }
  const rejected = { id: 'b', clientId: 'client', title: 'B', status: 'rejected', createdAt: date,
    files: [{ id: 'b1', status: 'rejected', rejection_reason: 'Corrigir' }, { id: 'b2', status: 'rejected', rejection_reason: 'Corrigir' }] }
  api.posts.mockResolvedValue([approved, rejected])
  api.feedbacks.mockResolvedValue([{ id: 'feedback', post_id: 'b', client_id: 'client', text: 'Corrigir' }])
  const value = label => within(screen.getByText(label).parentElement).getByText(/^(4|25%|75%)$/).textContent
  let view = render(<InsightsPage />)
  await waitFor(() => expect(value('Arquivos analisados')).toBe('4'))
  expect(value('Aprovacao inicial por item')).toBe('25%')
  expect(value('Recusa inicial por item')).toBe('75%')
  view.unmount()
  api.posts.mockResolvedValue([approved, { ...rejected, status: 'approved', approvalSource: 'admin',
    files: rejected.files.map(file => ({ ...file, status: 'approved' })) }])
  view = render(<InsightsPage />)
  await waitFor(() => expect(value('Arquivos analisados')).toBe('4'))
  expect(value('Aprovacao inicial por item')).toBe('25%')
  expect(value('Recusa inicial por item')).toBe('75%')
  let exported
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL(blob) { exported = blob; return 'blob:metrics' }
    static revokeObjectURL() {}
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
  const csv = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(exported)
  })
  expect(csv).toContain('"Arquivos analisados";"4"')
  expect(csv).toContain('"Taxa de aprovacao inicial por item";"25%"')
  expect(csv).toContain('"Taxa de recusa inicial por item";"75%"')
})
