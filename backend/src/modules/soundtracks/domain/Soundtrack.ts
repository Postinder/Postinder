export const SOUNDTRACK_MODES = ['none', 'embedded', 'uploaded', 'external_reference'] as const
export type SoundtrackMode = typeof SOUNDTRACK_MODES[number]

export const SOUNDTRACK_APPROVAL_STATUSES = ['pending', 'approved', 'adjustment_requested'] as const
export type SoundtrackApprovalStatus = typeof SOUNDTRACK_APPROVAL_STATUSES[number]

export const SOUNDTRACK_USAGE_SOURCES = [
  'platform_library',
  'licensed_bank',
  'client_provided',
  'original_production',
  'other',
] as const
export type SoundtrackUsageSource = typeof SOUNDTRACK_USAGE_SOURCES[number]

export type SoundtrackInput = {
  mode: SoundtrackMode
  sourceMediaId?: string | null
  trackName?: string | null
  artist?: string | null
  externalUrl?: string | null
  platform?: string | null
  startTimeSeconds?: number
  usageSource?: SoundtrackUsageSource | null
  usageNotes?: string | null
  rightsNotes?: string | null
}

export function soundtrackRequiresApproval(mode?: string | null) {
  return Boolean(mode && mode !== 'none')
}

export function isPendingSoundtrack(status?: string | null) {
  return status === 'pending'
}

export function hasSoundtrackAdjustment(status?: string | null) {
  return status === 'adjustment_requested'
}

export function derivePostApprovalStatus(input: {
  pendingFiles: number
  rejectedFiles: number
  totalFiles: number
  soundtrackStatus?: SoundtrackApprovalStatus | null
}) {
  const pending = input.pendingFiles > 0 || input.soundtrackStatus === 'pending'
  const rejected = input.rejectedFiles > 0 || input.soundtrackStatus === 'adjustment_requested'
  const hasReviewableContent = input.totalFiles > 0 || Boolean(input.soundtrackStatus)
  if (rejected) return 'rejected'
  if (pending) return 'sent'
  if (hasReviewableContent) return 'approved'
  return null
}
