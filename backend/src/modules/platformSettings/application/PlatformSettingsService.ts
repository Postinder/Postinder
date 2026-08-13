import { PlatformSettingsPatch, platformSettingsPatchSchema } from '../domain/PlatformSettings'
import { PlatformSettingsRepository } from '../infrastructure/repositories/PlatformSettingsRepository'

export class PlatformSettingsService {
  constructor(private readonly repository = new PlatformSettingsRepository()) {}

  async get() {
    return this.repository.find()
  }

  async update(input: unknown) {
    const patch: PlatformSettingsPatch = platformSettingsPatchSchema.parse(input)
    return this.repository.update(patch)
  }
}
