import { normalizeEmailPreviewUrl } from '../../utils/emailPreview.js'

export const CLIENT_VISIBLE_POST_STATUSES = new Set([
  'sent',
  'pending_approval',
  'rejected',
  'approved',
  'executed',
])

export function formatDate(value, fallback = 'Sem data') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function getPostDate(post) {
  return post?.scheduledDate || post?.scheduled_date || post?.submittedAt || post?.createdAt || post?.created_at
}

export function getPostStatus(post) {
  const status = String(post?.status || '').toLowerCase()
  if (status === 'approved') return 'approved'
  if (status === 'executed' || status === 'published' || status === 'done' || status === 'completed') return 'executed'
  if (status === 'rejected') return 'rejected'
  if (status === 'pending_approval') return 'pending_approval'
  if (status === 'sent') return 'sent'

  const files = post?.files || []
  if (files.length && files.every(file => String(file.status || '').toLowerCase() === 'approved')) return 'approved'
  if (files.some(file => String(file.status || '').toLowerCase() === 'rejected')) return 'rejected'
  return status || 'sent'
}

export function isPendingFile(file) {
  const status = String(file?.status || 'pending').toLowerCase()
  return ['pending', 'pending_approval', 'sent'].includes(status)
}

export function hasSafeEmailPreview(post) {
  return Boolean(normalizeEmailPreviewUrl(post?.emailLink || post?.email_link))
}

export function isPendingEmailPreviewPost(post) {
  return !(post?.files || []).length
    && hasSafeEmailPreview(post)
    && ['sent', 'pending_approval'].includes(String(post?.status || '').toLowerCase())
}

export function getPendingPortalProjects(posts = []) {
  return posts.filter(post => ['sent', 'pending_approval'].includes(String(post?.status || '').toLowerCase()))
}

export function isCorrectionPost(post) {
  return String(post?.status || '').toLowerCase() === 'pending_approval'
}

export function isClientVisiblePost(post) {
  return CLIENT_VISIBLE_POST_STATUSES.has(String(post?.status || '').toLowerCase())
}

export function getPortalStatusMeta(status) {
  const statuses = {
    approved: {
      label: 'Aprovado',
      className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
    },
    rejected: {
      label: 'Ajustes',
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    },
    executed: {
      label: 'Postado na rede',
      className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    },
    sent: {
      label: 'Pendente',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    },
    pending_approval: {
      label: 'Correção',
      className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    },
    pending: {
      label: 'Pendente',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    },
  }

  return statuses[status] || {
    label: 'Status indisponível',
    className: 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  }
}
