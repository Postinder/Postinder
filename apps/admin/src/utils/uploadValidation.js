export const MAX_UPLOAD_SIZE = 200 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/bmp', 'image/tiff',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'video/x-matroska', 'video/mpeg', 'video/3gpp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4',
  'application/zip', 'application/x-zip-compressed', 'text/plain',
])

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|mp4|mov|avi|webm|mkv|mpe?g|3gp|pdf|docx?|xlsx?|pptx?|txt|zip|mp3|wav|ogg|aac|flac|m4a)$/i

export function validateUploadFile(file) {
  if (file.size > MAX_UPLOAD_SIZE) {
    return `${file.name}: o arquivo excede o limite de 200 MB.`
  }

  const mimeType = String(file.type || '').toLowerCase()
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return `${file.name}: formato não suportado (${mimeType}).`
  }

  if (!mimeType && !ALLOWED_EXTENSIONS.test(file.name)) {
    return `${file.name}: não foi possível identificar um formato suportado.`
  }

  return null
}

export function prepareUploadFiles(fileList) {
  const accepted = []
  const errors = []

  Array.from(fileList || []).forEach(file => {
    const error = validateUploadFile(file)
    if (error) errors.push(error)
    else accepted.push({
      localId: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random()}`,
      file,
      name: file.name,
      type: file.type,
      size: file.size,
    })
  })

  return { accepted, errors }
}
