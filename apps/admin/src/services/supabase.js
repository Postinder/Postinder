import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl.includes('SEU_PROJETO')) {
  console.warn('⚠️ Postinder: Configure o Supabase no arquivo .env')
}

// Supabase client - now only used for storage
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
)

export const STORAGE_BUCKET = 'post-files'

export async function uploadFile(file, path) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}

export async function deleteFile(path) {
  await supabase.storage.from(STORAGE_BUCKET).remove([path])
}
