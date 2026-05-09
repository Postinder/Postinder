import { Request, Response } from 'express'
import { createPostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'
import { PostStatus } from '../../domain/PostStatus'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class PostsController {
  constructor(
    private createPostService: CreatePostService,
    private listPostsService: ListPostsService,
    private getPostService: GetPostService,
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
}
