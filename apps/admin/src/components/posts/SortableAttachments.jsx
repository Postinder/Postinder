import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { resolveMediaUrl } from '../../utils/mediaUrl'

function formatSize(size) {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getFileName(item) {
  return item.name || item.original_name || item.originalName || item.file?.name || 'Arquivo'
}

function getFileType(item) {
  return item.type || item.file_type || item.fileType || item.file?.type || ''
}

function isImage(item) {
  const name = getFileName(item)
  const type = getFileType(item)
  return String(type).toLowerCase().startsWith('image/') ||
    String(type).toUpperCase() === 'IMAGE' ||
    /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)
}

function getPreviewUrl(item) {
  if (item.previewUrl) return item.previewUrl
  if (item.file instanceof File) return URL.createObjectURL(item.file)
  return resolveMediaUrl(item.storage_url || item.url)
}

export function moveAttachment(items, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= items.length) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export default function SortableAttachments({ items = [], onMove, onRemove, title = 'Arquivos da postagem', description }) {
  if (!items.length) return null

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="text-sm font-extrabold text-neutral-900 dark:text-white">{title}</div>
        <div className="mt-1 text-xs text-neutral-500">
          {description || 'Use as setas para reorganizar a ordem do carrossel.'}
        </div>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {items.map((item, index) => {
          const name = getFileName(item)
          const type = getFileType(item)
          const size = item.size || item.file?.size
          const previewUrl = getPreviewUrl(item)
          return (
            <div key={item.id || item.localId || `${name}-${index}`} className="grid grid-cols-[32px_56px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mag-50 text-sm font-black text-mag-600 dark:bg-mag-500/10 dark:text-mag-300">
                {index + 1}
              </div>
              <div className="h-14 w-14 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
                {isImage(item) && previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold text-neutral-400">
                    {String(type || name.split('.').pop() || 'ARQ').slice(0, 8).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-neutral-900 dark:text-white">{name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1"><GripVertical size={12} /> Posicao {index + 1}</span>
                  {type ? <span>{String(type).replace('image/', 'Imagem ')}</span> : null}
                  {size ? <span>{formatSize(size)}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={index === 0}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-mag-600 disabled:opacity-30 dark:hover:bg-neutral-800"
                  title="Mover para cima"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={index === items.length - 1}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-mag-600 disabled:opacity-30 dark:hover:bg-neutral-800"
                  title="Mover para baixo"
                >
                  <ArrowDown size={16} />
                </button>
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(index, item)}
                    className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
