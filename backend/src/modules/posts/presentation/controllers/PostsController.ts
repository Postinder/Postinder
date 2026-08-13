import { Request, Response } from 'express'
import { ACTIVE_POST_CHANNELS, assertEmailPreviewRequirement, createPostSchema, updatePostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'
import { PostStatus } from '../../domain/PostStatus'
import { PostDuplicationError, PostRepository } from '../../infrastructure/repositories/PostRepository'
import { getFileCategory } from '../../../../shared/upload/multer'
import { removeStoredFile, StoredFile, storeUploadedFile } from '../../../../shared/upload/storage'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'
import { SoundtrackRepository } from '../../../soundtracks/infrastructure/repositories/SoundtrackRepository'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from '../../../platformSettings/domain/PlatformSettings'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export function applyPostFieldPolicies(
  input: Record<string, any>,
  settings: PlatformSettings,
  current?: any,
) {
  const result = { ...input }
  // Funnel data is retained on existing posts for compatibility, but it is no longer
  // accepted or required as an operational field.
  delete result.funnelTag
  delete result.funnel_tag
  const definitions = [
    { policy: settings.post_fields.description, keys: ['description', 'caption'], current: current?.description },
    { policy: settings.post_fields.scheduled_date, keys: ['scheduledDate', 'scheduled_date'], current: current?.scheduledDate },
  ] as const

  for (const definition of definitions) {
    const suppliedKey = definition.keys.find(key => Object.prototype.hasOwnProperty.call(result, key))
    const supplied = suppliedKey ? result[suppliedKey] : undefined
    if (definition.policy === 'hidden') {
      definition.keys.forEach(key => delete result[key])
      continue
    }
    const effective = suppliedKey ? supplied : definition.current
    if (definition.policy === 'required' && (effective === undefined || effective === null || String(effective).trim() === '')) {
      throw new Error(`${definition.keys[0]} is required`)
    }
  }
  return result
}

export class PostsController {
  constructor(
    private createPostService: CreatePostService,
    private listPostsService: ListPostsService,
    private getPostService: GetPostService,
    private postRepository: PostRepository,
    private activityRepository = new ActivityRepository(),
    private soundtrackRepository = new SoundtrackRepository(),
    private settingsService: Pick<PlatformSettingsService, 'get'> = {
      get: async () => ({ ...DEFAULT_PLATFORM_SETTINGS, updated_at: null }),
    },
  ) {}

  private async compensateUploadedFiles(files: StoredFile[]) {
    const removals = await Promise.all(files.map(file => removeStoredFile({
      bucket: file.bucket,
      storagePath: file.storagePath,
    })))
    removals.filter(result => !result.removed).forEach(result => {
      console.error('Failed to compensate uploaded storage object', result)
    })
  }

  private async ensurePostMutable(req: AuthRequest, res: Response) {
    const mutationState = await this.postRepository.getMutationState(req.params.id, req.tenantId)
    if (mutationState.allowed) return true
    if (mutationState.reason === 'executed') {
      res.status(409).json({ error: 'Executed posts are historical records and cannot be changed' })
      return false
    }
    res.status(404).json({ error: 'Post not found' })
    return false
  }

  async create(req: AuthRequest, res: Response) {
    const settings = await this.settingsService.get()
    let policyInput
    try {
      policyInput = applyPostFieldPolicies(req.body || {}, settings)
    } catch (error: any) {
      return res.status(400).json({ error: error.message })
    }
    const dto = createPostSchema.parse(policyInput)
    const post = await this.createPostService.execute(
      dto,
      req.user?.userId || req.user?.clientId,
      req.tenantId,
    )
    res.status(201).json(PostMapper.toDTO(post))
  }

  async list(req: AuthRequest, res: Response) {
    const { limit, offset, status, clientId } = req.query

    const statusValue = status && Object.values(PostStatus).includes(status as PostStatus)
      ? (status as PostStatus)
      : undefined
    const result = await this.listPostsService.execute(
      req.tenantId,
      { status: statusValue, clientId: clientId as string | undefined },
      {
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0,
      },
    )

    res.json({
      data: result.posts.map(PostMapper.toDTO),
      total: result.total,
    })
  }

  async getById(req: AuthRequest, res: Response) {
    const post = await this.getPostService.execute(req.params.id, req.tenantId)
    res.json(PostMapper.toDTO(post))
  }

  async update(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const current = await this.postRepository.findById(req.params.id, req.tenantId)
    if (!current) return res.status(404).json({ error: 'Post not found' })
    const settings = await this.settingsService.get()
    let policyInput
    try {
      policyInput = applyPostFieldPolicies(req.body || {}, settings, current)
    } catch (error: any) {
      return res.status(400).json({ error: error.message })
    }
    const updates = updatePostSchema.parse(policyInput)
    const unsupportedNewChannels = (updates.channels || []).filter(channel => (
      !ACTIVE_POST_CHANNELS.includes(channel as any)
      && !(current.channels || []).includes(channel)
    ))
    if (unsupportedNewChannels.length) {
      return res.status(400).json({ error: 'Unsupported channel' })
    }
    try {
      assertEmailPreviewRequirement({
        channels: updates.channels ?? current.channels,
        emailLink: Object.prototype.hasOwnProperty.call(updates, 'emailLink')
          ? updates.emailLink
          : Object.prototype.hasOwnProperty.call(updates, 'email_link')
            ? updates.email_link
            : current.emailLink,
      })
    } catch (error: any) {
      return res.status(400).json({ error: error.message })
    }
    const post = await this.postRepository.updateFields(req.params.id, updates, req.tenantId)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    res.json(post)
  }

  async delete(req: AuthRequest, res: Response) {
    const result = await this.postRepository.softDelete(req.params.id, req.user?.role, req.tenantId)
    if (!result.deleted) {
      if (result.reason === 'executed') {
        return res.status(409).json({ error: 'Executed posts are historical records and cannot be deleted' })
      }
      if (result.reason === 'approved_requires_admin') {
        return res.status(403).json({ error: 'Only admin users can delete approved posts' })
      }
      if (result.reason === 'viewer_forbidden') {
        return res.status(403).json({ error: 'Viewer users have read-only access' })
      }
      return res.status(404).json({ error: 'Post not found' })
    }
    await this.activityRepository.create({
      companyId: req.tenantId,
      clientId: result.post?.clientId,
      postId: result.post?.id,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_deleted',
      title: 'Postagem excluida',
      metadata: {
        previousStatus: result.post?.status,
        wasApproved: result.post?.status === 'approved',
      },
    }).catch(() => {})
    res.json({ success: true })
  }

  async uploadFiles(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const uploadedFiles = req.files as Express.Multer.File[]
    if (!uploadedFiles?.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const sortOrders = Array.isArray(req.body?.sortOrders)
      ? req.body.sortOrders
      : typeof req.body?.sortOrders === 'string'
        ? req.body.sortOrders.split(',')
        : []

    const uploadedStorageFiles: StoredFile[] = []
    try {
      for (const file of uploadedFiles) {
        uploadedStorageFiles.push(await storeUploadedFile(file))
      }
    } catch (error) {
      await this.compensateUploadedFiles(uploadedStorageFiles)
      throw error
    }

    const files = uploadedStorageFiles.map((storedFile, index) => ({
      url: storedFile.publicUrl,
      bucket: storedFile.bucket,
      storagePath: storedFile.storagePath,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      originalName: uploadedFiles[index].originalname,
      fileType: getFileCategory(uploadedFiles[index].mimetype),
      sortOrder: Number(sortOrders[index]) || undefined,
    }))

    let savedFiles
    try {
      savedFiles = await this.postRepository.addFiles(req.params.id, files, req.tenantId)
    } catch (error) {
      await this.compensateUploadedFiles(uploadedStorageFiles)
      throw error
    }
    if (!savedFiles) {
      await this.compensateUploadedFiles(uploadedStorageFiles)
      return res.status(404).json({ error: 'Post not found' })
    }

    res.status(201).json({ data: savedFiles })
  }

  async reorderFiles(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const files = Array.isArray(req.body?.files) ? req.body.files : []
    if (!files.length) return res.status(400).json({ error: 'files is required' })

    const normalized = files.map((file: any, index: number) => ({
      id: String(file.id || ''),
      sort_order: Number(file.sort_order ?? file.sortOrder ?? index + 1),
    }))

    if (normalized.some((file: { id: string; sort_order: number }) => !file.id || !Number.isFinite(file.sort_order))) {
      return res.status(400).json({ error: 'Invalid file order payload' })
    }

    const reordered = await this.postRepository.reorderFiles(req.params.id, normalized, req.tenantId)
    if (!reordered) return res.status(404).json({ error: 'Post or file not found' })
    res.json({ success: true })
  }

  async replaceFile(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const uploadedFile = req.file as Express.Multer.File
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const settings = await this.settingsService.get()
    if (settings.features.soundtrack
      && await this.soundtrackRepository.isEmbeddedSource(req.params.id, req.params.fileId)
      && getFileCategory(uploadedFile.mimetype) !== 'VIDEO') {
      return res.status(400).json({
        error: 'O arquivo vinculado ao fundo sonoro incorporado deve continuar sendo um video',
        code: 'INVALID_SOUNDTRACK_SOURCE_MEDIA',
      })
    }

    const storedFile = await storeUploadedFile(uploadedFile)
    let savedFile
    try {
      savedFile = await this.postRepository.replaceFile(
        req.params.id,
        req.params.fileId,
        {
          url: storedFile.publicUrl,
          bucket: storedFile.bucket,
          storagePath: storedFile.storagePath,
          mimeType: storedFile.mimeType,
          sizeBytes: storedFile.sizeBytes,
          originalName: uploadedFile.originalname,
          fileType: getFileCategory(uploadedFile.mimetype),
        },
        req.tenantId,
      )
    } catch (error) {
      await this.compensateUploadedFiles([storedFile])
      throw error
    }

    if (!savedFile) {
      await this.compensateUploadedFiles([storedFile])
      return res.status(404).json({ error: 'Rejected file not found' })
    }
    if (settings.features.soundtrack) {
      await this.soundtrackRepository.invalidateEmbeddedSource(req.params.id, req.params.fileId, {
        id: req.user?.userId,
        role: req.user?.role,
        companyId: req.tenantId,
      })
    }
    res.status(200).json({ data: savedFile })
  }

  async removeFile(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const settings = await this.settingsService.get()
    const removed = await this.postRepository.removeFile(
      req.params.id,
      req.params.fileId,
      req.tenantId,
      settings.features.soundtrack,
    )
    if (!removed) return res.status(404).json({ error: 'Post or file not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_file_removed',
      title: 'Arquivo removido da postagem',
      metadata: { fileId: req.params.fileId },
    }).catch(() => {})
    res.json({ success: true })
  }

  async submitForApproval(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const settings = await this.settingsService.get()
    const submitted = await this.postRepository.submitForApproval(
      req.params.id,
      req.tenantId,
      settings.features.soundtrack,
    )
    if (!submitted) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_sent_for_approval',
      title: 'Post enviado para aprovacao',
    }).catch(() => {})
    res.json({ success: true })
  }

  async updateStatus(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const { status } = req.body
    const result = await this.postRepository.updateStatus(req.params.id, status, req.tenantId)
    if (!result.updated) {
      if (result.reason === 'not_found') return res.status(404).json({ error: 'Post not found' })
      if (result.reason === 'invalid_status') {
        return res.status(400).json({ error: 'Generic status endpoint only accepts draft and ready' })
      }
      return res.status(400).json({ error: 'Only draft to ready or ready to draft transitions are allowed' })
    }
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_status_changed',
      title: 'Status da postagem alterado',
      metadata: { status },
    }).catch(() => {})
    res.json({ success: true })
  }

  async markExecuted(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const settings = await this.settingsService.get()
    const retentionHours = settings.retention.executed_attachment_hours
    const executed = await this.postRepository.markExecuted(req.params.id, retentionHours, req.tenantId)
    if (!executed) return res.status(400).json({ error: 'Post must be approved before execution or was not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_executed',
      title: 'Postagem marcada como executada',
      metadata: { retentionHours },
    }).catch(() => {})
    res.json({ success: true })
  }

  async duplicate(req: AuthRequest, res: Response) {
    let post: any
    try {
      const settings = await this.settingsService.get()
      post = await this.postRepository.duplicate(
        req.params.id,
        req.tenantId,
        settings.features.soundtrack,
      )
    } catch (error) {
      if (error instanceof PostDuplicationError) {
        const message = error.code === 'legacy_file_identity_missing'
          ? 'A postagem possui arquivo legado sem identidade de armazenamento e precisa ser regularizada antes da duplicacao.'
          : 'Nao foi possivel duplicar a postagem. Nenhuma copia foi criada.'
        return res.status(409).json({ error: message })
      }
      throw error
    }
    if (!post) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(post.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_duplicated',
      title: 'Postagem duplicada',
      metadata: {
        sourcePostId: req.params.id,
        duplicatedPostId: post.id,
        filesCopied: post.duplicatedFileCount || 0,
      },
    }).catch(() => {})
    res.status(201).json({ data: post })
  }

  async submitBatchForApproval(req: AuthRequest, res: Response) {
    const ids = Array.isArray(req.body?.postIds) ? req.body.postIds : []
    if (!ids.length) return res.status(400).json({ error: 'postIds is required' })

    const settings = await this.settingsService.get()
    const sent = await this.postRepository.submitManyForApproval(
      ids,
      req.tenantId,
      settings.features.soundtrack,
    )
    await Promise.all(sent.map(post => this.activityRepository.createForPost(post.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_sent_for_approval',
      title: 'Post enviado para aprovacao',
      metadata: { batch: true },
    }).catch(() => {})))

    res.json({ success: true, sent })
  }

  async resubmit(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const settings = await this.settingsService.get()
    const resubmitted = await this.postRepository.resubmit(
      req.params.id,
      req.body,
      req.tenantId,
      settings.features.soundtrack,
    )
    if (!resubmitted) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }
}
