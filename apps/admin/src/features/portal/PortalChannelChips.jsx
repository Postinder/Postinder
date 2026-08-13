import ChannelIcon from '../../components/posts/ChannelIcon'

export default function PortalChannelChips({ channels = [], compact = false }) {
  if (!channels.length) {
    return <span className="text-xs font-medium text-neutral-400 dark:text-neutral-300/80">Sem canais definidos</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Canais: ${channels.join(', ')}`}>
      {channels.map(channel => (
        <span
          key={channel}
          className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--portal-brand-soft)] font-bold text-[var(--portal-brand-foreground)] ring-1 ring-inset ring-[var(--portal-brand-selection-ring)] dark:ring-neutral-700/70 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
        >
          <ChannelIcon channel={channel} size={compact ? 12 : 15} />
          {channel}
        </span>
      ))}
    </div>
  )
}
