import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export function canDeletePost(status, role) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  if (normalizedRole === 'viewer' || status === 'executed') return false
  return status !== 'approved' || normalizedRole === 'admin'
}

export default function DeletePostModal({ post, status, open, onClose, onConfirm, loading }) {
  const [confirmation, setConfirmation] = useState('')
  const isApproved = status === 'approved'

  useEffect(() => {
    if (open) setConfirmation('')
  }, [open, post?.id])

  if (!post) return null

  const canConfirm = !isApproved || confirmation.trim().toUpperCase() === 'EXCLUIR'

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={isApproved ? 'Excluir postagem aprovada?' : 'Excluir postagem?'}
      subtitle={isApproved
        ? 'Esta postagem ja foi aprovada pelo cliente. A exclusao removera o conteudo do fluxo operacional e podera afetar o historico de aprovacao. Esta acao nao podera ser desfeita.'
        : 'Esta postagem sera removida do fluxo de trabalho. Esta acao nao podera ser desfeita.'}
    >
      {isApproved ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <div className="flex gap-2 font-semibold"><AlertTriangle size={17} className="mt-0.5 shrink-0" />Confirmacao reforcada</div>
          <label className="mt-3 block text-xs font-semibold" htmlFor="delete-approved-post-confirmation">Digite EXCLUIR para continuar.</label>
          <input
            id="delete-approved-post-confirmation"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-500 dark:border-red-900 dark:bg-neutral-900 dark:text-white"
          />
        </div>
      ) : null}
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1 justify-center" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="danger" className="flex-1 justify-center" icon={<Trash2 size={16} />} onClick={onConfirm} disabled={!canConfirm} loading={loading}>Excluir postagem</Button>
      </div>
    </Modal>
  )
}
