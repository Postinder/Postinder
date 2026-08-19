import { v4 as uuidv4 } from 'uuid'
import { PostStatus } from './PostStatus'

export class Post {
  id: string
  companyId?: string
  clientId: string
  title?: string
  description?: string
  status: PostStatus
  channels?: string[]
  formats?: Record<string, string[]>
  scheduledDate?: string | null
  funnelTag?: string | null
  reviewFieldVisibility: Record<string, boolean>
  emailLink?: string | null
  createdAt: Date
  updatedAt: Date

  constructor(data: {
    id: string
    companyId?: string
    clientId: string
    title?: string
    description?: string
    status: PostStatus
    channels?: string[]
    formats?: Record<string, string[]>
    scheduledDate?: string | null
    funnelTag?: string | null
    reviewFieldVisibility?: Record<string, boolean>
    emailLink?: string | null
    createdAt: Date
    updatedAt: Date
  }) {
    this.id = data.id
    this.companyId = data.companyId
    this.clientId = data.clientId
    this.title = data.title
    this.description = data.description
    this.status = data.status
    this.channels = data.channels || []
    this.formats = data.formats || {}
    this.scheduledDate = data.scheduledDate || null
    this.funnelTag = data.funnelTag || null
    this.reviewFieldVisibility = data.reviewFieldVisibility || { funnel_tag: false }
    this.emailLink = data.emailLink || null
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
  }

  static create(data: {
    id?: string
    companyId?: string
    clientId: string
    title: string
    description?: string
    status?: PostStatus
    channels?: string[]
    formats?: Record<string, string[]>
    scheduledDate?: string | null
    funnelTag?: string | null
    reviewFieldVisibility?: Record<string, boolean>
    emailLink?: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Post {
    if (!data.title || data.title.length < 1 || data.title.length > 255) {
      throw new Error('Title must be between 1 and 255 characters')
    }
    return new Post({
      id: data.id || uuidv4(),
      companyId: data.companyId,
      clientId: data.clientId,
      title: data.title,
      description: data.description || '',
      status: data.status || PostStatus.DRAFT,
      channels: data.channels,
      formats: data.formats,
      scheduledDate: data.scheduledDate,
      funnelTag: data.funnelTag,
      reviewFieldVisibility: data.reviewFieldVisibility,
      emailLink: data.emailLink,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    })
  }

  submitForApproval(): void {
    if (this.status !== PostStatus.DRAFT) {
      throw new Error('Only draft posts can be submitted for approval')
    }
    this.status = PostStatus.PENDING_APPROVAL
    this.updatedAt = new Date()
  }

  approve(): void {
    if (this.status !== PostStatus.PENDING_APPROVAL) {
      throw new Error('Only posts pending approval can be approved')
    }
    this.status = PostStatus.APPROVED
    this.updatedAt = new Date()
  }

  reject(): void {
    if (this.status !== PostStatus.PENDING_APPROVAL) {
      throw new Error('Only posts pending approval can be rejected')
    }
    this.status = PostStatus.REJECTED
    this.updatedAt = new Date()
  }
}
