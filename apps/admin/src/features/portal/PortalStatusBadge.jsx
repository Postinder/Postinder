import { getPortalStatusMeta } from './portalStatus'

export default function PortalStatusBadge({ status }) {
  const meta = getPortalStatusMeta(status)

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      {meta.label}
    </span>
  )
}
