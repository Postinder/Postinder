import { BrandingRecord, BrandingRepository } from '../infrastructure/repositories/BrandingRepository'
import {
  getStoredFilePublicUrl,
  removeStoredFile,
  StoredFile,
  storeBrandingLogo,
  StorageObjectReference,
} from '../../../shared/upload/storage'
import { logger } from '../../../shared/utils/Logger'

type BrandingDependencies = {
  store: (file: Express.Multer.File) => Promise<StoredFile>
  remove: (reference: StorageObjectReference) => Promise<{ removed: boolean; error?: string }>
  publicUrl: (reference: StorageObjectReference) => string | null
}

const defaultDependencies: BrandingDependencies = {
  store: storeBrandingLogo,
  remove: removeStoredFile,
  publicUrl: getStoredFilePublicUrl,
}

export class BrandingService {
  constructor(
    private readonly repository = new BrandingRepository(),
    private readonly storage: BrandingDependencies = defaultDependencies,
  ) {}

  private toPublicBranding(record: BrandingRecord | null) {
    let logoUrl: string | null = null
    if (record?.logoBucket && record.logoStoragePath) {
      try {
        logoUrl = this.storage.publicUrl({
          bucket: record.logoBucket,
          storagePath: record.logoStoragePath,
        })
      } catch {
        logger.warn('Branding logo URL could not be generated')
      }
    }
    return {
      institutional_name: record?.institutionalName || 'Postinder',
      logo_url: logoUrl,
      logo_configured: Boolean(record?.logoBucket && record.logoStoragePath),
      logo_version: record?.logoVersion || 0,
      updated_at: record?.updatedAt || null,
    }
  }

  async getPublicBranding() {
    return this.toPublicBranding(await this.repository.find())
  }

  async replaceLogo(file: Express.Multer.File) {
    const stored = await this.storage.store(file)
    let result: Awaited<ReturnType<BrandingRepository['saveLogo']>>
    try {
      result = await this.repository.saveLogo(stored)
    } catch (error) {
      const cleanup = await this.storage.remove(stored).catch(() => ({ removed: false }))
      if (!cleanup.removed) logger.warn('New branding object cleanup failed after persistence error')
      throw error
    }

    if (result.previous.bucket && result.previous.storagePath) {
      const cleanup = await this.storage.remove(result.previous).catch(() => ({ removed: false }))
      if (!cleanup.removed) logger.warn('Previous branding object cleanup failed after replacement')
    }
    return this.toPublicBranding(result.branding)
  }

  async removeLogo() {
    const result = await this.repository.clearLogo()
    if (result.previous.bucket && result.previous.storagePath) {
      const cleanup = await this.storage.remove(result.previous).catch(() => ({ removed: false }))
      if (!cleanup.removed) logger.warn('Previous branding object cleanup failed after removal')
    }
    return this.toPublicBranding(result.branding)
  }
}
