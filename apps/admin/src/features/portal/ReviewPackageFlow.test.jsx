import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClientPortalPage, { ProjectReviewPanel } from './ClientPortalPage'
import AdministrativeReview from '../../components/posts/AdministrativeReview'
import ManagePostsPage from '../posts/ManagePostsPage'
import ApprovalsPage from '../approvals/ApprovalsPage'
import { countLovedInMonth } from './portalMetrics'

const api = vi.hoisted(() => ({ fetch: vi.fn(), reopen: vi.fn(), approve: vi.fn(), prepare: vi.fn(), manual: vi.fn(), history: vi.fn() }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ token: 'private-token' }), useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }))
vi.mock('../../store/authStore', () => ({ useAuthStore: () => ({ user: { name: 'Cliente', role: 'admin' }, logout: vi.fn() }) }))
vi.mock('../../hooks/usePlatformSettings', () => ({ usePlatformSettings: () => ({ settings: { post_fields: { description: 'optional', scheduled_date: 'optional', funnel_tag: 'hidden' }, features: { soundtrack: false }, retention: { executed_attachment_hours: 24 } } }) }))
vi.mock('../../services/clients.service', () => ({ fetchClients: async () => [{ id: 'client', name: 'Cliente' }], notifyClient: vi.fn() }))
vi.mock('../../store/themeStore', () => ({ useThemeStore: () => ({ isDark: false, toggle: vi.fn() }) }))
vi.mock('./PortalHeader', () => ({ default: () => <header>Portal de revisão</header> }))
vi.mock('../../services/portal.service', () => ({
  fetchPortal: api.fetch, reopenPortalPost: api.reopen, approvePortalPost: api.approve,
  rejectPortalPost: vi.fn(), sendPortalFeedback: vi.fn(), approvePortalSoundtrack: vi.fn(), adjustPortalSoundtrack: vi.fn(), savePortalItemDecision: vi.fn(), completePortalItemReview: vi.fn(),
}))
vi.mock('../../services/posts.service', async importOriginal => ({ ...(await importOriginal()),
  fetchPosts: async () => [{ id: 'post', clientId: 'client', title: 'Campanha', status: 'rejected', channels: ['Instagram'], files: [{ id: 'file', file_type: 'IMAGE', url: 'https://example.test/a.png', status: 'rejected' }] }],
  prepareAdminApproval: api.prepare, approvePostAdministratively: api.manual, fetchPostReviewHistory: api.history }))

afterEach(() => cleanup())
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
const project = (extra = {}) => ({ id: 'post', title: 'Campanha', contentRevision: 4, reviewSequence: 2, status: 'sent', channels: ['E-mail Marketing'], emailLink: 'https://example.test/mail', files: [], ...extra })
const props = (p, extra = {}) => ({ projects: [p], selectedProjectId: p.id, pendingItemsCount: 1, approvalMode: 'content', sequentialApproval: true, onSelectProject: vi.fn(), onApprovePost: vi.fn().mockResolvedValue(true), onSaveItemDecision: vi.fn().mockResolvedValue(true), onUndo: vi.fn(), canUndoLastAction: false, ...extra })
const payload = (extra = {}) => ({ client: { id: 'client', name: 'Cliente' }, posts: [project()], features: {}, feedbacks: [], portalSettings: { approval_mode: 'content', sequential_approval: true }, rewind: { available: false }, ...extra })
const target = { available: true, postId: 'post', decisionId: 'decision', contentRevision: 4, reviewSequence: 2 }

describe('positive feedback intention', () => {
  it('opens a blue action, focuses the optional field and cancels without saving', () => {
    const p = props(project()); render(<ProjectReviewPanel {...p} />)
    const trigger = screen.getByRole('button', { name: 'Adorei' }); trigger.focus()
    expect(trigger.className).toContain('blue'); expect(trigger.className).not.toContain('rose')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Que bom que adorou esse conteúdo!')).toBeTruthy()
    const field = screen.getByRole('textbox', { name: 'Feedback positivo (opcional)' })
    expect(document.activeElement).toBe(field); expect(field.hasAttribute('maxlength')).toBe(false)
    fireEvent.change(field, { target: { value: 'Gostei' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(p.onApprovePost).not.toHaveBeenCalled(); expect(p.onSaveItemDecision).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })
  for (const [text, expected] of [['  Bom tema  ', 'Bom tema'], ['   ', null]]) it(`confirms captured revision and round with ${expected || 'empty'} feedback`, async () => {
    const p = props(project()); render(<ProjectReviewPanel {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Adorei' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Adorei' }))
    await waitFor(() => expect(p.onApprovePost).toHaveBeenCalledWith('post', 'loved', expected, 4, 2))
  })
  it('prevents double submission and escape while the request is pending', async () => {
    let resolve; const pending = new Promise(r => { resolve = r })
    const p = props(project(), { onApprovePost: vi.fn(() => pending) }); render(<ProjectReviewPanel {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Adorei' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Adorei' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('textbox').disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(p.onApprovePost).toHaveBeenCalledTimes(1)
    await act(async () => resolve(true))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  for (const [name, value] of [['ASCII', 'x'.repeat(5000)], ['emoji', '😀'.repeat(5000)], ['mixed', 'aé😀'.repeat(1666) + 'ç😀']]) {
    it(`accepts 5000 Unicode code points and limits oversized pasted ${name} input before submission`, async () => {
      const p = props(project()); render(<ProjectReviewPanel {...p} />)
      fireEvent.click(screen.getByRole('button', { name: 'Adorei' }))
      const field = screen.getByRole('textbox')
      fireEvent.change(field, { target: { value } })
      expect(field.value).toBe(value)
      expect(screen.getByText('5000/5.000 caracteres')).toBeTruthy()
      fireEvent.input(field, { target: { value: value + '😀extra pasted text' } })
      expect(field.value).toBe(value)
      expect(Array.from(field.value)).toHaveLength(5000)
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar Adorei' }))
      await waitFor(() => expect(p.onApprovePost).toHaveBeenCalledWith('post', 'loved', value, 4, 2))
    })
  }
  for (const change of [{ contentRevision: 5 }, { reviewSequence: 3 }]) it(`invalidates modal when ${Object.keys(change)[0]} changes`, () => {
    const p = props(project()); const view = render(<ProjectReviewPanel {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Adorei' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Old intention' } })
    view.rerender(<ProjectReviewPanel {...props(project(change), { onApprovePost: p.onApprovePost })} />)
    expect(screen.queryByRole('dialog')).toBeNull(); expect(p.onApprovePost).not.toHaveBeenCalled()
  })
  it('preserves free attachment navigation and binds feedback to the selected item', async () => {
    const files = ['a', 'b'].map(id => ({ id, name: `${id}.png`, file_type: 'IMAGE', url: `https://example.test/${id}.png`, status: 'pending' }))
    const p = props(project({ channels: ['Instagram'], files }), { approvalMode: 'item' })
    render(<ProjectReviewPanel {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /Mídia 2/i }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Adorei' })[0])
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Imagem ótima' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Adorei' }))
    await waitFor(() => expect(p.onSaveItemDecision).toHaveBeenCalledWith('post', 'b', 'approved', '', [], 4, 'loved', 'Imagem ótima', 2))
    expect(p.onApprovePost).not.toHaveBeenCalled()
  })
  it('counts a loved post once despite multiple comments and excludes administrative certification', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    const p = { approvedAt: now, positiveReaction: 'loved', positiveFeedback: 'Ótimo', itemReviewSnapshot: [{ positiveReaction: 'loved', positiveFeedback: 'A' }, { positiveReaction: 'loved', positiveFeedback: 'B' }] }
    expect(countLovedInMonth([p], now)).toBe(1)
    expect(countLovedInMonth([{ ...p, approvalSource: 'admin' }], now)).toBe(0)
  })
})

describe('server-authoritative Voltar', () => {
  it('starts disabled and ignores stored local permissions', async () => {
    localStorage.setItem('portal-last-action:private-token', JSON.stringify(target))
    api.fetch.mockResolvedValue(payload()); render(<ClientPortalPage />)
    expect((await screen.findByRole('button', { name: 'Voltar à última postagem' })).disabled).toBe(true)
  })
  it('reconstructs the last decision after mounting on the finished screen and blocks while busy', async () => {
    api.fetch.mockResolvedValue(payload({ posts: [project({ status: 'approved' })], rewind: target }))
    let resolve; api.reopen.mockImplementation(() => new Promise(r => { resolve = r }))
    const view = render(<ClientPortalPage />)
    const button = await screen.findByRole('button', { name: 'Voltar à última postagem' })
    expect(screen.getByText('Tudo em dia')).toBeTruthy(); expect(button.textContent).toBe('Voltar')
    fireEvent.click(button); expect(button.disabled).toBe(true)
    expect(api.reopen).toHaveBeenCalledWith('private-token', 'post', 4, 2, 'decision')
    api.fetch.mockResolvedValue(payload({ posts: [project()], rewind: { ...target, available: false } }))
    await act(async () => resolve({ success: true }))
    view.unmount(); render(<ClientPortalPage />)
    expect((await screen.findByRole('button', { name: 'Voltar à última postagem' })).disabled).toBe(true)
  })
  it('reloads a two-tab conflict and removes stale rewind authorization', async () => {
    api.fetch.mockResolvedValueOnce(payload({ posts: [project({ status: 'approved' })], rewind: target }))
      .mockResolvedValue(payload({ posts: [project()], rewind: { ...target, available: false } }))
    api.reopen.mockRejectedValue({ response: { status: 409, data: { code: 'REVIEW_CONFLICT' } } })
    render(<ClientPortalPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar à última postagem' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Voltar à última postagem' }).disabled).toBe(true))
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })
  it('refreshes authority when returning to the tab', async () => {
    api.fetch.mockResolvedValueOnce(payload()).mockResolvedValue(payload({ rewind: target }))
    render(<ClientPortalPage />)
    await screen.findByRole('button', { name: 'Voltar à última postagem' })
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Voltar à última postagem' }).disabled).toBe(false))
  })
})

describe('administrative approval interface', () => {
  const post = { id: 'post', status: 'rejected', title: 'Campanha' }
  const prepared = { expectedRevision: 3, expectedFingerprint: 'a'.repeat(64), title: 'Campanha' }
  it('mounts the shared action on the management card and keeps its attachment editor functional', async () => {
    render(<ManagePostsPage />)
    expect(await screen.findByRole('button', { name: 'Aprovar manualmente' })).toBeTruthy()
    fireEvent.click(screen.getByTitle('Editar'))
    expect(await screen.findByText('Previa rapida')).toBeTruthy()
  })
  it('mounts the same action in the approvals queue', async () => {
    render(<ApprovalsPage />)
    expect(await screen.findByRole('button', { name: 'Aprovar manualmente' })).toBeTruthy()
  })
  async function open() {
    api.prepare.mockResolvedValue(prepared)
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar manualmente' }))
    return screen.findByRole('textbox', { name: 'Justificativa — obrigatória' })
  }
  it('shows manual approval only for an admin and a rejected post', () => {
    const view = render(<AdministrativeReview post={post} role="manager" />)
    expect(screen.queryByRole('button', { name: 'Aprovar manualmente' })).toBeNull()
    view.rerender(<AdministrativeReview post={post} role="admin" />)
    expect(screen.getByRole('button', { name: 'Aprovar manualmente' })).toBeTruthy()
    view.rerender(<AdministrativeReview post={{ ...post, status: 'approved', approvalSource: 'admin' }} role="admin" />)
    expect(screen.queryByRole('button', { name: 'Aprovar manualmente' })).toBeNull()
    expect(screen.getByText('Aprovado manualmente pela equipe')).toBeTruthy()
  })
  it('requires a reason and cancels without mutation', async () => {
    render(<AdministrativeReview post={post} role="admin" />)
    const input = await open(); expect(document.activeElement).toBe(input)
    expect(screen.getByRole('button', { name: 'Confirmar aprovação manual' }).disabled).toBe(true)
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Confirmar aprovação manual' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(api.manual).not.toHaveBeenCalled()
  })
  it('disables admin confirmation and cancellation during a double click', async () => {
    let resolve; api.manual.mockImplementation(() => new Promise(r => { resolve = r }))
    render(<AdministrativeReview post={post} role="admin" />)
    fireEvent.change(await open(), { target: { value: 'Corrigido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação manual' }))
    const sending = screen.getByRole('button', { name: 'Aprovando…' })
    fireEvent.click(sending)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(sending.disabled).toBe(true); expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(api.manual).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ success: true }))
  })
  it('retains the same key and payload on timeout retry and prevents a double click', async () => {
    const changed = vi.fn(); render(<AdministrativeReview post={post} role="admin" onChanged={changed} />)
    fireEvent.change(await open(), { target: { value: '  Corrigido  ' } })
    api.manual.mockRejectedValueOnce(new Error('Timeout')).mockResolvedValue({ success: true })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação manual' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar aprovação manual' }).disabled).toBe(false))
    expect(screen.getByRole('textbox').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação manual' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.manual.mock.calls[0]).toEqual(api.manual.mock.calls[1])
    expect(api.manual.mock.calls[0][1]).toMatchObject({ expectedRevision: prepared.expectedRevision, expectedFingerprint: prepared.expectedFingerprint, justification: 'Corrigido' })
    expect(api.manual.mock.calls[0][1].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/)
    expect(changed).toHaveBeenCalledTimes(1)
  })
  it('closes stale admin confirmation and refreshes on a material conflict', async () => {
    const changed = vi.fn(); api.manual.mockRejectedValue({ response: { status: 409, data: { error: 'O conteúdo mudou' } } })
    render(<AdministrativeReview post={post} role="admin" onChanged={changed} />)
    fireEvent.change(await open(), { target: { value: 'Corrigido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação manual' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(changed).toHaveBeenCalledTimes(1)
  })
  it('displays the original rejection and the responsible admin, reason and new revision', async () => {
    api.history.mockResolvedValue({ decisions: [{ id: 'd', decision: 'rejected', content_revision: 3, decided_at: '2026-10-04' }],
      actions: [{ id: 'a', action: 'admin_approved', content_revision: 4, decision_id: 'd', actor_name: 'Responsável', created_at: '2026-10-04', justification: 'Correção verificada' }], feedbacks: [] })
    render(<AdministrativeReview post={post} role="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Histórico de decisões' }))
    await screen.findByRole('dialog')
    expect(screen.getByText('Cliente solicitou ajuste — revisão 3')).toBeTruthy()
    expect(screen.getByText('Aprovado manualmente pela equipe — revisão 4')).toBeTruthy()
    expect(screen.getByText(/Responsável/)).toBeTruthy(); expect(screen.getByText('Correção verificada')).toBeTruthy()
  })
})
