import { z } from 'zod'
import { PoolClient } from 'pg'
import { pool } from '../../../../shared/database/pool'
import { AppException } from '../../../../shared/exceptions/AppException'
import { canonicalHash, materialFingerprint } from '../../domain/MaterialFingerprint'
import { soundtrackInputSchema } from '../../../soundtracks/application/dtos/SoundtrackDTO'

export const administrativeApprovalSchema = z.object({
  justification: z.string().trim().min(1).max(5000),
  expectedRevision: z.number().int().positive(),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.string().uuid(),
}).strict()

type Actor = { id: string; role: string; companyId?: string }
const conflict = (message: string) => new AppException(message, 409, 'ADMIN_APPROVAL_CONFLICT')

async function loadMaterial(client: PoolClient, postId: string, companyId?: string) {
  const result = await client.query(
    `SELECT p.*, c.is_active AS client_active FROM posts p JOIN clients c ON c.id = p.client_id
     WHERE p.id = $1 AND p.deleted_at IS NULL
       AND c.company_id IS NOT DISTINCT FROM p.company_id
       AND ($2::uuid IS NULL OR p.company_id = $2) FOR UPDATE OF p`, [postId, companyId || null])
  const post = result.rows[0]
  if (!post) throw new AppException('Postagem não encontrada', 404)
  const files = (await client.query('SELECT * FROM files WHERE post_id = $1 ORDER BY id FOR UPDATE', [postId])).rows
  const soundtrack = (await client.query('SELECT * FROM post_soundtracks WHERE post_id = $1 AND deleted_at IS NULL FOR UPDATE', [postId])).rows[0]
  const settings = (await client.query('SELECT * FROM platform_settings WHERE singleton_key = TRUE FOR SHARE')).rows[0]
  const fields = settings?.post_field_policies || { description: 'optional', scheduled_date: 'optional', funnel_tag: 'hidden' }
  const policy = {
    soundtrackEnabled: settings?.soundtrack_enabled === true,
    funnelVisible: fields.funnel_tag !== 'hidden' && settings?.post_field_client_visibility?.funnel_tag === true,
    requiredFields: Object.keys(fields).filter(key => fields[key] === 'required').sort(),
  }
  const rejection = (await client.query(
    `SELECT * FROM portal_review_decisions WHERE post_id = $1 ORDER BY review_sequence DESC LIMIT 1`, [postId])).rows[0]
  return { post, files, soundtrack, policy, rejection, fingerprint: materialFingerprint(post, files, soundtrack, policy) }
}

function assertEligible(material: Awaited<ReturnType<typeof loadMaterial>>) {
  const { post, files, soundtrack, policy, rejection } = material
  if (!post.client_active || post.status !== 'rejected' || !rejection
    || rejection.decision !== 'rejected' || rejection.client_id !== post.client_id
    || Number(rejection.content_revision) !== Number(post.content_revision)) {
    throw conflict('Somente uma rejeição oficial do ciclo atual pode ser aprovada manualmente.')
  }
  const safeUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
  if (!post.title?.trim() || !post.channels?.length || policy.requiredFields.some(key => !String(post[key] ?? '').trim())
    || (post.channels.includes('E-mail Marketing') && !safeUrl(post.email_link))
    || (!files.length && !(post.channels.length === 1 && post.channels[0] === 'E-mail Marketing' && safeUrl(post.email_link)))
    || files.some(file => !file.url || file.storage_deleted_at)) throw conflict('O conteúdo precisa estar completo para aprovação.')
  if (policy.soundtrackEnabled && soundtrack && soundtrack.mode !== 'none') {
    if (!soundtrackInputSchema.safeParse(soundtrack).success || soundtrack.storage_deleted_at
      || (soundtrack.mode === 'uploaded' && !soundtrack.audio_url)
      || (soundtrack.mode === 'embedded' && !files.some(file => file.id === soundtrack.source_media_id && String(file.file_type).toUpperCase() === 'VIDEO'))) {
      throw conflict('O fundo sonoro precisa estar válido para aprovação.')
    }
  }
}

export class AdministrativeApprovalService {
  async prepare(postId: string, companyId?: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const material = await loadMaterial(client, postId, companyId)
      assertEligible(material)
      await client.query('COMMIT')
      return { expectedRevision: Number(material.post.content_revision), expectedFingerprint: material.fingerprint, title: material.post.title, description: material.post.description }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async approve(postId: string, input: unknown, actor: Actor) {
    if (actor.role !== 'admin' || !actor.id) throw new AppException('Aprovação manual restrita a admin', 403)
    const parsed = administrativeApprovalSchema.safeParse(input)
    if (!parsed.success) throw new AppException('Justificativa, revisão, identidade do conteúdo e chave válidas são obrigatórias', 400)
    const payload = parsed.data
    const requestFingerprint = canonicalHash({ postId, actor, ...payload })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const material = await loadMaterial(client, postId, actor.companyId)
      const { post, soundtrack, policy, rejection } = material
      const previous = (await client.query(
        `SELECT * FROM portal_review_actions WHERE post_id = $1 AND action = 'admin_approved' AND idempotency_key = $2`,
        [postId, payload.idempotencyKey])).rows[0]
      if (previous) {
        if (previous.request_fingerprint !== requestFingerprint) throw conflict('Chave já utilizada com outra intenção de aprovação.')
        if (!post.client_active || !['approved', 'executed'].includes(post.status)
          || Number(post.approved_revision) !== Number(previous.content_revision)
          || Number(post.content_revision) !== Number(previous.content_revision)) throw conflict('A certificação desta requisição não está mais vigente.')
        await client.query('COMMIT')
        return { success: true, idempotent: true, approvalSource: 'admin', contentRevision: Number(previous.content_revision) }
      }
      assertEligible(material)
      if (Number(post.content_revision) !== payload.expectedRevision || material.fingerprint !== payload.expectedFingerprint) {
        throw conflict('O conteúdo mudou. Reabra a confirmação e confira a revisão atual.')
      }
      const revision = payload.expectedRevision + 1
      // Children are updated while the parent is still rejected; the final parent update freezes the whole revision.
      // Rejection reasons are historical evidence and remain untouched; current status alone becomes approved.
      await client.query("UPDATE files SET status = 'approved', updated_at = NOW() WHERE post_id = $1", [postId])
      await client.query('DELETE FROM portal_item_review_drafts WHERE post_id = $1', [postId])
      if (policy.soundtrackEnabled && soundtrack && soundtrack.mode !== 'none') {
        await client.query(
          `INSERT INTO post_soundtrack_decisions(soundtrack_id, post_id, revision_number, content_revision, decision, actor_id, actor_role)
           VALUES ($1, $2, $3, $4, 'approved', $5, 'admin')`,
          [soundtrack.id, postId, soundtrack.revision_number, revision, actor.id])
        await client.query(
          `UPDATE post_soundtracks SET approval_status = 'approved', approved_content_revision = $2,
             approved_at = NOW(), updated_at = NOW() WHERE id = $1`, [soundtrack.id, revision])
      }
      await client.query(
        `INSERT INTO portal_review_actions(post_id, content_revision, action, actor_id, actor_role, decision_id,
          justification, idempotency_key, request_fingerprint)
         VALUES ($1, $2, 'admin_approved', $3, 'admin', $4, $5, $6, $7)`,
        [postId, revision, actor.id, rejection.id, payload.justification, payload.idempotencyKey, requestFingerprint])
      const updated = await client.query(
        `UPDATE posts SET status = 'approved', content_revision = $2, approved_revision = $2, approved_at = NOW(),
          review_field_visibility = jsonb_set(review_field_visibility, '{funnel_tag}', to_jsonb($3::boolean)), updated_at = NOW()
         WHERE id = $1 AND EXISTS (SELECT 1 FROM clients c WHERE c.id = posts.client_id AND c.is_active = TRUE
           AND c.company_id IS NOT DISTINCT FROM posts.company_id) RETURNING id`, [postId, revision, policy.funnelVisible])
      if (!updated.rows[0]) throw conflict('Cliente indisponível para certificação.')
      await client.query('COMMIT')
      return { success: true, idempotent: false, approvalSource: 'admin', contentRevision: revision }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async history(postId: string, companyId?: string) {
    const client = await pool.connect()
    try {
      const scoped = await client.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR company_id = $2)', [postId, companyId || null])
      if (!scoped.rows[0]) throw new AppException('Postagem não encontrada', 404)
      const decisions = (await client.query(`SELECT id, content_revision, review_sequence, decision, actor_role,
        decided_at, positive_reaction, positive_feedback, item_snapshot FROM portal_review_decisions
        WHERE post_id = $1 ORDER BY review_sequence`, [postId])).rows
      const actions = (await client.query(`SELECT a.id, a.content_revision, a.action, a.actor_id, a.actor_role,
        a.created_at, a.decision_id, a.justification, u.name AS actor_name
        FROM portal_review_actions a LEFT JOIN users u ON u.id = a.actor_id WHERE a.post_id = $1
        ORDER BY a.created_at, a.id`, [postId])).rows
      const feedbacks = (await client.query('SELECT id, text, created_at FROM feedback WHERE post_id = $1 ORDER BY created_at, id', [postId])).rows
      return { decisions, actions, feedbacks }
    } finally { client.release() }
  }
}
