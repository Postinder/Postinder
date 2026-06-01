import { Request, Response } from 'express'
import { createPostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'
import { PostStatus } from '../../domain/PostStatus'
import { PostRepository } from '../../infrastructure/repositories/PostRepository'
import { getFileCategory } from '../../../../shared/upload/multer'
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
    await this.activityRepository.createForPost(post.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_created',
      title: 'Post criado',
    }).catch(() => {})
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
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_updated',
      title: 'Post atualizado',
    }).catch(() => {})
    res.json(post)
  }

  async delete(req: AuthRequest, res: Response) {
    const deleted = await this.postRepository.softDelete(req.params.id, req.tenantId)
    if (!deleted) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.create({
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      postId: req.params.id,
      type: 'post_deleted',
      title: 'Post excluído',
      description: 'Uma postagem foi removida do dashboard.',
    }).catch(() => {})
    res.json({ success: true })
  }

  async uploadFiles(req: AuthRequest, res: Response) {
    const uploadedFiles = req.files as Express.Multer.File[]
    if (!uploadedFiles?.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const files = uploadedFiles.map(file => ({
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      fileType: getFileCategory(file.mimetype),
    }))

    const savedFiles = await this.postRepository.addFiles(req.params.id, files, req.tenantId)
    if (!savedFiles) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'files_uploaded',
      title: 'Arquivos enviados',
      metadata: { filesCount: savedFiles.length },
    }).catch(() => {})

    res.status(201).json({ data: savedFiles })
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
        url: `/uploads/${uploadedFile.filename}`,
        originalName: uploadedFile.originalname,
        fileType: getFileCategory(uploadedFile.mimetype),
      },
      req.tenantId,
    )

    if (!savedFile) return res.status(404).json({ error: 'Rejected file not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_corrected',
      title: 'Post corrigido',
      metadata: { fileId: req.params.fileId },
    }).catch(() => {})
    res.status(200).json({ data: savedFile })
  }

  async submitForApproval(req: AuthRequest, res: Response) {
    const submitted = await this.postRepository.submitForApproval(req.params.id, req.tenantId)
    if (!submitted) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_submitted',
      title: 'Post enviado para aprovação',
    }).catch(() => {})
    res.json({ success: true })
  }

  async resubmit(req: AuthRequest, res: Response) {
    const resubmitted = await this.postRepository.resubmit(req.params.id, req.body, req.tenantId)
    if (!resubmitted) return res.status(404).json({ error: 'Post not found' })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId || req.user?.clientId,
      actorRole: req.user?.role,
      type: 'post_resubmitted',
      title: 'Post reenviado',
      metadata: { note: req.body?.justificativa },
    }).catch(() => {})
    res.json({ success: true })
  }
}
