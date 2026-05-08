// ── Channel definitions ──
export const CHANNELS = {
  'Instagram/Facebook': {
    icon: '📷',
    formats: ['Feed', 'Stories', 'Reels', 'Carrossel', 'Foto'],
    exclusive: false,
  },
  'LinkedIn': {
    icon: '💼',
    formats: ['Post', 'Artigo', 'Card'],
    exclusive: false,
  },
  'TikTok': {
    icon: '🎵',
    formats: ['Vídeo', 'Stories'],
    exclusive: false,
  },
  'YouTube': {
    icon: '🎬',
    formats: ['Vídeo', 'Shorts'],
    exclusive: false,
  },
  'Google Meu Negócio': {
    icon: '📍',
    formats: ['Post', 'Foto'],
    exclusive: false,
  },
  'WhatsApp': {
    icon: '📱',
    formats: ['Mensagem', 'Status'],
    exclusive: false,
  },
  '3A3R': {
    icon: '🚀',
    formats: ['Post'],
    exclusive: false,
  },
  'Site': {
    icon: '🌐',
    formats: ['Banner', 'Blog', 'Popup'],
    exclusive: false,
  },
  'E-mail Marketing': {
    icon: '📧',
    formats: [],
    exclusive: true,
  },
}

// ── Funnel tags ──
export const FUNNEL_TAGS = [
  { value: 'topo',   label: 'Topo',   color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'meio',   label: 'Meio',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'fundo',  label: 'Fundo',  color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
]

// ── Feedback rejection tags ──
export const REJECTION_TAGS = [
  'Cor', 'Luz', 'Qualidade', 'Composição',
  'Texto errado', 'Produto errado', 'Outro',
]

// ── Permission screens ──
export const PERMISSION_SCREENS = [
  { id: 'dashboard',     label: 'Dashboard',          icon: '⊞' },
  { id: 'clients',       label: 'Clientes',           icon: '👥' },
  { id: 'posts/new',     label: 'Nova Postagem',      icon: '↑' },
  { id: 'approvals',     label: 'Aprovações',         icon: '◎' },
  { id: 'feed',          label: 'Prévia do Feed',     icon: '⊟' },
  { id: 'insights',      label: 'Insights & Feedbacks', icon: '📊' },
  { id: 'email',         label: 'E-mail',             icon: '✉' },
]

// ── Role permissions defaults ──
export const ROLE_PERMISSIONS = {
  admin:  PERMISSION_SCREENS.map(s => s.id).concat(['users']),
  gestor: PERMISSION_SCREENS.map(s => s.id),
  equipe: ['dashboard', 'approvals'],
}

// ── Client avatar colors ──
export const CLIENT_COLORS = [
  '#A7014B', '#3087A6', '#E65A00', '#6B21A8',
  '#0F766E', '#B45309', '#1D4ED8', '#7C3AED',
]

// ── Post status helpers ──
export function computePostStatus(files = []) {
  if (!files.length) return 'pending'
  if (files.every(f => f.status === 'APPROVED')) return 'approved'
  if (files.some(f => f.status === 'REJECTED'))  return 'rejected'
  if (files.some(f => f.status === 'UPDATED'))   return 'updated'
  return 'pending'
}

export function statusLabel(s) {
  return { pending:'Pendente', approved:'Aprovado', rejected:'Recusado', updated:'Atualizado', delivered:'Entregue' }[s] || s
}

export function clientInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function buildApprovalLink(slug) {
  const base = import.meta.env.VITE_APPROVAL_BASE_URL || window.location.origin
  return `${base}/c/${slug}`
}
