import { Post } from '../../domain/Post.entity'
import { PostStatus } from '../../domain/PostStatus'

export class PostMapper {
  static toDomain(raw: any): Post {
    return new Post({
      id: raw.id,
      companyId: raw.company_id,
      clientId: raw.client_id,
      title: raw.title,
      description: raw.description || '',
      status: raw.status as PostStatus,
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
    })
  }

  static toDomainWithFiles(raw: any): Post & { files: any[] } {
    const post = PostMapper.toDomain(raw) as Post & { files: any[] }
    post.files = Array.isArray(raw.files) ? raw.files : []
    return post
  }

  static toPersistence(post: Post): any {
    return {
      id: post.id,
      company_id: post.companyId ?? null,
      client_id: post.clientId,
      title: post.title,
      description: post.description,
      status: post.status,
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
    }
  }

  static toDTO(post: Post & { files?: any[] }): any {
    return {
      id: post.id,
      companyId: post.companyId,
      clientId: post.clientId,
      client_id: post.clientId,
      title: post.title,
      description: post.description,
      status: post.status,
      files: post.files || [],
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }
  }
}
