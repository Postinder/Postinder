import multer, { FileFilterCallback } from 'multer'
import fs from 'fs'
import path from 'path'
import { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fsPromises from 'fs/promises'
import { AppException } from '../exceptions/AppException'

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/bmp', 'image/tiff',
  // Videos
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'video/x-matroska', 'video/mpeg', 'video/3gpp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4',
  // Design / other
  'application/zip', 'application/x-zip-compressed',
  'text/plain',
])

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`))
  }
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads')
    fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const storage = process.env.NODE_ENV === 'production'
  ? multer.memoryStorage()
  : diskStorage

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for videos
})

const SOUNDTRACK_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
])

const SOUNDTRACK_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a'])
export const MAX_SOUNDTRACK_SIZE = 50 * 1024 * 1024

function soundtrackFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const extension = path.extname(file.originalname).toLowerCase()
  if (SOUNDTRACK_MIME_TYPES.has(String(file.mimetype).toLowerCase()) && SOUNDTRACK_EXTENSIONS.has(extension)) {
    cb(null, true)
    return
  }
  cb(new AppException('Use um arquivo de audio MP3, WAV, OGG, AAC ou M4A', 415, 'UNSUPPORTED_SOUNDTRACK_TYPE'))
}

export const soundtrackUpload = multer({
  storage,
  fileFilter: soundtrackFileFilter,
  limits: { fileSize: MAX_SOUNDTRACK_SIZE, files: 1 },
})

export const MAX_BRANDING_LOGO_SIZE = 2 * 1024 * 1024
const BRANDING_LOGO_EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
])

function validateBrandingLogoMetadata(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase()
  const mimeType = String(file.mimetype || '').toLowerCase()
  if (BRANDING_LOGO_EXTENSIONS.get(extension) !== mimeType) {
    throw new AppException(
      'Use uma imagem PNG, JPEG ou WebP com extensao correspondente.',
      415,
      'UNSUPPORTED_BRANDING_TYPE',
    )
  }
  if (file.size > MAX_BRANDING_LOGO_SIZE) {
    throw new AppException('O logo excede o limite de 2 MB.', 413, 'BRANDING_FILE_TOO_LARGE')
  }
}

function brandingLogoFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  try {
    validateBrandingLogoMetadata(file)
    cb(null, true)
  } catch (error) {
    cb(error as Error)
  }
}

export const brandingLogoUpload = multer({
  storage,
  fileFilter: brandingLogoFileFilter,
  limits: { fileSize: MAX_BRANDING_LOGO_SIZE, files: 1 },
})

async function readFileHeader(file: Express.Multer.File) {
  if (file.buffer?.length) return file.buffer.subarray(0, 16)
  if (!file.path) return Buffer.alloc(0)
  const handle = await fsPromises.open(file.path, 'r')
  try {
    const buffer = Buffer.alloc(16)
    const result = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, result.bytesRead)
  } finally {
    await handle.close()
  }
}

async function discardTemporaryUpload(file: Express.Multer.File) {
  if (!file.path) return
  await fsPromises.unlink(file.path).catch(() => {})
}

async function readUploadedFile(file: Express.Multer.File) {
  if (file.buffer) return file.buffer
  if (!file.path) return Buffer.alloc(0)
  return fsPromises.readFile(file.path)
}

export async function assertBrandingLogoFile(file: Express.Multer.File) {
  try {
    validateBrandingLogoMetadata(file)
    const content = await readUploadedFile(file)
    if (!content.length) {
      throw new AppException('O arquivo de logo esta vazio.', 400, 'EMPTY_BRANDING_FILE')
    }
    if (content.length > MAX_BRANDING_LOGO_SIZE) {
      throw new AppException('O logo excede o limite de 2 MB.', 413, 'BRANDING_FILE_TOO_LARGE')
    }

    const extension = path.extname(file.originalname).toLowerCase()
    const isPng = content.length >= 24
      && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      && content.subarray(12, 16).toString('ascii') === 'IHDR'
      && content.readUInt32BE(16) > 0
      && content.readUInt32BE(20) > 0
    const isJpeg = content.length >= 4
      && content[0] === 0xff && content[1] === 0xd8
      && content[content.length - 2] === 0xff && content[content.length - 1] === 0xd9
    const isWebp = content.length >= 16
      && content.subarray(0, 4).toString('ascii') === 'RIFF'
      && content.subarray(8, 12).toString('ascii') === 'WEBP'
      && ['VP8 ', 'VP8L', 'VP8X'].includes(content.subarray(12, 16).toString('ascii'))
    const valid = extension === '.png' ? isPng : ['.jpg', '.jpeg'].includes(extension) ? isJpeg : isWebp
    if (!valid) {
      throw new AppException(
        'O conteudo do arquivo nao corresponde a uma imagem PNG, JPEG ou WebP valida.',
        415,
        'INVALID_BRANDING_CONTENT',
      )
    }
  } catch (error) {
    await discardTemporaryUpload(file)
    throw error
  }
}

export async function assertSoundtrackAudioFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase()
  const header = await readFileHeader(file)
  const ascii = header.toString('ascii')
  const isMp3 = ascii.startsWith('ID3') || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  const isWav = ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE'
  const isOgg = ascii.startsWith('OggS')
  const isMp4 = ascii.slice(4, 8) === 'ftyp'
  const isAac = header[0] === 0xff && (header[1] & 0xf6) === 0xf0
  const valid = extension === '.mp3'
    ? isMp3
    : extension === '.wav'
      ? isWav
      : extension === '.ogg'
        ? isOgg
        : extension === '.m4a'
          ? isMp4
          : extension === '.aac'
            ? isAac || isMp4
            : false

  if (!valid) {
    await discardTemporaryUpload(file)
    throw new AppException('O conteudo do arquivo nao corresponde a um audio suportado', 415, 'INVALID_SOUNDTRACK_CONTENT')
  }
}

export function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOC'
  if (mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'SHEET'
  if (mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'PPTX'
  return 'FILE'
}
