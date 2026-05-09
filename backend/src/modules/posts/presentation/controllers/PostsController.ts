import { Request, Response } from 'express'
import { createPostSchema } from '../../application/dtos/CreatePostDTO'
import { CreatePostService } from '../../application/services/CreatePostService'
import { ListPostsService } from '../../application/services/ListPostsService'
import { GetPostService } from '../../application/services/GetPostService'
import { PostMapper } from '../../infrastructure/mappers/PostMapper'

interface AuthRequest extends Request {
  user: any
  tenantId: string
}

export class PostsController {
  constructor(
    private createPostService: CreatePostService,
    private listPostsService: ListPostsService,
    private getPostService: GetPostService,
  ) {}

  async create(req: AuthRequest, res: Response) {
    const dto = createPostSchema.parse(req.body)
    const post = await this.createPostService.execute(dto, req.user.userId, req.tenantId)
    res.status(201).json(PostMapper.toDTO(post))
  }

  async list(req: AuthRequest, res: Response) {
    const { limit, offset, status, clientId } = req.query
    const result = await this.listPostsService.execute(
      req.tenantId,
      {
        status: status as string,
        clientId: clientId as string,
      },
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
