export default function PortalChannelChips({ channels = [], compact = false }) {
  if (!channels.length) {
    return <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Sem canais definidos</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Canais: ${channels.join(', ')}`}>
      {channels.map(channel => (
        <span
          key={channel}
          className={`rounded-full bg-neutral-100 font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
        >
          {channel}
        </span>
      ))}
    </div>
  )
}
