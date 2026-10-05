import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import PortalDialog from '../../features/portal/PortalDialog'
import { prepareAdminApproval, approvePostAdministratively, fetchPostReviewHistory } from '../../services/posts.service'

export default function AdministrativeReview({ post, role, onChanged }) {
  const [intent, setIntent] = useState(null)
  const [justification, setJustification] = useState('')
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const request = useRef(null)
  const inFlight = useRef(false)
  const input = useRef(null)

  async function openApproval() {
    if (busy || role !== 'admin' || post.status !== 'rejected') return
    setBusy(true)
    try {
      const state = await prepareAdminApproval(post.id)
      setIntent({ ...state, postId: post.id, idempotencyKey: crypto.randomUUID() })
      setJustification('')
      request.current = null
    } catch (error) { toast.error(error.response?.data?.error || 'Não foi possível preparar a aprovação.') }
    finally { setBusy(false) }
  }

  async function confirm() {
    if (!intent || !justification.trim() || busy || inFlight.current || role !== 'admin') return
    inFlight.current = true
    setBusy(true)
    // Freeze the payload after the first attempt. A timeout retry reuses the same intention and key.
    request.current ||= { expectedRevision: intent.expectedRevision, expectedFingerprint: intent.expectedFingerprint,
      idempotencyKey: intent.idempotencyKey, justification: justification.trim() }
    try {
      await approvePostAdministratively(intent.postId, request.current)
      setIntent(null)
      toast.success('Aprovado manualmente pela equipe.')
      await onChanged?.()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível confirmar. Tente novamente com a mesma intenção.')
      if ([400, 403, 404, 409].includes(error.response?.status)) { setIntent(null); await onChanged?.() }
    } finally { inFlight.current = false; setBusy(false) }
  }

  async function openHistory() {
    setBusy(true)
    try { setHistory(await fetchPostReviewHistory(post.id)) }
    catch (error) { toast.error(error.response?.data?.error || 'Não foi possível carregar o histórico.') }
    finally { setBusy(false) }
  }

  return <>
    {post.approvalSource === 'admin' && <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Aprovado manualmente pela equipe</span>}
    {role === 'admin' && post.status === 'rejected' && <button type="button" disabled={busy} onClick={openApproval}
      className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:text-blue-300">Aprovar manualmente</button>}
    <button type="button" disabled={busy} onClick={openHistory} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Histórico de decisões</button>
    {intent && <PortalDialog labelledBy={`admin-approval-${post.id}`} initialFocusRef={input} onClose={() => { if (!busy) setIntent(null) }}>
      <h2 id={`admin-approval-${post.id}`} className="text-lg font-bold">Aprovar conteúdo manualmente?</h2>
      <p className="mt-2 text-sm">Esta ação aprovará a revisão atual sem uma nova aprovação do cliente. A solicitação de ajuste anterior continuará registrada no histórico.</p>
      <p className="mt-2 text-sm font-semibold">A liberação inclui todos os anexos e o fundo sonoro aplicável.</p>
      <p className="mt-3 font-bold">{intent.title || post.title}</p>
      <p className="max-h-32 overflow-auto whitespace-pre-wrap text-sm">{intent.description}</p>
      <label htmlFor={`admin-reason-${post.id}`} className="mt-4 block text-sm font-bold">Justificativa — obrigatória</label>
      <textarea id={`admin-reason-${post.id}`} ref={input} value={justification} maxLength={5000}
        disabled={busy || !!request.current} onChange={event => setJustification(event.target.value)}
        className="mt-2 h-28 w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
        placeholder="Ajuste pontual solicitado pelo cliente realizado pela equipe. Não requer nova validação." />
      <div className="mt-4 flex gap-3">
        <button type="button" disabled={busy} onClick={() => setIntent(null)} className="flex-1 rounded-lg border px-3 py-2">Cancelar</button>
        <button type="button" disabled={busy || !justification.trim()} onClick={confirm} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Aprovando…' : 'Confirmar aprovação manual'}</button>
      </div>
    </PortalDialog>}
    {history && <PortalDialog labelledBy={`review-history-${post.id}`} onClose={() => setHistory(null)}>
      <h2 id={`review-history-${post.id}`} className="text-lg font-bold">Histórico de decisões</h2>
      <div className="mt-4 max-h-[65vh] space-y-3 overflow-auto text-sm">
        {history.decisions.map(decision => <article key={decision.id} className="rounded-lg border p-3">
          <strong>{decision.decision === 'rejected' ? 'Cliente solicitou ajuste' : decision.positive_reaction === 'loved' ? 'Cliente adorou' : 'Cliente aprovou'} — revisão {decision.content_revision}</strong>
          <p>{new Date(decision.decided_at).toLocaleString('pt-BR')}</p>
          {decision.positive_feedback && <p className="mt-2 whitespace-pre-wrap text-blue-700 dark:text-blue-300">{decision.positive_feedback}</p>}
          {(decision.item_snapshot || []).map(item => <p key={item.fileId} className="mt-2 whitespace-pre-wrap">{item.decision === 'rejected' ? 'Ajuste' : item.positiveReaction === 'loved' ? 'Adorei' : 'Aprovado'}: {item.positiveFeedback || item.comment || 'Sem comentário'}</p>)}
        </article>)}
        {history.actions.filter(action => action.action === 'admin_approved').map(action => <article key={action.id} className="rounded-lg border border-blue-300 p-3">
          <strong>Aprovado manualmente pela equipe — revisão {action.content_revision}</strong>
          <p>{action.actor_name || action.actor_id} · {new Date(action.created_at).toLocaleString('pt-BR')}</p>
          <p className="mt-2 whitespace-pre-wrap">{action.justification}</p>
          <p className="mt-1 text-xs">Após solicitação de ajuste da revisão {history.decisions.find(decision => decision.id === action.decision_id)?.content_revision ?? 'anterior'}.</p>
        </article>)}
        {history.feedbacks.map(feedback => <p key={feedback.id} className="whitespace-pre-wrap rounded-lg border p-3">Solicitação/feedback anterior: {feedback.text}</p>)}
        {!history.decisions.length && !history.actions.length && <p>Sem decisões oficiais registradas.</p>}
      </div>
      <button type="button" onClick={() => setHistory(null)} className="mt-4 rounded-lg border px-4 py-2">Fechar</button>
    </PortalDialog>}
  </>
}
