import multer, { FileFilterCallback } from 'multer'
import fs from 'fs'
import path from 'path'
import { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fsPromises from 'fs/promises'
import sharp from 'sharp'
import { PNG } from 'pngjs'
import { crc32 } from 'node:zlib'
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
const MAX_BRANDING_LOGO_PIXELS = 16_000_000
const MAX_CONCURRENT_BRANDING_DECODES = 2
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
  limits: {
    fileSize: MAX_BRANDING_LOGO_SIZE,
    files: 1,
    fields: 0,
    parts: 2,
    fieldNestingDepth: 0,
  } as NonNullable<NonNullable<Parameters<typeof multer>[0]>['limits']> & { fieldNestingDepth: number },
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

type BrandingImageFormat = 'png' | 'jpeg' | 'webp'
type BrandingImageMetadata = {
  format?: string
  width?: number
  height?: number
  pages?: number
}

let activeBrandingDecodes = 0

export async function runWithBrandingDecodeSlot<T>(operation: () => Promise<T>) {
  if (activeBrandingDecodes >= MAX_CONCURRENT_BRANDING_DECODES) {
    throw new AppException(
      'A validacao de imagens esta temporariamente ocupada. Tente novamente.',
      503,
      'BRANDING_VALIDATION_BUSY',
    )
  }
  activeBrandingDecodes += 1
  try {
    return await operation()
  } finally {
    activeBrandingDecodes -= 1
  }
}

export function hasSingleStaticPage(metadata: BrandingImageMetadata) {
  return metadata.pages === undefined || metadata.pages === 1
}

function detectBrandingImageFormat(content: Buffer): BrandingImageFormat | null {
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'png'
  }
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return 'jpeg'
  }
  if (
    content.length >= 12
    && content.subarray(0, 4).toString('ascii') === 'RIFF'
    && content.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

function assertStaticPngContainer(content: Buffer) {
  let offset = 8
  let ihdrCount = 0
  let idatCount = 0
  let iendCount = 0
  let idatClosed = false
  let width = 0
  let height = 0

  while (offset < content.length) {
    if (content.length - offset < 12) throw new Error('Truncated PNG chunk')
    const chunkLength = content.readUInt32BE(offset)
    const typeStart = offset + 4
    const dataStart = offset + 8
    const dataEnd = dataStart + chunkLength
    const chunkEnd = dataEnd + 4
    if (dataEnd < dataStart || chunkEnd > content.length) throw new Error('PNG chunk exceeds input')

    const chunkType = content.subarray(typeStart, dataStart).toString('ascii')
    if (!/^[A-Za-z]{4}$/.test(chunkType)) throw new Error('Invalid PNG chunk type')
    const expectedCrc = content.readUInt32BE(dataEnd)
    const actualCrc = crc32(content.subarray(typeStart, dataEnd)) >>> 0
    if (actualCrc !== expectedCrc) throw new Error(`Invalid PNG CRC for ${chunkType}`)
    if (iendCount) throw new Error('PNG data found after IEND')

    if (chunkType === 'IHDR') {
      ihdrCount += 1
      if (ihdrCount !== 1 || offset !== 8 || chunkLength !== 13) throw new Error('Invalid PNG IHDR')
      width = content.readUInt32BE(dataStart)
      height = content.readUInt32BE(dataStart + 4)
      if (!width || !height || width * height > MAX_BRANDING_LOGO_PIXELS) throw new Error('Invalid PNG dimensions')
    } else if (['acTL', 'fcTL', 'fdAT'].includes(chunkType)) {
      throw new Error('Animated PNG is not supported')
    } else if (chunkType === 'IDAT') {
      if (ihdrCount !== 1 || idatClosed) throw new Error('Invalid PNG IDAT order')
      idatCount += 1
    } else {
      if (idatCount) idatClosed = true
      if (chunkType === 'IEND') {
        iendCount += 1
        if (chunkLength !== 0 || ihdrCount !== 1 || idatCount === 0) throw new Error('Invalid PNG IEND')
      }
    }
    offset = chunkEnd
  }

  if (offset !== content.length || ihdrCount !== 1 || idatCount === 0 || iendCount !== 1) {
    throw new Error('Incomplete PNG container')
  }

  const decoded = PNG.sync.read(content, { checkCRC: true })
  if (decoded.width !== width || decoded.height !== height || decoded.data.length === 0) {
    throw new Error('PNG decode did not match container')
  }
}

function assertStaticWebpContainer(content: Buffer) {
  if (content.length < 20 || content.readUInt32LE(4) + 8 !== content.length) {
    throw new Error('Incomplete WebP container')
  }

  let offset = 12
  let imageChunks = 0
  while (offset < content.length) {
    if (content.length - offset < 8) throw new Error('Truncated WebP chunk')
    const chunkType = content.subarray(offset, offset + 4).toString('ascii')
    const chunkLength = content.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + chunkLength
    const chunkEnd = dataEnd + (chunkLength % 2)
    if (dataEnd < dataStart || chunkEnd > content.length) throw new Error('WebP chunk exceeds input')

    if (chunkType === 'ANIM' || chunkType === 'ANMF') throw new Error('Animated WebP is not supported')
    if (chunkType === 'VP8X') {
      if (chunkLength !== 10 || (content[dataStart] & 0x02) !== 0) throw new Error('Animated or invalid extended WebP')
    }
    if (chunkType === 'VP8 ' || chunkType === 'VP8L') imageChunks += 1
    offset = chunkEnd
  }

  if (offset !== content.length || imageChunks !== 1) throw new Error('Invalid WebP image chunks')
}

async function assertStructurallyValidBrandingImage(content: Buffer, expectedFormat: BrandingImageFormat) {
  return runWithBrandingDecodeSlot(async () => {
    try {
      if (expectedFormat === 'png') assertStaticPngContainer(content)
      if (expectedFormat === 'jpeg' && (
        content.length < 4
        || content[content.length - 2] !== 0xff
        || content[content.length - 1] !== 0xd9
      )) throw new Error('Incomplete JPEG container')
      if (expectedFormat === 'webp') assertStaticWebpContainer(content)

      const image = sharp(content, {
        failOn: 'warning',
        limitInputPixels: MAX_BRANDING_LOGO_PIXELS,
        sequentialRead: true,
      })
      const metadata = await image.metadata()
      if (
        metadata.format !== expectedFormat
        || !metadata.width
        || !metadata.height
        || metadata.width <= 0
        || metadata.height <= 0
        || !hasSingleStaticPage(metadata)
      ) {
        throw new Error('Unexpected or multi-page image metadata')
      }
      await image.raw().toBuffer()
    } catch {
      throw new AppException(
        'O arquivo de logo esta corrompido, animado, incompleto ou possui estrutura invalida.',
        415,
        'INVALID_BRANDING_CONTENT',
      )
    }
  })
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
    const expectedFormat: BrandingImageFormat = extension === '.png'
      ? 'png'
      : ['.jpg', '.jpeg'].includes(extension)
        ? 'jpeg'
        : 'webp'
    const detectedFormat = detectBrandingImageFormat(content)
    if (detectedFormat !== expectedFormat) {
      throw new AppException(
        'O conteudo do arquivo nao corresponde a uma imagem PNG, JPEG ou WebP valida.',
        415,
        'INVALID_BRANDING_CONTENT',
      )
    }
    await assertStructurallyValidBrandingImage(content, expectedFormat)
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
