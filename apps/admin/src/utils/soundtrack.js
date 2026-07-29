export const SOUNDTRACK_MODES = [
  { value: 'none', label: 'Sem fundo sonoro' },
  { value: 'embedded', label: 'Ja esta incluido no video' },
  { value: 'uploaded', label: 'Enviar arquivo de audio' },
  { value: 'external_reference', label: 'Indicar musica ou referencia' },
]

export const SOUNDTRACK_USAGE_SOURCES = [
  { value: '', label: 'Nao informado' },
  { value: 'platform_library', label: 'Biblioteca da plataforma' },
  { value: 'licensed_bank', label: 'Banco licenciado' },
  { value: 'client_provided', label: 'Fornecida pelo cliente' },
  { value: 'original_production', label: 'Producao propria' },
  { value: 'other', label: 'Outra' },
]

export const MAX_SOUNDTRACK_SIZE = 50 * 1024 * 1024
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/aac', 'audio/mp4',
])
const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|aac|m4a)$/i

export function emptySoundtrackDraft() {
  return {
    mode: 'none',
    sourceMediaKey: '',
    trackName: '',
    artist: '',
    externalUrl: '',
    platform: '',
    startTimeSeconds: 0,
    usageSource: '',
    usageNotes: '',
    rightsNotes: '',
    audioFile: null,
    existingAudioFile: null,
    approvalStatus: null,
    adjustmentComment: '',
  }
}

export function soundtrackDraftFromPost(post) {
  const soundtrack = post?.soundtrack
  if (!soundtrack) return emptySoundtrackDraft()
  return {
    ...emptySoundtrackDraft(),
    mode: soundtrack.mode || 'none',
    sourceMediaKey: soundtrack.sourceMediaId || soundtrack.source_media_id || '',
    trackName: soundtrack.trackName || soundtrack.track_name || '',
    artist: soundtrack.artist || '',
    externalUrl: soundtrack.externalUrl || soundtrack.external_url || '',
    platform: soundtrack.platform || '',
    startTimeSeconds: soundtrack.startTimeSeconds || soundtrack.start_time_seconds || 0,
    usageSource: soundtrack.usageSource || soundtrack.usage_source || '',
    usageNotes: soundtrack.usageNotes || soundtrack.usage_notes || '',
    rightsNotes: soundtrack.rightsNotes || soundtrack.rights_notes || '',
    existingAudioFile: soundtrack.audioFile || null,
    approvalStatus: soundtrack.approvalStatus || soundtrack.approval_status || null,
    adjustmentComment: soundtrack.adjustmentComment || soundtrack.adjustment_comment || '',
  }
}

export function validateSoundtrackFile(file) {
  if (!file) return 'Selecione um arquivo de audio.'
  if (file.size > MAX_SOUNDTRACK_SIZE) return `${file.name}: o audio excede o limite de 50 MB.`
  const mimeType = String(file.type || '').toLowerCase()
  if (mimeType && !ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) return `${file.name}: use MP3, WAV, OGG, AAC ou M4A.`
  if (!ALLOWED_AUDIO_EXTENSIONS.test(file.name)) return `${file.name}: extensao de audio nao suportada.`
  return null
}

export function soundtrackHasData(draft) {
  return Boolean(
    draft?.sourceMediaKey
    || draft?.trackName
    || draft?.artist
    || draft?.externalUrl
    || draft?.platform
    || Number(draft?.startTimeSeconds || 0) > 0
    || draft?.usageSource
    || draft?.usageNotes
    || draft?.rightsNotes
    || draft?.audioFile
    || draft?.existingAudioFile
    || draft?.approvalStatus
    || draft?.adjustmentComment
  )
}

export function validateSoundtrackDraft(draft, videoOptions = []) {
  if (!draft || draft.mode === 'none') return null
  if (draft.mode === 'embedded') {
    if (!videoOptions.length) return 'Adicione um video compativel para usar audio incorporado.'
    if (!draft.sourceMediaKey && videoOptions.length > 1) return 'Selecione qual video contem o fundo sonoro.'
    if (draft.sourceMediaKey && !videoOptions.some(video => video.key === draft.sourceMediaKey)) {
      return 'Selecione um video ativo desta postagem para o fundo sonoro.'
    }
  }
  if (draft.mode === 'uploaded' && !draft.audioFile && !draft.existingAudioFile) {
    return 'Selecione um arquivo de audio para o fundo sonoro.'
  }
  if (draft.mode === 'external_reference' && !draft.trackName.trim() && !draft.externalUrl.trim()) {
    return 'Informe o nome da musica ou um link externo.'
  }
  if (draft.externalUrl) {
    try {
      const url = new URL(draft.externalUrl)
      if (!['http:', 'https:'].includes(url.protocol)) return 'Use um link externo HTTP ou HTTPS.'
    } catch {
      return 'Informe um link externo valido.'
    }
  }
  return null
}

export function buildSoundtrackPayload(draft, sourceMediaId = null) {
  return {
    mode: draft.mode,
    sourceMediaId: draft.mode === 'embedded' ? sourceMediaId : null,
    trackName: draft.trackName || null,
    artist: draft.artist || null,
    externalUrl: draft.mode === 'external_reference' ? draft.externalUrl || null : null,
    platform: draft.platform || null,
    startTimeSeconds: Number(draft.startTimeSeconds || 0),
    usageSource: draft.usageSource || null,
    usageNotes: draft.usageNotes || null,
    rightsNotes: draft.rightsNotes || null,
  }
}

export function isSoundtrackPending(soundtrack) {
  return Boolean(soundtrack && soundtrack.mode !== 'none' && (soundtrack.approvalStatus || soundtrack.approval_status) === 'pending')
}
