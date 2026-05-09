import { Post } from '../../domain/Post.entity'

export class PostMapper {
  static toDomain(raw: any): Post {
    return Post.create({
      id: raw.id,
      companyId: raw.company_id,
      clientId: raw.client_id,
      createdBy: raw.created_by,
      title: raw.title,
      description: raw.description || '',
      channels: raw.channels || [],
      status: raw.status,
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
      deletedAt: raw.deleted_at ? new Date(raw.deleted_at) : undefined,
    })
  }

  static toPersistence(post: Post): any {
    return {
      id: post.id,
      company_id: post.companyId,
      client_id: post.clientId,
      created_by: post.createdById,
      title: post.title,
      description: post.description,
      channels: post.channels,
      status: post.status,
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
      deleted_at: post.deletedAt?.toISOString() || null,
    }
  }

  static toDTO(post: Post): any {
    return {
      id: post.id,
      companyId: post.companyId,
      clientId: post.clientId,
      title: post.title,
      description: post.description,
      channels: post.channels,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }
  }
}
