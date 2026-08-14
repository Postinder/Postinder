import { useEffect, useRef, useState } from 'react'
import { CheckCircle, ExternalLink, Music2, Pause, Play, Volume2, VolumeX, XCircle } from 'lucide-react'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import PortalDialog from './PortalDialog'
import PortalStatusBadge from './PortalStatusBadge'
import { applySoundtrackStartTime, playExclusiveSoundtrack, stopSoundtrack, toggleSoundtrackMute } from '../../utils/soundtrackPlayback'
import { getPostContentRevision } from './portalRevision'

const MODE_LABELS = {
  embedded: 'Ja incluida no video',
  uploaded: 'Arquivo de audio enviado',
  external_reference: 'Musica ou referencia indicada',
}

export default function SoundtrackReviewCard({ post, soundtrack, onApprove, onAdjust, busy, revisionConflictSequence = 0 }) {
  const audioRef = useRef(null)
  const commentRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [adjustRevision, setAdjustRevision] = useState(null)
  const audioFile = soundtrack?.audioFile
  const audioUrl = resolveMediaUrl(audioFile?.storage_url || audioFile?.url)
  const status = soundtrack?.approvalStatus || soundtrack?.approval_status || 'pending'
  const startTime = Number(soundtrack?.startTimeSeconds || soundtrack?.start_time_seconds || 0)
  const sourceMediaId = soundtrack?.sourceMediaId || soundtrack?.source_media_id
  const sourceMedia = (post?.files || []).find(file => file.id === sourceMediaId)
  const sourceMediaUrl = resolveMediaUrl(sourceMedia?.storage_url || sourceMedia?.url)

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      stopSoundtrack(audio)
    }
  }, [post?.id, audioUrl])

  useEffect(() => {
    function stopOtherSoundtrack(event) {
      if (event.detail !== soundtrack?.id) {
        stopSoundtrack(audioRef.current)
        setPlaying(false)
      }
    }
    window.addEventListener('postinder:soundtrack-play', stopOtherSoundtrack)
    return () => window.removeEventListener('postinder:soundtrack-play', stopOtherSoundtrack)
  }, [soundtrack?.id])

  useEffect(() => {
    setAdjustOpen(false)
    setComment('')
    setAdjustRevision(null)
  }, [revisionConflictSequence, post?.id, post?.contentRevision, post?.content_revision])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await playExclusiveSoundtrack(audio, soundtrack.id)
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    } else {
      stopSoundtrack(audio)
      setPlaying(false)
    }
  }

  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    setMuted(toggleSoundtrackMute(audio))
  }

  function submitAdjustment() {
    if (!comment.trim()) return
    onAdjust(comment.trim(), adjustRevision).then(saved => {
      if (saved === false) return
      setComment('')
      setAdjustOpen(false)
      setAdjustRevision(null)
    })
  }

  return (
    <section className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-900 dark:bg-neutral-900" aria-labelledby={`soundtrack-${post.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-500">Fundo sonoro</div>
          <h3 id={`soundtrack-${post.id}`} className="mt-1 flex items-center gap-2 text-base font-black text-neutral-950 dark:text-white">
            <Music2 size={18} /> {soundtrack.trackName || soundtrack.track_name || MODE_LABELS[soundtrack.mode]}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-300/80">{MODE_LABELS[soundtrack.mode]}{soundtrack.artist ? ` - ${soundtrack.artist}` : ''}</p>
        </div>
        <PortalStatusBadge status={status === 'adjustment_requested' ? 'rejected' : status} />
      </div>

      {soundtrack.mode === 'uploaded' && audioUrl ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onLoadedMetadata={event => applySoundtrackStartTime(event.currentTarget, startTime)}
            onEnded={() => setPlaying(false)}
            aria-label={`Fundo sonoro: ${soundtrack.trackName || soundtrack.track_name || audioFile.originalName || audioFile.original_name || 'audio'}`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={togglePlayback} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950">
              {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pausar' : 'Reproduzir'}
            </button>
            <button type="button" onClick={toggleMute} aria-pressed={muted} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} Fundo sonoro {muted ? 'desligado' : 'ligado'}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-300/80">Reproduzir, pausar ou desligar o som altera somente esta previa e nunca registra uma decisao.</p>
          {(post.files || []).some(file => String(file.file_type || '').toUpperCase() === 'VIDEO') ? (
            <p className="mt-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Som original do video: use o volume do player de video. Fundo sonoro: use os controles acima. Os dois podem ser testados separadamente ou juntos.</p>
          ) : null}
        </div>
      ) : null}

      {soundtrack.mode === 'external_reference' ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p><strong>Plataforma ou catalogo:</strong> {soundtrack.platform || 'Nao informado'}</p>
          {soundtrack.externalUrl || soundtrack.external_url ? (
            <a href={soundtrack.externalUrl || soundtrack.external_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-bold text-violet-600"><ExternalLink size={14} /> Abrir referencia externa</a>
          ) : null}
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-300/80">Esta modalidade e somente uma referencia. Nao existe uma previa sonora hospedada no Postinder.</p>
        </div>
      ) : null}

      {soundtrack.mode === 'embedded' ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="font-semibold">A musica ja esta incorporada ao video {soundtrack.sourceMediaName ? `“${soundtrack.sourceMediaName}”` : 'indicado'}.</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-300/80">Use o controle de volume do proprio video para silenciar ou reativar. Nao ha um player de audio separado.</p>
          {sourceMediaUrl ? (
            <video controls playsInline preload="metadata" src={sourceMediaUrl} className="mt-3 max-h-72 w-full rounded-lg bg-black object-contain" aria-label="Video com fundo sonoro incorporado" />
          ) : null}
        </div>
      ) : null}

      {soundtrack.startTimeSeconds || soundtrack.start_time_seconds ? <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-300/80">Ponto inicial sugerido: {soundtrack.startTimeSeconds || soundtrack.start_time_seconds}s</p> : null}
      {soundtrack.usageNotes || soundtrack.usage_notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{soundtrack.usageNotes || soundtrack.usage_notes}</p> : null}
      {status === 'adjustment_requested' && (soundtrack.adjustmentComment || soundtrack.adjustment_comment) ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <strong>Ajuste solicitado:</strong> {soundtrack.adjustmentComment || soundtrack.adjustment_comment}
        </div>
      ) : null}

      {status === 'pending' ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => { setAdjustRevision(getPostContentRevision(post)); setAdjustOpen(true) }} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 dark:border-red-900"><XCircle size={16} /> Reprovar</button>
          <button type="button" onClick={onApprove} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-60"><CheckCircle size={16} /> Aprovar fundo sonoro</button>
        </div>
      ) : null}
      {status === 'adjustment_requested' ? (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onApprove} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-60"><CheckCircle size={16} /> Aprovar fundo sonoro mesmo assim</button>
        </div>
      ) : null}

      {adjustOpen ? (
        <PortalDialog labelledBy="soundtrack-adjust-title" describedBy="soundtrack-adjust-description" onClose={() => { setAdjustOpen(false); setComment(''); setAdjustRevision(null) }} initialFocusRef={commentRef}>
          <h3 id="soundtrack-adjust-title" className="text-lg font-black">Reprovar fundo sonoro</h3>
          <p id="soundtrack-adjust-description" className="mt-1 text-sm text-neutral-500 dark:text-neutral-300/80">Explique obrigatoriamente o que precisa ser alterado.</p>
          <textarea ref={commentRef} value={comment} onChange={event => setComment(event.target.value)} className="mt-4 h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-neutral-700 dark:bg-neutral-950" aria-label="Comentario do ajuste do fundo sonoro" />
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => { setAdjustOpen(false); setComment(''); setAdjustRevision(null) }} className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-bold dark:border-neutral-700">Cancelar</button>
            <button type="button" onClick={submitAdjustment} disabled={busy || !comment.trim()} className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reprovar</button>
          </div>
        </PortalDialog>
      ) : null}
    </section>
  )
}
