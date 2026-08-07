export function normalizeEmailPreviewUrl(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalized : null
  } catch {
    return null
  }
}
