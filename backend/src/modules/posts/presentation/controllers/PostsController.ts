import { Request, Response } from 'express'
import { createPostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'
import { PostStatus } from '../../domain/PostStatus'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'
import { getFileCategory } from '../../../../shared/upload/multer'
import { storeUploadedFile } from '../../../../shared/upload/storage'
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
    const post = await this.postRepository.updateFields(req.params.id, req.body, req.tenantId)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    res.json(post)
  }

  async delete(req: AuthRequest, res: Response) {
    const deleted = await this.postRepository.softDelete(req.params.id, req.tenantId)
    if (!deleted) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }

  async uploadFiles(req: AuthRequest, res: Response) {
    const uploadedFiles = req.files as Express.Multer.File[]
    if (!uploadedFiles?.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const sortOrders = Array.isArray(req.body?.sortOrders)
      ? req.body.sortOrders
      : typeof req.body?.sortOrders === 'string'
        ? req.body.sortOrders.split(',')
        : []

    const files = await Promise.all(uploadedFiles.map(async (file, index) => ({
      url: await storeUploadedFile(file),
      originalName: file.originalname,
      fileType: getFileCategory(file.mimetype),
      sortOrder: Number(sortOrders[index]) || undefined,
    })))

    const savedFiles = await this.postRepository.addFiles(req.params.id, files, req.tenantId)
    if (!savedFiles) return res.status(404).json({ error: 'Post not found' })

    res.status(201).json({ data: savedFiles })
  }

  async reorderFiles(req: AuthRequest, res: Response) {
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
    const uploadedFile = req.file as Express.Multer.File
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const savedFile = await this.postRepository.replaceFile(
      req.params.id,
      req.params.fileId,
      {
        url: await storeUploadedFile(uploadedFile),
        originalName: uploadedFile.originalname,
        fileType: getFileCategory(uploadedFile.mimetype),
      },
      req.tenantId,
    )

    if (!savedFile) return res.status(404).json({ error: 'Rejected file not found' })
    res.status(200).json({ data: savedFile })
  }

  async removeFile(req: AuthRequest, res: Response) {
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
    const { status } = req.body
    const updated = await this.postRepository.updateStatus(req.params.id, status, req.tenantId)
    if (!updated) return res.status(400).json({ error: 'Invalid status or post not found' })
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

  async duplicate(req: AuthRequest, res: Response) {
    const post = await this.postRepository.duplicate(req.params.id, req.tenantId)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(post.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: 'post_duplicated',
      title: 'Postagem duplicada',
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
    const resubmitted = await this.postRepository.resubmit(req.params.id, req.body, req.tenantId)
    if (!resubmitted) return res.status(404).json({ error: 'Post not found' })
    res.json({ success: true })
  }
}
