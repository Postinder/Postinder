import { IPostRepository, FindPostsFilter, PaginationParams } from '../../domain/repositories/IPostRepository'
import { logger } from '../../../shared/utils/Logger'

export class ListPostsService {
  constructor(private postRepository: IPostRepository) {}

  async execute(
    companyId: string,
    filter?: Partial<FindPostsFilter>,
    pagination?: PaginationParams,
  ) {
    const finalFilter: FindPostsFilter = {
      companyId,
      ...filter,
    }

    const finalPagination: PaginationParams = {
      limit: Math.min(pagination?.limit || 20, 100),
      offset: pagination?.offset || 0,
    }

    logger.info('Listing posts', { companyId, filter: finalFilter })

    return this.postRepository.findMany(finalFilter, finalPagination)
  }
}
