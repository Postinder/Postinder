import { getPortalStatusMeta } from './portalStatus'

export default function PortalStatusBadge({ status, approvalSource }) {
  const meta = getPortalStatusMeta(status)

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      {approvalSource === 'admin' && status === 'approved' ? 'Aprovado pela equipe' : meta.label}
    </span>
  )
}
