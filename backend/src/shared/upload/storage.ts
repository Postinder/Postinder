import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config/environment'

const BUCKET_NAME = 'postinder-uploads'

function getPublicBaseUrl() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function storeUploadedFile(file: Express.Multer.File): Promise<string> {
  if (env.NODE_ENV !== 'production') {
    return `/uploads/${file.filename}`
  }

  const supabase = getPublicBaseUrl()
  if (!supabase) {
    throw new Error('Supabase storage is not configured')
  }

  const ext = path.extname(file.originalname).toLowerCase()
  const filePath = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}${ext}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
  return data.publicUrl
}
