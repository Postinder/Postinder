import { Request, Response } from 'express'
import { createPostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'
import { PostStatus } from '../../domain/PostStatus'
import { PostDuplicationError, PostRepository } from '../../infrastructure/repositories/PostRepository'
import { getFileCategory } from '../../../../shared/upload/multer'
import { removeStoredFile, StoredFile, storeUploadedFile } from '../../../../shared/upload/storage'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class PostsController {
  constructor(
    private createPostService: CreatePostService,
    private listPostsService: ListPostsService,
    private getPostService: GetPostService,
    private postRepository: PostRepository,
    private activityRepository = new ActivityRepository(),
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
    const dto = createPostSchema.parse(req.body)
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
    const post = await this.postRepository.updateFields(req.params.id, req.body, req.tenantId)
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
    res.status(200).json({ data: savedFile })
  }

  async removeFile(req: AuthRequest, res: Response) {
    if (!await this.ensurePostMutable(req, res)) return
    const removed = await this.postRepository.removeFile(req.params.id, req.params.fileId, req.tenantId)
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
    const submitted = await this.postRepository.submitForApproval(req.params.id, req.tenantId)
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
    const retention = ['never', 'immediate', '1d', '7d', '30d'].includes(req.body?.retention)
      ? req.body.retention
      : 'never'
    const executed = await this.postRepository.markExecuted(req.params.id, retention, req.tenantId)
    if (!executed) return res.status(400).json({ error: 'Post must be approved before execution or was not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_executed',
      title: 'Postagem marcada como executada',
      metadata: { retention },
    }).catch(() => {})
    res.json({ success: true })
  }

  async duplicate(req: AuthRequest, res: Response) {
    let post: any
    try {
      post = await this.postRepository.duplicate(req.params.id, req.tenantId)
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

    const sent = await this.postRepository.submitManyForApproval(ids, req.tenantId)
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
    const resubmitted = await this.postRepository.resubmit(req.params.id, req.body, req.tenantId)
    if (!resubmitted) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }
}
