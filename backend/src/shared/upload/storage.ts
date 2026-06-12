import path from 'path'
import fs from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config/environment'

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

export async function storeUploadedFile(file: Express.Multer.File): Promise<string> {
  if (env.NODE_ENV !== 'production') {
    return `/uploads/${file.filename}`
  }

  const supabase = getStorageClient()
  if (!supabase) {
    throw new Error('Supabase storage is not configured')
  }

  const ext = path.extname(file.originalname).toLowerCase()
  const filePath = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}${ext}`

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export async function removeStoredFile(url?: string | null): Promise<void> {
  if (!url) return

  if (env.NODE_ENV !== 'production') {
    if (!url.startsWith('/uploads/')) return
    const filePath = path.join(process.cwd(), url.replace(/^\/+/, ''))
    await fs.unlink(filePath).catch(() => {})
    return
  }

  const supabase = getStorageClient()
  if (!supabase) return

  try {
    const parsed = new URL(url)
    const marker = `/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex < 0) return
    const filePath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length))
    if (!filePath) return
    await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([filePath])
  } catch {
    // Ignore malformed or external URLs.
  }
}
