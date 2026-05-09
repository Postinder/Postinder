import { Post } from '../Post.entity'
import { PostStatus } from '../PostStatus'

export interface FindPostsFilter {
  companyId: string
  clientId?: string
  status?: PostStatus
}

export interface PaginationParams {
  limit: number
  offset: number
}

export interface IPostRepository {
  save(post: Post): Promise<Post>
  findById(id: string): Promise<Post | null>
  findMany(filter: FindPostsFilter, pagination: PaginationParams): Promise<{ posts: Post[]; total: number }>
  update(id: string, post: Post): Promise<Post>
  delete(id: string): Promise<void>
}
