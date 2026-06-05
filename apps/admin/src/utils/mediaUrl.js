const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

function getApiOrigin() {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

export function resolveMediaUrl(url) {
  if (!url) return ''
  if (/^(https?:|blob:|data:)/i.test(url)) return url

  const normalized = url.startsWith('/') ? url : `/${url}`
  if (normalized.startsWith('/uploads/')) {
    return `${getApiOrigin()}${normalized}`
  }

  return normalized
}
