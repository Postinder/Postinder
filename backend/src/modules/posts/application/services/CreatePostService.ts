import { Post } from '../../domain/Post.entity'
import { IPostRepository } from '../../domain/repositories/IPostRepository'
import { CreatePostDTO } from '../dtos/CreatePostDTO'
import { logger } from '../../../../shared/utils/Logger'

export class CreatePostService {
  constructor(private postRepository: IPostRepository) {}

  async execute(dto: CreatePostDTO, userId: string, companyId?: string): Promise<Post> {
    logger.info('Creating post', { userId, companyId, title: dto.title })

    const post = Post.create({
      companyId,
      clientId: dto.clientId,
      title: dto.title,
      description: dto.description || dto.caption,
    })

    const saved = await this.postRepository.save(post)
    logger.info('Post created', { postId: saved.id })

    return saved
  }
}
