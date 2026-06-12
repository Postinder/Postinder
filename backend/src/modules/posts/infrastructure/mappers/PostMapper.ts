import { Post } from '../../domain/Post.entity'
import { PostStatus } from '../../domain/PostStatus'

export class PostMapper {
  static toDomain(raw: any): Post {
    const post = new Post({
      id: raw.id,
      companyId: raw.company_id,
      clientId: raw.client_id,
      title: raw.title,
      description: raw.description || '',
      status: raw.status as PostStatus,
      channels: raw.channels || [],
      formats: raw.formats || {},
      scheduledDate: raw.scheduled_date || null,
      funnelTag: raw.funnel_tag || null,
      emailLink: raw.email_link || null,
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
    })
    ;(post as any).submittedAt = raw.submitted_at || null
    ;(post as any).approvedAt = raw.approved_at || null
    ;(post as any).executedAt = raw.executed_at || null
    ;(post as any).filesDeleteAfter = raw.files_delete_after || null
    return post
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
      channels: post.channels || [],
      formats: post.formats || {},
      scheduled_date: post.scheduledDate,
      funnel_tag: post.funnelTag,
      email_link: post.emailLink,
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
      channels: post.channels || [],
      formats: post.formats || {},
      scheduled_date: post.scheduledDate,
      scheduledDate: post.scheduledDate,
      funnel_tag: post.funnelTag,
      funnelTag: post.funnelTag,
      email_link: post.emailLink,
      emailLink: post.emailLink,
      files: post.files || [],
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      submittedAt: (post as any).submittedAt,
      submitted_at: (post as any).submittedAt,
      approvedAt: (post as any).approvedAt,
      approved_at: (post as any).approvedAt,
      executedAt: (post as any).executedAt,
      executed_at: (post as any).executedAt,
      filesDeleteAfter: (post as any).filesDeleteAfter,
      files_delete_after: (post as any).filesDeleteAfter,
    }
  }
}
