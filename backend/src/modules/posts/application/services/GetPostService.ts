import { IPostRepository } from '../../domain/repositories/IPostRepository'
import { NotFoundException } from '../../../../shared/exceptions/AppException'

export class GetPostService {
  constructor(private postRepository: IPostRepository) {}

  async execute(id: string, companyId?: string) {
    const post = await this.postRepository.findById(id)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }
}
