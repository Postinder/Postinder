import { pool, query } from '../../../../shared/database/pool'
import { StoredFile, StorageObjectReference } from '../../../../shared/upload/storage'

export type BrandingRecord = {
  institutionalName: string
  logoBucket: string | null
  logoStoragePath: string | null
  logoMimeType: string | null
  logoSizeBytes: number | null
  logoVersion: number
  updatedAt: Date | string | null
}

function mapBranding(row: any): BrandingRecord | null {
  if (!row) return null
  return {
    institutionalName: row.institutional_name || 'Postinder',
    logoBucket: row.logo_bucket || null,
    logoStoragePath: row.logo_storage_path || null,
    logoMimeType: row.logo_mime_type || null,
    logoSizeBytes: row.logo_size_bytes === null ? null : Number(row.logo_size_bytes),
    logoVersion: Number(row.logo_version || 0),
    updatedAt: row.updated_at || null,
  }
}

export class BrandingRepository {
  async find(): Promise<BrandingRecord | null> {
    const result = await query('SELECT * FROM platform_branding WHERE singleton_key = TRUE LIMIT 1')
    return mapBranding(result.rows[0])
  }

  async saveLogo(file: StoredFile): Promise<{ branding: BrandingRecord; previous: StorageObjectReference }> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(90425001)')
      const current = await client.query('SELECT * FROM platform_branding WHERE singleton_key = TRUE FOR UPDATE')
      const previous = {
        bucket: current.rows[0]?.logo_bucket || null,
        storagePath: current.rows[0]?.logo_storage_path || null,
      }
      const saved = await client.query(
        `INSERT INTO platform_branding (
           singleton_key, institutional_name, logo_bucket, logo_storage_path,
           logo_mime_type, logo_size_bytes, logo_version, updated_at
         ) VALUES (TRUE, 'Postinder', $1, $2, $3, $4, 1, NOW())
         ON CONFLICT (singleton_key) DO UPDATE SET
           logo_bucket = EXCLUDED.logo_bucket,
           logo_storage_path = EXCLUDED.logo_storage_path,
           logo_mime_type = EXCLUDED.logo_mime_type,
           logo_size_bytes = EXCLUDED.logo_size_bytes,
           logo_version = platform_branding.logo_version + 1,
           updated_at = NOW()
         RETURNING *`,
        [file.bucket, file.storagePath, file.mimeType, file.sizeBytes],
      )
      await client.query('COMMIT')
      return { branding: mapBranding(saved.rows[0])!, previous }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async clearLogo(): Promise<{ branding: BrandingRecord | null; previous: StorageObjectReference }> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(90425001)')
      const current = await client.query('SELECT * FROM platform_branding WHERE singleton_key = TRUE FOR UPDATE')
      if (!current.rows[0]) {
        await client.query('COMMIT')
        return { branding: null, previous: {} }
      }
      const previous = {
        bucket: current.rows[0].logo_bucket || null,
        storagePath: current.rows[0].logo_storage_path || null,
      }
      const saved = await client.query(
        `UPDATE platform_branding SET
           logo_bucket = NULL, logo_storage_path = NULL, logo_mime_type = NULL,
           logo_size_bytes = NULL, logo_version = logo_version + 1, updated_at = NOW()
         WHERE singleton_key = TRUE RETURNING *`,
      )
      await client.query('COMMIT')
      return { branding: mapBranding(saved.rows[0]), previous }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
}
