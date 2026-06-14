export enum PostStatus {
  DRAFT = 'draft',
  READY = 'ready',
  SENT = 'sent',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
  EXECUTED = 'executed',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
}

export const PostStatusValues = Object.values(PostStatus)
