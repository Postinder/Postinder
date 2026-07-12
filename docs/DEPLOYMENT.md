# Deploy, Banco e Ambientes

## Topologia de referencia

- **Vercel:** frontend React/Vite em `apps/admin`.
- **Render:** API Express/TypeScript em `backend`.
- **Supabase:** PostgreSQL e Storage.
- **Docker Compose:** PostgreSQL local na porta `5433`.

O estado efetivamente publicado deve ser confirmado no painel de cada provedor. Este guia descreve o procedimento oficial, nao uma garantia de que uma configuracao remota ja foi aplicada.

## Banco e migrations

`database/migrations` e a unica fonte de verdade estrutural. Para criar ou atualizar um banco:

```bash
cd backend
npm run db:migrate
```

O migrador registra cada migration em `schema_migrations`. A migration `002_development_seed.sql` e historica e nao deve ser executada como parte da cadeia estrutural. O startup valida migrations pendentes e nao corrige schema automaticamente.

Antes do startup publicado, o deploy deve executar `npm run db:migrate`. A configuracao de uma etapa de release no Render ainda e pendencia operacional; enquanto ela nao existir, a aplicacao manual deve fazer parte do checklist do deploy.

## Dados demo e primeiro administrador

Para dados de demonstracao em ambiente controlado:

```powershell
$env:APP_MODE = 'demo'
cd backend
npm run db:seed-demo
```

Para criar o primeiro admin sem seed demo, defina `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, depois execute:

```bash
cd backend
npm run db:bootstrap-admin
```

Hoje `APP_MODE=demo` protege a seed explicita. A separacao global entre Modo demonstracao e Modo producao, incluindo reset e credenciais previsiveis, ainda nao esta implementada.

## Variaveis de ambiente

Backend:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=uma-chave-longa-e-secreta
APP_PUBLIC_URL=https://frontend.example.com
CORS_ORIGINS=https://frontend.example.com
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=postinder-uploads
```

Frontend:

```env
VITE_API_URL=https://api.example.com/api/v1
```

Nao versione segredos. A `SUPABASE_SERVICE_ROLE_KEY`, a `DATABASE_URL` e `JWT_SECRET` pertencem somente aos provedores ou ao ambiente local protegido.

## Render

Diretorio raiz: `backend`.

```text
Build Command: npm install --include=dev && npm run build
Start Command: npm run start
```

Antes do start, aplique migrations conforme a secao anterior. Valide:

```text
GET /health
GET /health/db
GET /health/storage
```

## Vercel

Diretorio raiz: `apps/admin`.

```text
Framework: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Depois de alterar `VITE_API_URL`, faca redeploy. Confirme tambem que `APP_PUBLIC_URL` e `CORS_ORIGINS` permitem o dominio publicado do frontend e que links `/portal/:token` apontam para ele.

## Checklist de publicacao

1. Executar builds de backend e frontend.
2. Aplicar `db:migrate` e conferir `schema_migrations`.
3. Validar variaveis, CORS e URLs do portal.
4. Validar `/health`, `/health/db` e `/health/storage`.
5. Executar smoke test de login, criacao, envio, portal, decisao, correcao, execucao, upload e duplicacao.
6. Executar a limpeza de Retencao somente com dados de teste quando for validar Storage.

Consulte [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md) para o modelo de arquivos e [../ROADMAP.md](../ROADMAP.md) para pendencias de scheduler, retries e bucket privado.
