import { z } from 'zod'
import { SOUNDTRACK_MODES, SOUNDTRACK_USAGE_SOURCES } from '../../domain/Soundtrack'

const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional()
const nullableUrl = z.union([
  z.string().trim().max(2048).refine(value => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Use uma URL externa HTTP ou HTTPS valida'),
  z.null(),
]).optional()

export const soundtrackInputSchema = z.object({
  mode: z.enum(SOUNDTRACK_MODES),
  sourceMediaId: z.union([z.string().uuid(), z.null()]).optional(),
  source_media_id: z.union([z.string().uuid(), z.null()]).optional(),
  trackName: nullableText(255),
  track_name: nullableText(255),
  artist: nullableText(255),
  externalUrl: nullableUrl,
  external_url: nullableUrl,
  platform: nullableText(120),
  startTimeSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  start_time_seconds: z.coerce.number().int().min(0).max(86400).optional(),
  usageSource: z.union([z.enum(SOUNDTRACK_USAGE_SOURCES), z.null()]).optional(),
  usage_source: z.union([z.enum(SOUNDTRACK_USAGE_SOURCES), z.null()]).optional(),
  usageNotes: nullableText(5000),
  usage_notes: nullableText(5000),
  rightsNotes: nullableText(5000),
  rights_notes: nullableText(5000),
}).superRefine((value, context) => {
  const trackName = value.trackName ?? value.track_name
  const externalUrl = value.externalUrl ?? value.external_url
  if (value.mode === 'external_reference' && !trackName && !externalUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['trackName'],
      message: 'Informe o nome da musica ou um link externo',
    })
  }
})

export const soundtrackAdjustmentSchema = z.object({
  comment: z.string().trim().min(1, 'O comentario do ajuste e obrigatorio').max(5000),
})

export type SoundtrackRequestDTO = z.infer<typeof soundtrackInputSchema>

export function normalizeSoundtrackInput(dto: SoundtrackRequestDTO) {
  return {
    mode: dto.mode,
    sourceMediaId: dto.sourceMediaId ?? dto.source_media_id ?? null,
    trackName: dto.trackName ?? dto.track_name ?? null,
    artist: dto.artist ?? null,
    externalUrl: dto.externalUrl ?? dto.external_url ?? null,
    platform: dto.platform ?? null,
    startTimeSeconds: dto.startTimeSeconds ?? dto.start_time_seconds ?? 0,
    usageSource: dto.usageSource ?? dto.usage_source ?? null,
    usageNotes: dto.usageNotes ?? dto.usage_notes ?? null,
    rightsNotes: dto.rightsNotes ?? dto.rights_notes ?? null,
  }
}

