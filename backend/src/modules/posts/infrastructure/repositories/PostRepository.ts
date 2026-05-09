import { supabase } from '../../../shared/database/supabase'
import { Post } from '../../domain/Post.entity'
import { IPostRepository, FindPostsFilter, PaginationParams } from '../../domain/repositories/IPostRepository'
import { PostMapper } from '../mappers/PostMapper'
import { logger } from '../../../shared/utils/Logger'

export class PostRepository implements IPostRepository {
  async save(post: Post): Promise<Post> {
    const data = PostMapper.toPersistence(post)

    const { data: saved, error } = await supabase
      .from('posts')
      .upsert(data)
      .select()
      .single()

    if (error) {
      logger.error('Failed to save post', { error })
      throw new Error('Failed to save post')
    }

    return PostMapper.toDomain(saved)
  }

  async findById(id: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from('posts')
      .select()
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) return null
    return PostMapper.toDomain(data)
  }

  async findMany(filter: FindPostsFilter, pagination: PaginationParams) {
    let query = supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('company_id', filter.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (filter.clientId) {
      query = query.eq('client_id', filter.clientId)
    }

    if (filter.status) {
      query = query.eq('status', filter.status)
    }

    const { data, error, count } = await query.range(
      pagination.offset,
      pagination.offset + pagination.limit - 1,
    )

    if (error) {
      logger.error('Failed to list posts', { error })
      return { posts: [], total: 0 }
    }

    return {
      posts: (data || []).map(PostMapper.toDomain),
      total: count || 0,
    }
  }

  async update(id: string, post: Post): Promise<Post> {
    return this.save(post)
  }

  async delete(id: string): Promise<void> {
    await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }
}
