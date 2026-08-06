import { Request, Response } from 'express'
import { env } from '../../../../config/environment'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'
import { PortalRepository } from '../../infrastructure/repositories/PortalRepository'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { sanitizeForLogging } from '../../../../shared/utils/logSanitizer'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class PortalController {
  constructor(
    private portalRepository = new PortalRepository(),
    private activityRepository = new ActivityRepository(),
    private soundtrackRepository = new SoundtrackRepository(),
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
    })
    if (!approved) return res.status(404).json({ error: 'Post not found' })

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'post_approved',
      title: 'Post aprovado pelo portal',
    }).catch(() => {})

    res.json({ success: true })
  }

  async approveFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const approved = await this.portalRepository.approveFile(req.params.fileId, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!approved) return res.status(404).json({ error: 'File not found' })

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'file_approved',
      title: 'Item aprovado pelo portal',
    }).catch(() => {})

    res.json({ success: true })
  }

  async approveAuthenticatedPost(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const approved = await this.portalRepository.approvePost(req.params.postId, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!approved) return res.status(404).json({ error: 'Post not found' })

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'post_approved',
      title: 'Post aprovado pelo cliente',
    }).catch(() => {})

    res.json({ success: true })
  }

  async approveAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const approved = await this.portalRepository.approveFile(req.params.fileId, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!approved) return res.status(404).json({ error: 'File not found' })

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'file_approved',
      title: 'Item aprovado pelo cliente',
    }).catch(() => {})

    res.json({ success: true })
  }

  async rejectPost(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })

    const rejected = await this.portalRepository.rejectPost(req.params.postId, comment, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!rejected) return res.status(404).json({ error: 'Post not found' })

    await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId: req.params.postId,
      text: comment,
      month: new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    }).catch(() => {})

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'post_rejected',
      title: 'Ajustes solicitados pelo portal',
      metadata: this.sanitizeActivityValue(req, { comment }) as Record<string, unknown>,
    }).catch(() => {})

    res.json({ success: true })
  }

  async rejectFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []

    const rejected = await this.portalRepository.rejectFile(req.params.fileId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!rejected) return res.status(404).json({ error: 'File not found' })

    await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId: rejected.postId,
      text: comment,
      month: new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    }).catch(() => {})

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'feedback_sent',
      title: 'Ajuste solicitado pelo portal',
      metadata: this.sanitizeActivityValue(req, { comment, tags }) as Record<string, unknown>,
    }).catch(() => {})

    res.json({ success: true })
  }

  async updateRejectedFileFeedback(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []

    const updated = await this.portalRepository.updateRejectedFileFeedback(req.params.fileId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!updated) return res.status(404).json({ error: 'Rejected file not found' })

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client_portal',
      type: 'feedback_updated',
      title: 'Feedback de ajuste atualizado pelo portal',
      metadata: this.sanitizeActivityValue(req, { comment, tags }) as Record<string, unknown>,
    }).catch(() => {})

    res.json({ success: true })
  }

  async rejectAuthenticatedPost(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })

    const rejected = await this.portalRepository.rejectPost(req.params.postId, comment, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!rejected) return res.status(404).json({ error: 'Post not found' })

    await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId: req.params.postId,
      text: comment,
      month: new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    }).catch(() => {})

    await this.activityRepository.createForPost(req.params.postId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'post_rejected',
      title: 'Ajustes solicitados pelo cliente',
      metadata: { comment },
    }).catch(() => {})

    res.json({ success: true })
  }

  async rejectAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []

    const rejected = await this.portalRepository.rejectFile(req.params.fileId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!rejected) return res.status(404).json({ error: 'File not found' })

    await this.portalRepository.saveFeedback({
      clientId: session.clientId,
      postId: rejected.postId,
      text: comment,
      month: new Date().toISOString().slice(0, 7),
      companyId: session.companyId,
    }).catch(() => {})

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'feedback_sent',
      title: 'Ajuste solicitado pelo cliente',
      metadata: { comment, tags },
    }).catch(() => {})

    res.json({ success: true })
  }

  async updateAuthenticatedRejectedFileFeedback(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const comment = String(req.body?.comment || '').trim()
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag: any) => String(tag).trim()).filter(Boolean) : []

    const updated = await this.portalRepository.updateRejectedFileFeedback(req.params.fileId, comment, tags, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!updated) return res.status(404).json({ error: 'Rejected file not found' })

    await this.activityRepository.createForFile(req.params.fileId, {
      companyId: session.companyId,
      actorId: session.clientId,
      actorRole: 'client',
      type: 'feedback_updated',
      title: 'Feedback de ajuste atualizado pelo cliente',
      metadata: { comment, tags },
    }).catch(() => {})

    res.json({ success: true })
  }

  async resetFile(req: Request, res: Response) {
    const session = await this.getSession(req, res)
    if (!session) return

    const reset = await this.portalRepository.resetFile(req.params.fileId, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!reset) return res.status(404).json({ error: 'File not found' })
    res.json({ success: true })
  }

  async resetAuthenticatedFile(req: AuthRequest, res: Response) {
    const session = this.getAuthenticatedClient(req, res)
    if (!session) return

    const reset = await this.portalRepository.resetFile(req.params.fileId, {
      clientId: session.clientId,
      companyId: session.companyId,
    })
    if (!reset) return res.status(404).json({ error: 'File not found' })
    res.json({ success: true })
  }

  private async decideSoundtrack(
    req: Request,
    res: Response,
    session: { clientId: string; companyId?: string },
    decision: 'approved' | 'adjustment_requested',
    actorRole: string,
  ) {
    const comment = decision === 'adjustment_requested' ? String(req.body?.comment || '').trim() : null
    if (decision === 'adjustment_requested' && !comment) {
      return res.status(400).json({ error: 'comment is required' })
    }
    const soundtrack = await this.soundtrackRepository.decide(
      req.params.postId,
      decision,
      comment,
      { clientId: session.clientId, companyId: session.companyId },
      actorRole,
    )
    if (!soundtrack) return res.status(404).json({ error: 'Fundo sonoro nao encontrado ou indisponivel para decisao' })

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
    res.json({ success: true, data: soundtrack })
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
    const reset = await this.soundtrackRepository.resetDecision(req.params.postId, session)
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
    const reset = await this.soundtrackRepository.resetDecision(req.params.postId, session)
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
