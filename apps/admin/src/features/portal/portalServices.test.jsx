import { describe, expect, it } from 'vitest'
import { createPortalService } from '../../services/portal.service'
import { createClientPortalService } from '../../services/clientPortal.service'

function recordingClient() {
  const calls = []
  const response = { data: { ok: true } }
  return {
    calls,
    client: {
      get: async (path, body) => { calls.push({ method: 'get', path, body }); return response },
      post: async (path, body) => { calls.push({ method: 'post', path, body }); return response },
      put: async (path, body) => { calls.push({ method: 'put', path, body }); return response },
      patch: async (path, body) => { calls.push({ method: 'patch', path, body }); return response },
    },
  }
}

describe('portal services optimistic revision contract', () => {
  it('sends expectedRevision in every token portal review mutation', async () => {
    const { calls, client } = recordingClient()
    const service = createPortalService(client)

    await service.approvePortalPost('token', 'post', 7)
    await service.rejectPortalPost('token', 'post', 'Ajustar', ['Texto'], 7)
    await service.savePortalItemDecision('token', 'post', 'file', 'rejected', 'Trocar', ['Imagem'], 7)
    await service.completePortalItemReview('token', 'post', 7)
    await service.reopenPortalPost('token', 'post', 7)
    await service.approvePortalSoundtrack('token', 'post', 7)
    await service.adjustPortalSoundtrack('token', 'post', 'Diminuir volume', 7)
    await service.resetPortalSoundtrack('token', 'post', 7)

    expect(calls).toEqual([
      { method: 'post', path: '/portal/token/posts/post/approve', body: { expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/reject', body: { comment: 'Ajustar', tags: ['Texto'], expectedRevision: 7 } },
      { method: 'put', path: '/portal/token/posts/post/items/file/decision', body: { decision: 'rejected', comment: 'Trocar', tags: ['Imagem'], expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/complete-review', body: { expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/reopen', body: { expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/soundtrack/approve', body: { expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/soundtrack/adjust', body: { comment: 'Diminuir volume', expectedRevision: 7 } },
      { method: 'post', path: '/portal/token/posts/post/soundtrack/reset', body: { expectedRevision: 7 } },
    ])
  })

  it('mirrors the same bodies in the authenticated client portal', async () => {
    const { calls, client } = recordingClient()
    const service = createClientPortalService(client)

    await service.approveAuthenticatedPortalPost('post', 9)
    await service.rejectAuthenticatedPortalPost('post', 'Ajustar', ['Texto'], 9)
    await service.saveAuthenticatedPortalItemDecision('post', 'file', 'approved', '', [], 9)
    await service.completeAuthenticatedPortalItemReview('post', 9)
    await service.reopenAuthenticatedPortalPost('post', 9)
    await service.approveAuthenticatedPortalSoundtrack('post', 9)
    await service.adjustAuthenticatedPortalSoundtrack('post', 'Trocar faixa', 9)
    await service.resetAuthenticatedPortalSoundtrack('post', 9)

    expect(calls).toEqual([
      { method: 'post', path: '/client-portal/posts/post/approve', body: { expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/reject', body: { comment: 'Ajustar', tags: ['Texto'], expectedRevision: 9 } },
      { method: 'put', path: '/client-portal/posts/post/items/file/decision', body: { decision: 'approved', comment: '', tags: [], expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/complete-review', body: { expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/reopen', body: { expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/soundtrack/approve', body: { expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/soundtrack/adjust', body: { comment: 'Trocar faixa', expectedRevision: 9 } },
      { method: 'post', path: '/client-portal/posts/post/soundtrack/reset', body: { expectedRevision: 9 } },
    ])
  })

  it('refuses a mutation without a valid revision before issuing HTTP', async () => {
    const { calls, client } = recordingClient()
    const tokenService = createPortalService(client)
    const authService = createClientPortalService(client)

    await expect(tokenService.approvePortalPost('token', 'post')).rejects.toThrow(/expectedRevision/)
    await expect(tokenService.approvePortalPost('token', 'post', 0)).rejects.toThrow(/expectedRevision/)
    await expect(authService.adjustAuthenticatedPortalSoundtrack('post', 'Ajustar', -1)).rejects.toThrow(/expectedRevision/)
    expect(calls).toEqual([])
  })
})
