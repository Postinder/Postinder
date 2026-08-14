import { PostStatus } from './PostStatus'

export const EDITABLE_POST_STATUSES = Object.freeze([
  PostStatus.DRAFT,
  PostStatus.READY,
  PostStatus.REJECTED,
] as const)

export const REOPENABLE_POST_STATUSES = Object.freeze([
  PostStatus.SENT,
  PostStatus.PENDING_APPROVAL,
  PostStatus.APPROVED,
] as const)

export type PostMutationClassification =
  | 'editable'
  | 'reopen_required'
  | 'executed'
  | 'unsupported'

function includesStatus(statuses: readonly PostStatus[], status: unknown): boolean {
  return typeof status === 'string' && statuses.includes(status as PostStatus)
}

export function classifyPostMutation(status: unknown): PostMutationClassification {
  if (includesStatus(EDITABLE_POST_STATUSES, status)) return 'editable'
  if (includesStatus(REOPENABLE_POST_STATUSES, status)) return 'reopen_required'
  if (status === PostStatus.EXECUTED) return 'executed'
  return 'unsupported'
}

export function isMaterialMutationAllowed(status: unknown): boolean {
  return classifyPostMutation(status) === 'editable'
}

export function isAgencyReopenAllowed(status: unknown): boolean {
  return classifyPostMutation(status) === 'reopen_required'
}
