import { v4 as uuidv4 } from 'uuid'
import { PostStatus } from './PostStatus'

export class Post {
  id: string
  companyId: string
  clientId: string
  createdById: string
  title: string
  description: string
  channels: string[]
  status: PostStatus
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  constructor(data: {
    id: string
    companyId: string
    clientId: string
    createdById: string
    title: string
    description: string
    channels: string[]
    status: PostStatus
    createdAt: Date
    updatedAt: Date
    deletedAt?: Date
  }) {
    this.id = data.id
    this.companyId = data.companyId
    this.clientId = data.clientId
    this.createdById = data.createdById
    this.title = data.title
    this.description = data.description
    this.channels = data.channels
    this.status = data.status
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
    this.deletedAt = data.deletedAt
  }

  static create(data: {
    id?: string
    companyId: string
    clientId: string
    createdBy: string
    title: string
    description?: string
    channels: string[]
    status?: PostStatus
    createdAt?: Date
    updatedAt?: Date
    deletedAt?: Date
  }): Post {
    if (data.title.length < 3 || data.title.length > 255) {
      throw new Error('Title must be between 3 and 255 characters')
    }

    if (data.channels.length === 0) {
      throw new Error('At least one channel is required')
    }

    return new Post({
      id: data.id || uuidv4(),
      companyId: data.companyId,
      clientId: data.clientId,
      createdById: data.createdBy,
      title: data.title,
      description: data.description || '',
      channels: data.channels,
      status: data.status || PostStatus.DRAFT,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      deletedAt: data.deletedAt,
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

  schedule(): void {
    if (this.status !== PostStatus.APPROVED) {
      throw new Error('Only approved posts can be scheduled')
    }
    this.status = PostStatus.SCHEDULED
    this.updatedAt = new Date()
  }

  publish(): void {
    if (this.status !== PostStatus.SCHEDULED && this.status !== PostStatus.APPROVED) {
      throw new Error('Only scheduled or approved posts can be published')
    }
    this.status = PostStatus.PUBLISHED
    this.updatedAt = new Date()
  }

  archive(): void {
    if (this.deletedAt) {
      throw new Error('Post is already archived')
    }
    this.deletedAt = new Date()
    this.updatedAt = new Date()
  }
}
