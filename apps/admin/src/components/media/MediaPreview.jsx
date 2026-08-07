import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { resolveMediaUrl } from '../../utils/mediaUrl'

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)$/i
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm|ogv|avi|mkv|mpe?g|3gp)$/i

function getLocalFile(file) {
  const candidate = file?.file || file
  return typeof File !== 'undefined' && candidate instanceof File ? candidate : null
}

export function getMediaName(file) {
  return file?.name || file?.original_name || file?.originalName || file?.file?.name || 'Arquivo'
}

export function getMediaMimeType(file) {
  return file?.mime_type || file?.mimeType || file?.type || file?.file?.type || ''
}

export function getMediaKind(file) {
  const category = String(file?.file_type || file?.fileType || '').toUpperCase()
  const mimeType = String(getMediaMimeType(file)).toLowerCase()
  const name = getMediaName(file)

  if (category === 'IMAGE' || mimeType.startsWith('image/') || IMAGE_EXTENSIONS.test(name)) return 'image'
  if (category === 'VIDEO' || mimeType.startsWith('video/') || VIDEO_EXTENSIONS.test(name)) return 'video'
  return 'file'
}

export function useMediaUrl(file, explicitUrl) {
  const localFile = getLocalFile(file)
  const [localUrl, setLocalUrl] = useState('')

  useEffect(() => {
    if (!localFile) {
      setLocalUrl('')
      return undefined
    }

    const nextUrl = URL.createObjectURL(localFile)
    setLocalUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [localFile])

  if (explicitUrl) return resolveMediaUrl(explicitUrl)
  if (localUrl) return localUrl
  return resolveMediaUrl(file?.previewUrl || file?.storage_url || file?.url)
}

export default function MediaPreview({
  file,
  src,
  className = '',
  mediaClassName = 'h-full w-full object-contain',
  fallbackClassName = '',
  controls = true,
  muted = false,
  compact = false,
  onMediaError,
}) {
  const url = useMediaUrl(file, src)
  const [mediaFailed, setMediaFailed] = useState(false)
  const kind = getMediaKind(file)
  const name = getMediaName(file)
  const mimeType = getMediaMimeType(file)

  useEffect(() => {
    setMediaFailed(false)
  }, [url])

  function handleMediaError(event) {
    setMediaFailed(true)
    onMediaError?.(event)
  }

  if (kind === 'image' && url && !mediaFailed) {
    return (
      <div className={className}>
        <img src={url} alt={name} className={mediaClassName} onError={handleMediaError} />
      </div>
    )
  }

  if (kind === 'video' && url && !mediaFailed) {
    return (
      <div className={className}>
        <video
          controls={controls}
          muted={muted}
          playsInline
          preload="metadata"
          className={mediaClassName}
          aria-label={`Vídeo: ${name}`}
          onError={handleMediaError}
          onPointerDown={event => event.stopPropagation()}
          onPointerMove={event => event.stopPropagation()}
          onPointerUp={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <source src={url} type={mimeType || undefined} />
          Seu navegador não consegue reproduzir este vídeo.
        </video>
      </div>
    )
  }

  return (
    <div className={`${className} ${fallbackClassName}`.trim()}>
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-neutral-400">
        <FileText size={compact ? 22 : 36} />
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} max-w-full truncate font-bold`}>
          {String(file?.file_type || mimeType || name.split('.').pop() || 'ARQUIVO').toUpperCase()}
        </span>
        {mediaFailed && kind === 'video' && !compact ? (
          <>
            <span className="max-w-sm text-xs font-medium">Este formato ou codec não pôde ser reproduzido no navegador. Prefira MP4 com H.264/AAC.</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 rounded-lg bg-mag-600 px-3 py-2 text-xs font-bold text-white"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => event.stopPropagation()}
            >
              Abrir arquivo original
            </a>
          </>
        ) : null}
      </div>
    </div>
  )
}
