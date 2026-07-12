import path from 'path'
import fs from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config/environment'

export type StoredFile = {
  bucket: string
  storagePath: string
  publicUrl: string
  mimeType: string
  sizeBytes: number
}

export type StorageObjectReference = {
  bucket?: string | null
  storagePath?: string | null
}

export type StorageRemovalResult = StorageObjectReference & {
  removed: boolean
  error?: string
}

export type StorageCopyTarget = {
  postId: string
  originalName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
}

const LOCAL_STORAGE_BUCKET = 'local'

function getLocalStoragePath(storagePath: string) {
  const uploadsDirectory = path.resolve(process.cwd(), 'uploads')
  const objectPath = path.resolve(uploadsDirectory, storagePath)
  if (!objectPath.startsWith(`${uploadsDirectory}${path.sep}`)) {
    throw new Error('Invalid local storage path')
  }
  return objectPath
}

function getStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

export function isRemoteStorageConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET)
}

export async function checkRemoteStorage() {
  const supabase = getStorageClient()
  if (!supabase) {
    return { ok: false, bucket: env.SUPABASE_STORAGE_BUCKET, error: 'Supabase storage is not configured' }
  }

  const { data, error } = await supabase.storage.getBucket(env.SUPABASE_STORAGE_BUCKET)
  if (error) {
    return { ok: false, bucket: env.SUPABASE_STORAGE_BUCKET, error: error.message }
  }

  return { ok: true, bucket: data.name }
}

export async function storeUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
  if (env.NODE_ENV !== 'production') {
    return {
      bucket: LOCAL_STORAGE_BUCKET,
      storagePath: file.filename,
      publicUrl: `/uploads/${file.filename}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    }
  }

  const supabase = getStorageClient()
  if (!supabase) {
    throw new Error('Supabase storage is not configured')
  }

  const ext = path.extname(file.originalname).toLowerCase()
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}${ext}`
  const bucket = env.SUPABASE_STORAGE_BUCKET

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return {
    bucket,
    storagePath,
    publicUrl: data.publicUrl,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  }
}

export async function copyStoredFile(
  source: StorageObjectReference,
  target: StorageCopyTarget,
): Promise<StoredFile> {
  const bucket = source.bucket || null
  const sourcePath = source.storagePath || null
  if (!bucket || !sourcePath) {
    throw new Error('Storage object identity is missing')
  }

  const extension = path.extname(target.originalName || sourcePath).toLowerCase()
  const storagePath = `posts/${target.postId}/${uuidv4()}${extension}`

  if (env.NODE_ENV !== 'production') {
    if (bucket !== LOCAL_STORAGE_BUCKET) {
      throw new Error('Local storage bucket does not match object bucket')
    }

    const sourceFile = getLocalStoragePath(sourcePath)
    const destinationFile = getLocalStoragePath(storagePath)
    await fs.mkdir(path.dirname(destinationFile), { recursive: true })
    await fs.copyFile(sourceFile, destinationFile)

    const stats = await fs.stat(destinationFile)
    return {
      bucket,
      storagePath,
      publicUrl: `/uploads/${storagePath}`,
      mimeType: target.mimeType || 'application/octet-stream',
      sizeBytes: target.sizeBytes ?? stats.size,
    }
  }

  const supabase = getStorageClient()
  if (!supabase) {
    throw new Error('Supabase storage is not configured')
  }

  const { error } = await supabase.storage.from(bucket).copy(sourcePath, storagePath)
  if (error) {
    throw new Error(`Failed to copy file: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return {
    bucket,
    storagePath,
    publicUrl: data.publicUrl,
    mimeType: target.mimeType || 'application/octet-stream',
    sizeBytes: target.sizeBytes || 0,
  }
}

export async function removeStoredFile(reference: StorageObjectReference): Promise<StorageRemovalResult> {
  const bucket = reference.bucket || null
  const storagePath = reference.storagePath || null
  if (!bucket || !storagePath) {
    return { bucket, storagePath, removed: false, error: 'Storage object identity is missing' }
  }

  if (env.NODE_ENV !== 'production') {
    if (bucket !== LOCAL_STORAGE_BUCKET) {
      return { bucket, storagePath, removed: false, error: 'Local storage bucket does not match object bucket' }
    }

    try {
      await fs.unlink(getLocalStoragePath(storagePath))
      return { bucket, storagePath, removed: true }
    } catch (error: any) {
      return { bucket, storagePath, removed: false, error: error.message }
    }
  }

  const supabase = getStorageClient()
  if (!supabase) {
    return { bucket, storagePath, removed: false, error: 'Supabase storage is not configured' }
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([storagePath])
    if (error) return { bucket, storagePath, removed: false, error: error.message }
    return { bucket, storagePath, removed: true }
  } catch (error: any) {
    return { bucket, storagePath, removed: false, error: error.message }
  }
}
