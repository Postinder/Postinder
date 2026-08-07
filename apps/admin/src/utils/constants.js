// ── Channel definitions ──
export const CHANNELS = {
  'Instagram/Facebook': {
    icon: 'instagram-facebook',
    formats: ['Card', 'Carrossel', 'Stories', 'Reels', 'Foto'],
    exclusive: false,
  },
  'LinkedIn': {
    icon: 'linkedin',
    formats: ['Post', 'Artigo', 'Card'],
    exclusive: false,
  },
  'TikTok': {
    icon: 'tiktok',
    formats: ['Vídeo', 'Stories'],
    exclusive: false,
  },
  'YouTube': {
    icon: 'youtube',
    formats: ['Vídeo', 'Shorts'],
    exclusive: false,
  },
  'Google Meu Negócio': {
    icon: 'google-business',
    formats: ['Post', 'Foto'],
    exclusive: false,
  },
  'WhatsApp': {
    icon: 'whatsapp',
    formats: ['Mensagem', 'Status'],
    exclusive: false,
  },
  'Site': {
    icon: 'site',
    formats: ['Banner', 'Blog', 'Popup'],
    exclusive: false,
  },
  'E-mail Marketing': {
    icon: 'email',
    formats: [],
    exclusive: false,
  },
}

// ── Funnel tags ──
export const FUNNEL_TAGS = [
  { value: 'topo',   label: 'Topo',   color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'meio',   label: 'Meio',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'fundo',  label: 'Fundo',  color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
]

// ── Tag categories by channel ──
export const TAG_CATEGORIES = {
  'social-media': {
    label: 'Social Media & Tráfego',
    channels: ['Instagram/Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Google Meu Negócio', 'WhatsApp'],
    subcategories: {
      'producao-conteudo': {
        label: 'Produção de conteúdo',
        tags: [
          'Não chama atenção', 'Texto muito longo', 'Visual poluído', 'Falta identidade visual',
          'Post sem impacto', 'Não ficou moderno', 'Conteúdo muito genérico', 'Não combina com a marca',
        ],
      },
      'funil-vendas': {
        label: 'Funil de vendas',
        tags: [
          'Não gera conversão', 'CTA fraco', 'Não incentiva ação', 'Objetivo não ficou claro',
          'Não transmite valor', 'Oferta pouco atrativa',
        ],
      },
      'trafego-pago': {
        label: 'Tráfego pago',
        tags: [
          'Criativo fraco', 'Imagem pouco chamativa', 'Headline fraca', 'Texto muito grande para anúncio',
          'Não parece anúncio profissional', 'Não gera clique',
        ],
      },
      'sac-redes': {
        label: 'SAC nas redes',
        tags: [
          'Resposta muito fria', 'Linguagem inadequada', 'Atendimento pouco humanizado',
          'Demora na resposta', 'Comunicação confusa',
        ],
      },
      'influenciadores': {
        label: 'Influenciadores',
        tags: [
          'Influenciador não combina com a marca', 'Público incompatível', 'Linguagem desalinhada',
          'Conteúdo artificial', 'Divulgação pouco natural',
        ],
      },
    },
  },
  'design': {
    label: 'Design Gráfico',
    channels: ['Instagram/Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Google Meu Negócio', 'Site', 'E-mail Marketing'],
    subcategories: {
      'identidade-visual': {
        label: 'Identidade visual',
        tags: [
          'Não representa a marca', 'Visual genérico', 'Cores não agradaram', 'Logo pouco profissional',
          'Identidade inconsistente', 'Visual ultrapassado',
          'Cor', 'Luz', 'Qualidade', 'Composição',
        ],
      },
      'templates-sociais': {
        label: 'Templates sociais',
        tags: [
          'Muito texto', 'Layout poluído', 'Falta destaque', 'Elementos desalinhados',
          'Design repetitivo', 'Visual pouco moderno',
        ],
      },
      'criativos-anuncios': {
        label: 'Criativos para anúncios',
        tags: [
          'Não gera impacto', 'Criativo pouco atrativo', 'Oferta não ficou clara', 'CTA fraco',
          'Visual sem destaque', 'Não prende atenção',
        ],
      },
      'impressos': {
        label: 'Impressos',
        tags: [
          'Arquivo fora do padrão', 'Texto ilegível', 'Baixa qualidade para impressão',
          'Informações mal distribuídas', 'Layout pouco profissional', 'Margens incorretas',
        ],
      },
    },
  },
  'assessoria': {
    label: 'Assessoria de Imprensa',
    channels: ['3A3R'],
    subcategories: {
      'comunicacao': {
        label: 'Comunicação',
        tags: [
          'Linguagem muito comercial', 'Não parece notícia', 'Texto pouco jornalístico',
          'Falta credibilidade', 'Informação incompleta', 'Título fraco',
          'Não gera interesse da imprensa', 'Texto muito promocional',
        ],
      },
      'relacionamento-imprensa': {
        label: 'Relacionamento com imprensa',
        tags: [
          'Release muito longo', 'Falta informação relevante', 'Não ficou objetivo',
          'Dados insuficientes', 'Falta posicionamento da empresa', 'Não transmite autoridade',
        ],
      },
      'cobertura-eventos': {
        label: 'Cobertura de eventos',
        tags: [
          'Fotos não representam o evento', 'Faltaram momentos importantes', 'Cobertura incompleta',
          'Baixa qualidade das imagens', 'Vídeo sem dinamismo', 'Não mostrou o público',
        ],
      },
      'gerenciamento-imagem': {
        label: 'Gerenciamento de imagem',
        tags: [
          'Comunicação sensível', 'Pode gerar interpretação negativa', 'Não transmite confiança',
          'Posicionamento inadequado', 'Linguagem arriscada',
        ],
      },
    },
  },
  'marketing': {
    label: 'Marketing Digital & Sites',
    channels: ['Site', 'E-mail Marketing', 'WhatsApp'],
    subcategories: {
      'sites-landing': {
        label: 'Sites e landing pages',
        tags: [
          'Site confuso', 'Visual pouco profissional', 'Navegação ruim', 'Informações difíceis de encontrar',
          'Página muito lenta', 'Não transmite confiança', 'Formulário ruim', 'CTA pouco visível',
        ],
      },
      'email-marketing': {
        label: 'E-mail marketing',
        tags: [
          'Assunto pouco atrativo', 'Texto muito longo', 'Layout ruim no celular',
          'E-mail parece spam', 'CTA fraco', 'Comunicação genérica',
        ],
      },
      'whatsapp-marketing': {
        label: 'WhatsApp Marketing',
        tags: [
          'Mensagem invasiva', 'Texto muito grande', 'Comunicação informal demais',
          'Divulgação excessiva', 'Pouco objetiva',
        ],
      },
    },
  },
  'seo': {
    label: 'SEO & Conteúdo',
    channels: ['Google Meu Negócio', 'Site'],
    subcategories: {
      'seo-otimizacao': {
        label: 'SEO',
        tags: [
          'Texto pouco otimizado', 'Palavra-chave ausente', 'Estrutura ruim para SEO',
          'Título pouco atrativo', 'Conteúdo superficial', 'Texto cansativo',
        ],
      },
    },
  },
}

// ── Generic tags (always available) ──
export const GENERIC_TAGS = ['Texto errado', 'Produto errado', 'Outro']

// ── Helper: Get tags for a set of channels ──
export function getTagsForChannels(channels = []) {
  if (!channels || channels.length === 0) return GENERIC_TAGS

  const tagsSet = new Set(GENERIC_TAGS)
  Object.values(TAG_CATEGORIES).forEach(category => {
    const matches = category.channels.filter(ch => channels.includes(ch))
    if (matches.length > 0) {
      Object.values(category.subcategories).forEach(subcat => {
        subcat.tags.forEach(tag => tagsSet.add(tag))
      })
    }
  })
  return Array.from(tagsSet).sort()
}

// ── Backward compatibility ──
export const REJECTION_TAGS = getTagsForChannels()

// ── Permission screens ──
export const PERMISSION_SCREENS = [
  { id: 'dashboard',     label: 'Dashboard',          icon: '⊞' },
  { id: 'clients',       label: 'Clientes',           icon: '👥' },
  { id: 'posts/new',     label: 'Nova Postagem',      icon: '↑' },
  { id: 'posts',         label: 'Postagens',           icon: '▦' },
  { id: 'approvals',     label: 'Aprovações',         icon: '◎' },
  { id: 'feed',          label: 'Prévia do Feed',     icon: '⊟' },
  { id: 'insights',      label: 'Insights & Feedbacks', icon: '📊' },
  { id: 'email',         label: 'E-mail',             icon: '✉' },
]

// ── Role permissions defaults ──
export const ROLE_PERMISSIONS = {
  admin:  PERMISSION_SCREENS.map(s => s.id).concat(['users']),
  manager: PERMISSION_SCREENS.map(s => s.id),
  editor: ['dashboard', 'posts', 'posts/new', 'approvals', 'feed'],
  viewer: ['dashboard', 'feed', 'insights'],
  gestor: PERMISSION_SCREENS.map(s => s.id),
  equipe: ['dashboard', 'approvals'],
}

// ── Client avatar colors ──
export const CLIENT_COLORS = [
  '#A7014B', '#3087A6', '#E65A00', '#6B21A8',
  '#0F766E', '#B45309', '#1D4ED8', '#7C3AED',
]

// ── Business segments with automatic colors ──
export const SEGMENTS = [
  { label: 'Restaurante & Alimentação', color: '#E65A00' },
  { label: 'Moda & Vestuário',          color: '#A7014B' },
  { label: 'Saúde & Bem-estar',         color: '#0F766E' },
  { label: 'Tecnologia',                color: '#1D4ED8' },
  { label: 'Educação',                  color: '#7C3AED' },
  { label: 'Beleza & Estética',         color: '#B45309' },
  { label: 'Imobiliária',               color: '#3087A6' },
  { label: 'Advocacia & Jurídico',      color: '#6B21A8' },
  { label: 'Contabilidade & Finanças',  color: '#0F766E' },
  { label: 'Varejo & Comércio',         color: '#E65A00' },
  { label: 'Indústria',                 color: '#1D4ED8' },
  { label: 'Agência de Comunicação',    color: '#A7014B' },
  { label: 'Clínica & Consultório',     color: '#0F766E' },
  { label: 'Academia & Esportes',       color: '#B45309' },
  { label: 'Turismo & Hotelaria',       color: '#3087A6' },
  { label: 'Outro',                     color: '#6B21A8' },
]

export function getSegmentColor(segment) {
  const found = SEGMENTS.find(s => s.label === segment)
  return found ? found.color : CLIENT_COLORS[0]
}

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
