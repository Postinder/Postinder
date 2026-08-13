import { useEffect, useMemo, useState } from 'react'
import { Headphones, Music2, UploadCloud } from 'lucide-react'
import Input, { Select, Textarea } from '../ui/Input'
import { getMediaKind, getMediaName } from '../media/MediaPreview'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import {
  SOUNDTRACK_MODES,
  SOUNDTRACK_USAGE_SOURCES,
  emptySoundtrackDraft,
  soundtrackHasData,
  validateSoundtrackFile,
} from '../../utils/soundtrack'

function AudioPreview({ draft }) {
  const [localUrl, setLocalUrl] = useState('')
  useEffect(() => {
    if (!draft.audioFile) {
      setLocalUrl('')
      return undefined
    }
    const url = URL.createObjectURL(draft.audioFile)
    setLocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [draft.audioFile])

  const src = localUrl || resolveMediaUrl(draft.existingAudioFile?.storage_url || draft.existingAudioFile?.url)
  if (!src) return null
  return (
    <audio controls preload="metadata" src={src} className="mt-3 w-full" aria-label="Previa do fundo sonoro" />
  )
}

export default function SoundtrackEditor({ value, onChange, attachments = [], readOnly = false }) {
  const draft = value || emptySoundtrackDraft()
  const videoOptions = useMemo(() => attachments
    .map((item, index) => ({
      key: item.id || item.localId || `video-${index}`,
      name: getMediaName(item),
      isVideo: getMediaKind(item) === 'video',
    }))
    .filter(item => item.isVideo), [attachments])

  useEffect(() => {
    if (draft.mode === 'embedded' && !draft.sourceMediaKey && videoOptions.length === 1) {
      onChange({ ...draft, sourceMediaKey: videoOptions[0].key })
    }
  }, [draft, onChange, videoOptions])

  function setField(field, nextValue) {
    onChange({ ...draft, [field]: nextValue })
  }

  function selectMode(mode) {
    if (mode === draft.mode) return
    if (soundtrackHasData(draft) && !confirm('Trocar a modalidade pode descartar o arquivo ou dados de fundo sonoro preenchidos. Continuar?')) return
    onChange({ ...emptySoundtrackDraft(), mode })
  }

  function selectAudio(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const error = validateSoundtrackFile(file)
    if (error) {
      alert(error)
      return
    }
    onChange({ ...draft, audioFile: file, existingAudioFile: null })
  }

  const status = draft.approvalStatus
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20" aria-labelledby="soundtrack-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="soundtrack-title" className="flex items-center gap-2 text-sm font-extrabold text-neutral-950 dark:text-white">
            <Headphones size={18} className="text-violet-600" /> Fundo sonoro
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Esta configuracao fica separada dos arquivos ordenaveis da publicacao.</p>
        </div>
        {status ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : status === 'adjustment_requested' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            {status === 'approved' ? 'Aprovado' : status === 'adjustment_requested' ? 'Ajuste solicitado' : 'Aguardando aprovacao'}
          </span>
        ) : null}
      </div>

      <fieldset disabled={readOnly} className="mt-4">
        <legend className="sr-only">Modalidade do fundo sonoro</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOUNDTRACK_MODES.map(option => (
            <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${draft.mode === option.value ? 'border-violet-500 bg-white text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300' : 'border-neutral-200 bg-white/70 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300'}`}>
              <input type="radio" name="soundtrack-mode" value={option.value} checked={draft.mode === option.value} onChange={() => selectMode(option.value)} className="accent-violet-600" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.mode === 'embedded' ? (
        <div className="mt-4">
          <Select label="Video que contem o audio *" value={draft.sourceMediaKey} disabled={readOnly} onChange={event => setField('sourceMediaKey', event.target.value)}>
            <option value="">Selecionar video</option>
            {videoOptions.map(video => <option key={video.key} value={video.key}>{video.name}</option>)}
          </Select>
          {!videoOptions.length ? <p className="mt-2 text-xs font-semibold text-red-600">Adicione um video compativel aos arquivos da postagem.</p> : null}
        </div>
      ) : null}

      {draft.mode === 'uploaded' ? (
        <div className="mt-4 rounded-lg border border-dashed border-violet-300 bg-white p-3 dark:border-violet-800 dark:bg-neutral-900">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-violet-700 dark:text-violet-300">
            <span className="inline-flex items-center gap-2"><UploadCloud size={17} /> {draft.audioFile?.name || draft.existingAudioFile?.originalName || draft.existingAudioFile?.original_name || 'Selecionar arquivo de audio'}</span>
            <span>Escolher</span>
            <input type="file" accept=".mp3,.wav,.ogg,.aac,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4" onChange={selectAudio} disabled={readOnly} className="hidden" />
          </label>
          <p className="mt-2 text-xs text-neutral-400">MP3, WAV, OGG, AAC ou M4A. Maximo 50 MB.</p>
          <AudioPreview draft={draft} />
        </div>
      ) : null}

      {draft.mode !== 'none' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Nome da musica ou faixa" value={draft.trackName} disabled={readOnly} onChange={event => setField('trackName', event.target.value)} />
          <Input label="Artista ou origem" value={draft.artist} disabled={readOnly} onChange={event => setField('artist', event.target.value)} />
          {draft.mode === 'external_reference' ? (
            <>
              <Input label="Plataforma, catalogo ou biblioteca" value={draft.platform} disabled={readOnly} onChange={event => setField('platform', event.target.value)} />
              <Input label="Link externo opcional" type="url" value={draft.externalUrl} disabled={readOnly} onChange={event => setField('externalUrl', event.target.value)} />
            </>
          ) : null}
          <Input label="Ponto inicial desejado (segundos)" type="number" min="0" value={draft.startTimeSeconds} disabled={readOnly} onChange={event => setField('startTimeSeconds', event.target.value)} />
          <Select label="Origem da trilha" value={draft.usageSource} disabled={readOnly} onChange={event => setField('usageSource', event.target.value)}>
            {SOUNDTRACK_USAGE_SOURCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <div className="sm:col-span-2"><Textarea label="Observacoes de uso" value={draft.usageNotes} disabled={readOnly} onChange={event => setField('usageNotes', event.target.value)} /></div>
          <div className="sm:col-span-2"><Textarea label="Direitos ou condicoes de uso (opcional)" value={draft.rightsNotes} disabled={readOnly} onChange={event => setField('rightsNotes', event.target.value)} /></div>
        </div>
      ) : null}

      {draft.adjustmentComment ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <strong>Ajuste solicitado:</strong> {draft.adjustmentComment}
        </div>
      ) : null}
      {draft.mode === 'external_reference' ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500"><Music2 size={14} /> Links externos sao apenas referencias; o Postinder nao baixa nem simula uma previa.</p>
      ) : null}
    </section>
  )
}

