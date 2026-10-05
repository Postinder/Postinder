import { AppException } from '../../../shared/exceptions/AppException'

export async function lockClientReviewFlow(client: any, clientId: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`portal-review:${clientId}`])
}

export async function reviewSequence(client: any, postId: string) {
  const result = await client.query('SELECT revision FROM portal_post_reviews WHERE post_id = $1', [postId])
  return Number(result.rows[0]?.revision || 0)
}

export async function assertReviewRound(client: any, postId: string, expected: number) {
  if (!Number.isInteger(expected) || expected < 0 || await reviewSequence(client, postId) !== expected) {
    throw new AppException('A análise mudou. Recarregue a página antes de continuar.', 409, 'REVIEW_CONFLICT')
  }
}

export function normalizePositiveFeedback(value: unknown, decision: string, reaction: unknown) {
  if (value != null && typeof value !== 'string') throw new AppException('Feedback positivo inválido', 400)
  const feedback = typeof value === 'string' ? value.trim() || null : null
  if (feedback && (Array.from(feedback).length > 5000 || decision !== 'approved' || reaction !== 'loved')) {
    throw new AppException('Feedback positivo exige Adorei e até 5.000 caracteres', 400)
  }
  return feedback
}
