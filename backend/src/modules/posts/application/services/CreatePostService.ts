import { Post } from '../../domain/Post.entity'
import { IPostRepository } from '../../domain/repositories/IPostRepository'
import { CreatePostDTO } from '../dtos/CreatePostDTO'
import { logger } from '../../../../shared/utils/Logger'
import { PostStatus } from '../../domain/PostStatus'
import { query } from '../../../../shared/database/pool'
import { NotFoundException } from '../../../../shared/exceptions/AppException'

export class CreatePostService {
  constructor(private postRepository: IPostRepository) {}

  async execute(dto: CreatePostDTO, userId: string, companyId?: string): Promise<Post> {
    logger.info('Creating post', { userId, companyId, title: dto.title })

    const params: any[] = [dto.clientId]
    const conditions = ['id = $1', 'is_active = true']
    if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }
    const client = await query(`SELECT id FROM clients WHERE ${conditions.join(' AND ')}`, params)
    if (!client.rows[0]) {
      throw new NotFoundException('Client not found')
    }

    const post = Post.create({
      companyId,
      clientId: dto.clientId,
      title: dto.title,
      description: dto.description || dto.caption,
      channels: dto.channels || [],
      formats: dto.formats || {},
      scheduledDate: dto.scheduledDate || dto.scheduled_date || null,
      funnelTag: dto.funnelTag || dto.funnel_tag || null,
      emailLink: dto.emailLink || dto.email_link || null,
      status: dto.emailLink || dto.email_link ? PostStatus.PENDING_APPROVAL : undefined,
    })

    const saved = await this.postRepository.save(post)
    logger.info('Post created', { postId: saved.id })

    return saved
  }
}
