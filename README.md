# Postinder v2.0 - Monorepo

**Plataforma de Aprovação de Conteúdo** para agências de comunicação digital. Gerenciar, aprovar e otimizar conteúdo para múltiplos clientes e canais de forma eficiente.

## Estrutura do Monorepo

```
postinder/
├── apps/
│   ├── admin/               # Dashboard e painel administrativo (React + Vite)
│   └── ...                  # Outros apps no futuro
├── backend/                 # API e Supabase Edge Functions
├── packages/
│   ├── types/              # Tipos TypeScript compartilhados
│   ├── ui/                 # Componentes UI reutilizáveis
│   └── shared/             # Utilitários e funções compartilhadas
├── database/               # Migrações e schemas do banco
└── infrastructure/         # Terraform, Docker, scripts de deploy
```

## Setup Rápido

### Pré-requisitos
- Node.js 18+
- pnpm 9+

### Instalação

```bash
# Instalar dependências de todas as workspaces
pnpm install
```

### Desenvolvimento

```bash
# Inicia todos os workspaces em desenvolvimento
pnpm run dev
```

- **apps/admin**: http://localhost:5173

### Build & Deploy

```bash
pnpm run build      # Build de todos os workspaces
pnpm run lint       # Lint em todos os workspaces
```

## Configurando apps/admin

### 1. Supabase Setup
1. Acesse https://supabase.com
2. SQL Editor → cole `supabase-schema.sql` e execute
3. Storage → New Bucket → `post-files` (Public)
4. Settings → API → copie URL e anon key

### 2. Variáveis de Ambiente

Copie `apps/admin/.env.example` → `apps/admin/.env.local`:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publica
```

### 3. Primeiro Usuário Admin

```sql
-- Supabase SQL Editor
insert into users (id, name, email, role)
values ('uuid-do-usuario-auth', 'Seu Nome', 'admin@example.com', 'admin');
```

## Integrações (Opcionais)

A Postinder suporta:

| Integração | Tipo |
|-----------|------|
| **Claude AI** | Análise de métricas com IA |
| **WhatsApp** | Z-API ou Twilio |
| **GoHighLevel** | Sync de CRM |
| **Canva** | Importar designs |
| **Resend** | E-mails transacionais |
| **Google Analytics** | Rastreamento |

Todas opcionais e não quebram o sistema se desabilitadas.

## Estrutura de apps/admin

```
apps/admin/src/
├── components/         # UI compartilhada
│   ├── ui/            # Button, Card, Input, Modal, Badge, ThemeToggle
│   ├── layout/        # AdminLayout, ClientLayout
│   └── ai/            # AIInsightsPanel
├── features/          # Funcionalidades/páginas
├── services/          # API calls e lógica
│   └── integrations/  # AI, WhatsApp, GHL, Canva, Resend
├── store/             # Zustand: auth, posts, theme
├── hooks/             # usePosts, useSwipe
├── styles/            # CSS global com tema dark/light
├── utils/             # constants, helpers
└── App.jsx            # Root com rotas
```

## Desenvolvimento

### Hot Reload
Editar qualquer arquivo em `src/` atualiza o navegador automaticamente.

### Proxy API
Vite roteia `/api/*` → `http://localhost:3001` (útil para backend local).

### Dark/Light Theme
Toggle automático no layout, respeita preferência do SO.

## Tema Dark/Light

A aplicação oferece alternância automática de tema. Uso:

```jsx
import { useThemeStore } from './store/themeStore'

export function MyComponent() {
  const { isDark, toggle } = useThemeStore()
  return <button onClick={toggle}>Toggle ({isDark ? '🌙' : '☀️'})</button>
}
```

## Deploy

### Vercel (Recomendado)

```bash
npm install -g vercel
vercel
```

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no dashboard.

### Outros (Docker, Self-hosted)
Documentação será adicionada conforme necessário.

## Custo Estimado

| Serviço | Custo |
|---------|-------|
| Supabase Free | R$ 0 |
| Vercel Hobby | R$ 0 |
| **Total** | **R$ 0/mês** |

## Troubleshooting

### Porta em uso?
```bash
PORT=3000 pnpm run dev
```

### Erro de autenticação Supabase?
- Verifique `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Confirme projeto ativo no Supabase
- Cheque permissões RLS

### Limpar cache
```bash
rm -rf node_modules .pnpm-store && pnpm install
```

## Contribuindo

1. Branch a partir de `main`
2. Implemente feature
3. `pnpm run lint`
4. Abra PR

---

**Desenvolvido com: React 18 + Vite + Supabase + Zustand + Tailwind**
