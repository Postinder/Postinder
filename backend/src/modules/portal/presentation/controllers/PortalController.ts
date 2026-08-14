import { Request, Response } from 'express'
import { env } from '../../../../config/environment'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'
import { PortalRepository } from '../../infrastructure/repositories/PortalRepository'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { sanitizeForLogging } from '../../../../shared/utils/logSanitizer'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class PortalController {
  constructor(
    private portalRepository = new PortalRepository(),
    private activityRepository = new ActivityRepository(),
    private soundtrackRepository = new SoundtrackRepository(),
    private settingsService = new PlatformSettingsService(),
  ) {}

  private buildPortalUrl(token: string) {
    const baseUrl = env.APP_PUBLIC_URL || 'http://localhost:5173'
    return `${baseUrl.replace(/\/$/, '')}/portal/${token}`
  }

  private serializeActiveLink(result: { record: any; token?: string | null } | null) {
    if (!result) return { hasActiveLink: false }
    return {
      hasActiveLink: true,
      recoverable: Boolean(result.token),
      portalUrl: result.token ? this.buildPortalUrl(result.token) : null,
      expiresAt: result.record.expires_at,
      createdAt: result.record.created_at,
    }
  }

  private async getSession(req: Request, res: Response) {
    const session = await this.portalRepository.validateToken(req.params.token)
    if (!session) {
      res.status(401).json({ error: 'Portal link expired or invalid' })
      return null
    }
    return session
  }

  private sanitizeActivityValue(req: Request, value: unknown) {
    return sanitizeForLogging(value, { secrets: [req.params.token] })
  }

  private respondToReviewResult(result: any, res: Response) {
    if (result?.kind === 'completed' || result?.kind === 'saved' || result?.kind === 'reopened') return false
    if (result?.kind === 'revision_conflict') {
      res.status(409).json({
        error: 'Esta postagem foi atualizada. Recarregue a pagina antes de continuar.',
        code: 'REVISION_CONFLICT',
        currentRevision: result.currentRevision,
      })
      return true
    }
    if (result?.kind === 'already_completed') {
      res.json({ success: true, idempotent: true, status: result.status })
      return true
    }
    if (result?.kind === 'decision_conflict') {
      res.status(409).json({
        error: 'Esta revisao ja recebeu uma decisao diferente.',
        code: 'DECISION_CONFLICT',
        status: result.status,
      })
      return true
    }
    if (result?.kind === 'wrong_mode') {
      res.status(409).json({ error: 'A ação não corresponde à forma de aprovação configurada.' })
      return true
    }
    if (result?.kind === 'incomplete') {
      res.status(409).json({ error: 'Todos os itens precisam de uma decisão antes da conclusão.' })
      return true
    }
    if (result?.kind === 'soundtrack_incomplete') {
      res.status(409).json({ error: 'Conclua também a análise do fundo sonoro.' })
      return true
    }
    if (result?.kind === 'comment_required') {
      res.status(400).json({ error: 'comment is required' })
      return true
    }
    res.status(404).json({ error: 'Post or item not found' })
    return true
  }

  private expectedRevision(req: Request) {
    return Number(req.body?.expectedRevision)
  }

  async createClientLink(req: AuthRequest, res: Response) {
    const days = Number(req.body?.days) || 15
    const result = await this.portalRepository.createToken({
      clientId: req.params.id,
      companyId: req.tenantId,
      createdBy: req.user?.userId,
      days,
    })

    if (!result) return res.status(404).json({ error: 'Client not found' })
    if (result.existing) {
      return res.status(409).json({
        error: 'An active portal link already exists. Use the replace action explicitly.',
        ...this.serializeActiveLink({ record: result.record, token: null }),
      })
    }

    res.status(201).json({
      hasActiveLink: true,
      recoverable: true,
      portalUrl: this.buildPortalUrl(result.token),
      expiresAt: result.record.expires_at,
      createdAt: result.record.created_at,
    })
  }

  async getClientLink(req: AuthRequest, res: Response) {
    const result = await this.portalRepository.getActiveToken({
      clientId: req.params.id,
      companyId: req.tenantId,
    })
    res.json(this.serializeActiveLink(result))
  }

  async replaceClientLink(req: AuthRequest, res: Response) {
    const days = Number(req.body?.days) || 15
    const result = await this.portalRepository.replaceToken({
      clientId: req.params.id,
      companyId: req.tenantId,
      createdBy: req.user?.userId,
      days,
    })
    if (!result || result.existing) return res.status(404).json({ error: 'Client not found' })
    res.status(201).json({
      hasActiveLink: true,
      recoverable: true,
      portalUrl: this.buildPortalUrl(result.token),
      expiresAt: result.record.expires_at,
      createdAt: result.record.created_at,
    })
  }

  async getPortal(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const [posts, feedbacks] = await Promise.all([
      this.portalRepository.listPosts(session.clientId, session.companyId),
      this.portalRepository.listFeedbacks(session.clientId, session.companyId),
    ])

    res.json({
      client: session.client,
      portalSettings: session.client.portalSettings,
      features: (await this.settingsService.get()).features,
      expiresAt: session.expiresAt,
      posts,
      feedbacks,
    })
  }

  private getAuthenticatedClient(req: AuthRequest, res: Response) {
    if (!req.user?.clientId) {
      res.status(403).json({ error: 'Only clients can access this portal' })
      return null
    }

    return {
      clientId: req.user.clientId,
      companyId: req.tenantId,
      client: {
        id: req.user.clientId,
        name: req.user.name,
        email: req.user.email,
      },
    }
  }

  async getAuthenticatedPortal(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    await this.portalRepository.markClientAccess(session.clientId, session.companyId).catch(() => {})

    const [client, posts, feedbacks] = await Promise.all([
      this.portalRepository.getClient(session.clientId, session.companyId),
      this.portalRepository.listPosts(session.clientId, session.companyId),
      this.portalRepository.listFeedbacks(session.clientId, session.companyId),
    ])

    if (!client) return res.status(404).json({ error: 'Client not found' })

    res.json({
      client,
      portalSettings: client.portalSettings,
      features: (await this.settingsService.get()).features,
      expiresAt: null,
      posts,
      feedbacks,
    })
  }

  async listPosts(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const posts = await this.portalRepository.listPosts(session.clientId, session.companyId)
    res.json({ data: posts })
  }

  async approvePost(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const approved = await this.portalRepository.approvePost(req.params.postId, {
      clientId: session.clientId,
      companyId: session.companyId,
    }, this.expectedRevision(req), 'client_portal')
    if (this.respondToReviewResult(approved, res)) return

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'post_approved',
      title: 'Post aprovado pelo portal',
    }).catch(() => {})

    res.json({ success: true, status: approved.status })
  }

  async approveFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    res.status(409).json({ error: 'Use a revisão provisória e conclua a análise da postagem.' })
  }

  async approveAuthenticatedPost(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const approved = await this.portalRepository.approvePost(req.params.postId, {
      clientId: session.clientId,
      companyId: session.companyId,
    }, this.expectedRevision(req), 'client')
    if (this.respondToReviewResult(approved, res)) return

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'post_approved',
      title: 'Post aprovado pelo cliente',
    }).catch(() => {})

    res.json({ success: true, status: approved.status })
  }

  async approveAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    res.status(409).json({ error: 'Use a revisão provisória e conclua a análise da postagem.' })
  }

  async rejectPost(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })

    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []
    const rejected = await this.portalRepository.rejectPost(req.params.postId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    }, this.expectedRevision(req), 'client_portal')
    if (this.respondToReviewResult(rejected, res)) return

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'post_rejected',
      title: 'Ajustes solicitados pelo portal',
      metadata: this.sanitizeActivityValue(req, { comment, tags }) as Record<string, unknown>,
    }).catch(() => {})

    res.json({ success: true, status: rejected.status })
  }

  async rejectFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    res.status(409).json({ error: 'Use a revisão provisória e conclua a análise da postagem.' })
  }

  async updateRejectedFileFeedback(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    res.status(409).json({ error: 'Reabra o conteúdo antes de alterar uma decisão concluída.' })
  }

  async rejectAuthenticatedPost(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })

    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []
    const rejected = await this.portalRepository.rejectPost(req.params.postId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    }, this.expectedRevision(req), 'client')
    if (this.respondToReviewResult(rejected, res)) return

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'post_rejected',
      title: 'Ajustes solicitados pelo cliente',
      metadata: { comment, tags },
    }).catch(() => {})

    res.json({ success: true, status: rejected.status })
  }

  async rejectAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    res.status(409).json({ error: 'Use a revisão provisória e conclua a análise da postagem.' })
  }

  async updateAuthenticatedRejectedFileFeedback(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    res.status(409).json({ error: 'Reabra o conteúdo antes de alterar uma decisão concluída.' })
  }

  private async saveItemReviewDecision(
    req: Request,
    res: Response,
    session: { clientId: string; companyId?: string },
  ) {
    const decision = String(req.body?.decision || '').toLowerCase()
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision must be approved or rejected' })
    }
    const result = await this.portalRepository.saveItemDecision(
      req.params.postId,
      req.params.fileId,
      {
        decision,
        comment: String(req.body?.comment || '').trim(),
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : [],
      },
      session,
      this.expectedRevision(req),
    )
    if (this.respondToReviewResult(result, res)) return
    res.json({ success: true, draft: result.draft })
  }

  async saveItemDecision(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    return this.saveItemReviewDecision(req, res, session)
  }

  async saveAuthenticatedItemDecision(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    return this.saveItemReviewDecision(req, res, session)
  }

  private async finishItemReview(
    req: Request,
    res: Response,
    session: { clientId: string; companyId?: string },
    actorRole: string,
  ) {
    const result = await this.portalRepository.completeItemReview(
      req.params.postId,
      session,
      this.expectedRevision(req),
      actorRole,
    )
    if (this.respondToReviewResult(result, res)) return
    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole,
      type: result.status === 'approved' ? 'post_approved' : 'post_rejected',
      title: 'Cliente concluiu a análise do conteúdo',
      metadata: this.sanitizeActivityValue(req, {
        approvalMode: 'item',
        result: result.status,
        items: result.snapshot,
      }) as Record<string, unknown>,
    }).catch(() => {})
    res.json({ success: true, status: result.status, snapshot: result.snapshot })
  }

  async completeItemReview(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    return this.finishItemReview(req, res, session, 'client_portal')
  }

  async completeAuthenticatedItemReview(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    return this.finishItemReview(req, res, session, 'client')
  }

  private async reopenReview(
    req: Request,
    res: Response,
    session: { clientId: string; companyId?: string },
    actorRole: string,
  ) {
    const reopened = await this.portalRepository.reopenPost(
      req.params.postId,
      session,
      this.expectedRevision(req),
      actorRole,
    )
    if (!reopened) return res.status(409).json({ error: 'Este conteúdo não pode mais ser reaberto.' })
    if (this.respondToReviewResult(reopened, res)) return
    res.json({ success: true })
  }

  async reopenPost(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    return this.reopenReview(req, res, session, 'client_portal')
  }

  async reopenAuthenticatedPost(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    return this.reopenReview(req, res, session, 'client')
  }

  async resetFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    res.status(409).json({ error: 'O retorno é feito entre conteúdos concluídos, não entre arquivos.' })
  }

  async resetAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    res.status(409).json({ error: 'O retorno é feito entre conteúdos concluídos, não entre arquivos.' })
  }

  private async decideSoundtrack(
    req: Request,
    res: Response,
    session: { clientId: string; companyId?: string },
    decision: 'approved' | 'adjustment_requested',
    actorRole: string,
  ) {
    const settings = await this.settingsService.get()
    if (!settings.features.soundtrack) {
      return res.status(404).json({ error: 'Fundo sonoro indisponivel' })
    }
    const comment = decision === 'adjustment_requested' ? String(req.body?.comment || '').trim() : null
    if (decision === 'adjustment_requested' && !comment) {
      return res.status(400).json({ error: 'comment is required' })
    }
    const soundtrack: any = await this.soundtrackRepository.decide(
      req.params.postId,
      decision,
      comment,
      { clientId: session.clientId, companyId: session.companyId },
      actorRole,
      this.expectedRevision(req),
      { recalculatePostStatus: false },
    )
    if (soundtrack?.kind === 'revision_conflict') {
      this.respondToReviewResult(soundtrack, res)
      return
    }
    if (!soundtrack) return res.status(404).json({ error: 'Fundo sonoro nao encontrado ou indisponivel para decisao' })

    if (!soundtrack.idempotent) {
      await this.activityRepository.createForPost(req.params.postId, {
        companyId: session.companyId,
        actorId: session.clientId,
        actorRole,
        type: decision === 'approved' ? 'soundtrack_approved' : 'soundtrack_adjustment_requested',
        title: decision === 'approved' ? 'Fundo sonoro aprovado' : 'Ajuste solicitado no fundo sonoro',
        metadata: this.sanitizeActivityValue(req, {
          soundtrackId: soundtrack.id,
          mode: soundtrack.mode,
          revisionNumber: soundtrack.revisionNumber,
          comment,
        }) as Record<string, unknown>,
      }).catch(() => {})
    }
    res.json({ success: true, idempotent: Boolean(soundtrack.idempotent), data: soundtrack })
  }

  async approveSoundtrack(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    return this.decideSoundtrack(req, res, session, 'approved', 'client_portal')
  }

  async rejectSoundtrack(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    return this.decideSoundtrack(req, res, session, 'adjustment_requested', 'client_portal')
  }

  async resetSoundtrack(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return
    const reset = await this.soundtrackRepository.resetDecision(
      req.params.postId, session, this.expectedRevision(req), 'client_portal',
    )
    if (typeof reset === 'object' && this.respondToReviewResult(reset, res)) return
    if (!reset) return res.status(404).json({ error: 'Fundo sonoro nao encontrado' })
    res.json({ success: true })
  }

  async approveAuthenticatedSoundtrack(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    return this.decideSoundtrack(req, res, session, 'approved', 'client')
  }

  async rejectAuthenticatedSoundtrack(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    return this.decideSoundtrack(req, res, session, 'adjustment_requested', 'client')
  }

  async resetAuthenticatedSoundtrack(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return
    const reset = await this.soundtrackRepository.resetDecision(
      req.params.postId, session, this.expectedRevision(req), 'client',
    )
    if (typeof reset === 'object' && this.respondToReviewResult(reset, res)) return
    if (!reset) return res.status(404).json({ error: 'Fundo sonoro nao encontrado' })
    res.json({ success: true })
  }

  async createFeedback(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const text = String(req.body?.text || '').trim()
    const rating = req.body?.rating ? Number(req.body.rating) : undefined
    const postId = req.body?.postId ? String(req.body.postId) : undefined
    if (!text) return res.status(400).json({ error: 'text is required' })
    if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'rating must be between 1 and 5' })

    const saved = await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId,
      rating,
      text,
      month: req.body?.month || new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    })
    if (!saved) return res.status(404).json({ error: 'Post not found' })

    await this.activityRepository.create({
      companyId: session.companyId,
      clientId: session.clientId,
      postId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'feedback_sent',
      title: 'Feedback enviado pelo portal',
      description: this.sanitizeActivityValue(req, text) as string,
      metadata: { rating },
    }).catch(() => {})

    res.status(201).json({ success: true })
  }

  async createAuthenticatedFeedback(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const text = String(req.body?.text || '').trim()
    const rating = req.body?.rating ? Number(req.body.rating) : undefined
    const postId = req.body?.postId ? String(req.body.postId) : undefined
    if (!text) return res.status(400).json({ error: 'text is required' })
    if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'rating must be between 1 and 5' })

    const saved = await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId,
      rating,
      text,
      month: req.body?.month || new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    })
    if (!saved) return res.status(404).json({ error: 'Post not found' })

    await this.activityRepository.create({
      companyId: session.companyId,
      clientId: session.clientId,
      postId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'feedback_sent',
      title: 'Feedback enviado pelo cliente',
      description: text,
      metadata: { rating },
    }).catch(() => {})

    res.status(201).json({ success: true })
  }
}
