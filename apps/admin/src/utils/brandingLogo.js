export const MAX_BRANDING_LOGO_SIZE = 2 * 1024 * 1024

const MIME_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export function validateBrandingLogo(file) {
  if (!file || file.size === 0) return 'Selecione uma imagem nao vazia.'
  if (file.size > MAX_BRANDING_LOGO_SIZE) return 'O logo deve ter no maximo 2 MB.'
  const extension = String(file.name || '').split('.').pop()?.toLowerCase()
  if (!extension || MIME_BY_EXTENSION[extension] !== String(file.type || '').toLowerCase()) {
    return 'Use uma imagem PNG, JPEG ou WebP com extensao correspondente.'
  }
  return null
}

export function versionBrandingLogoUrl(url, version) {
  if (!url) return ''
  if (!version) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
}
