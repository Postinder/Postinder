# Postinder v2.0 — React + Supabase

Plataforma de Aprovação de Conteúdo — 20Cinco Comunicação

## Setup em 5 passos

### 1. Configure o Supabase
1. Acesse https://supabase.com e crie um projeto gratuito
2. Vá em **SQL Editor** → cole o conteúdo de `supabase-schema.sql` e execute
3. Vá em **Storage** → New Bucket → nome: `post-files` → marque **Public**
4. Vá em **Settings → API** e copie a URL e a chave `anon/public`

### 2. Configure o .env
```bash
cp .env .env.local
```
Edite `.env.local`:
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...sua_chave_aqui
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Crie o primeiro usuário admin
No Supabase Dashboard → Authentication → Users → Add user.
Depois no SQL Editor:
```sql
insert into users (id, name, email, role)
values ('ID_DO_USUARIO', 'Caroline Paiva', 'admin@20cin.co', 'admin');
```

### 5. Rode o projeto
```bash
npm run dev
```
Acesse: http://localhost:5173

## Tema Dark/Light
Botão de alternância no topbar e no header do cliente.
Respeita preferência do sistema operacional automaticamente.

## Deploy (Vercel)
```bash
npm install -g vercel
vercel
```
Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no dashboard do Vercel.

## Estrutura
```
src/
├── features/      # Um módulo por funcionalidade de negócio
├── components/    # UI compartilhada (Button, Card, Modal, Input, Badge, ThemeToggle)
├── hooks/         # usePosts, useSwipe
├── services/      # supabase, auth, posts, clients, approvals, insights
├── store/         # authStore, themeStore, postsStore (Zustand)
├── utils/         # constants, helpers
└── styles/        # globals.css com variáveis CSS dark/light
```

## Custo estimado
| Serviço | Custo |
|---------|-------|
| Supabase Free | R$ 0 |
| Vercel Hobby | R$ 0 |
| **Total** | **R$ 0/mês** |
