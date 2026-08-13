import { Request, Response } from 'express'
import { ActivityRepository } from '../../../activities/infrastructure/repositories/ActivityRepository'
import { normalizeSoundtrackInput, soundtrackInputSchema } from '../../application/dtos/SoundtrackDTO'
import { SoundtrackRepository } from '../../infrastructure/repositories/SoundtrackRepository'
import { assertSoundtrackAudioFile } from '../../../../shared/upload/multer'
import { removeStoredFile, storeUploadedFile } from '../../../../shared/upload/storage'
import { PlatformSettingsService } from '../../../platformSettings/application/PlatformSettingsService'
import { AppException } from '../../../../shared/exceptions/AppException'

interface AuthRequest extends Request {
  user?: any
  tenantId?: string
}

export class SoundtracksController {
  constructor(
    private readonly repository = new SoundtrackRepository(),
    private readonly activityRepository = new ActivityRepository(),
    private readonly settingsService = new PlatformSettingsService(),
  ) {}

  private async assertEnabled() {
    if (!(await this.settingsService.get()).features.soundtrack) {
      throw new AppException('Fundo sonoro esta desabilitado nas configuracoes da plataforma', 409, 'SOUNDTRACK_DISABLED')
    }
  }

  async get(req: AuthRequest, res: Response) {
    const soundtrack = await this.repository.findByPostId(req.params.id, req.tenantId)
    res.json({ data: soundtrack || { mode: 'none', approvalStatus: null, approval_status: null } })
  }

  async update(req: AuthRequest, res: Response) {
    await this.assertEnabled()
    const input = normalizeSoundtrackInput(soundtrackInputSchema.parse(req.body))
    const soundtrack = await this.repository.save(req.params.id, input, {
      id: req.user?.userId,
      role: req.user?.role,
      companyId: req.tenantId,
    })
    await this.activityRepository.createForPost(req.params.id, {
      companyId: req.tenantId,
      actorId: req.user?.userId,
      actorRole: req.user?.role,
      type: input.mode === 'none' ? 'soundtrack_removed' : 'soundtrack_updated',
      title: input.mode === 'none' ? 'Fundo sonoro removido' : 'Fundo sonoro atualizado',
      metadata: {
        mode: input.mode,
        trackName: input.trackName,
        sourceMediaId: input.sourceMediaId,
        revisionNumber: soundtrack?.revisionNumber || null,
      },
    }).catch(() => {})
    res.json({ data: soundtrack || { mode: 'none', approvalStatus: null, approval_status: null } })
  }

  async upload(req: AuthRequest, res: Response) {
    await this.assertEnabled()
    const file = req.file as Express.Multer.File
    if (!file) return res.status(400).json({ error: 'Envie um arquivo de audio', code: 'SOUNDTRACK_FILE_REQUIRED' })
    await assertSoundtrackAudioFile(file)
    const input = normalizeSoundtrackInput(soundtrackInputSchema.parse({ ...req.body, mode: 'uploaded' }))
    const stored = await storeUploadedFile(file, { postId: req.params.id, folder: 'soundtracks' })
    try {
      const soundtrack = await this.repository.save(req.params.id, input, {
        id: req.user?.userId,
        role: req.user?.role,
        companyId: req.tenantId,
      }, { ...stored, originalName: file.originalname })
      await this.activityRepository.createForPost(req.params.id, {
        companyId: req.tenantId,
        actorId: req.user?.userId,
        actorRole: req.user?.role,
        type: soundtrack?.revisionNumber === 1 ? 'soundtrack_uploaded' : 'soundtrack_corrected',
        title: soundtrack?.revisionNumber === 1 ? 'Fundo sonoro enviado' : 'Nova correcao de fundo sonoro disponivel',
        metadata: {
          mode: 'uploaded',
          trackName: input.trackName,
          originalName: file.originalname,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          bucket: stored.bucket,
          storagePath: stored.storagePath,
          revisionNumber: soundtrack?.revisionNumber,
        },
      }).catch(() => {})
      res.status(201).json({ data: soundtrack })
    } catch (error) {
      await removeStoredFile({ bucket: stored.bucket, storagePath: stored.storagePath }).catch(() => {})
      throw error
    }
  }
}
