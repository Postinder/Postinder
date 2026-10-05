import { createHash } from 'crypto'

function canonical(value: any): any {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

export function canonicalHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex')
}

const pick = (row: any, keys: string[]) => Object.fromEntries(keys.map(key => [key, row?.[key] ?? null]))
const fileKeys = ['id', 'url', 'bucket', 'storage_path', 'mime_type', 'size_bytes', 'original_name', 'file_type', 'sort_order', 'storage_deleted_at']
const soundtrackKeys = ['id', 'mode', 'revision_number', 'source_media_id', 'track_name', 'artist', 'external_url', 'platform',
  'start_time_seconds', 'usage_source', 'usage_notes', 'rights_notes', 'audio_url', 'bucket', 'storage_path', 'mime_type', 'size_bytes', 'original_name', 'storage_deleted_at']

/** Hashes material, not approval state or timestamps of access/review. Preserve exact visible text. */
export function materialFingerprint(post: any, files: any[], soundtrack: any, policy: any) {
  const ordered = [...files].sort((a, b) =>
    Number(a.sort_order ?? 999999) - Number(b.sort_order ?? 999999)
      || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      || String(a.id).localeCompare(String(b.id)))
  return canonicalHash({
    version: 1,
    post: { ...pick(post, ['id', 'client_id', 'company_id', 'content_revision', 'title', 'description', 'channels', 'formats', 'email_link']),
      scheduled_date: post.scheduled_date ? new Date(post.scheduled_date).toISOString() : null,
      funnel_tag: policy.funnelVisible ? post.funnel_tag ?? null : null },
    policy,
    files: ordered.map(file => pick(file, fileKeys)),
    soundtrack: policy.soundtrackEnabled && soundtrack?.mode !== 'none' && soundtrack ? pick(soundtrack, soundtrackKeys) : null,
  })
}
