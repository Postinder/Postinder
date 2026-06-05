# Checklist de Deploy para Teste

## 1. Banco PostgreSQL online

Crie um banco PostgreSQL hospedado e copie a connection string.

No ambiente do backend, configure:

```env
DATABASE_URL=postgresql://...
NODE_ENV=production
JWT_SECRET=uma-chave-longa-e-segura
```

Antes de iniciar o backend em produção, aplique as migrations:

```bash
cd backend
npm install
npm run db:migrate
```

## 2. Backend

Variáveis recomendadas:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=uma-chave-longa-e-segura
APP_PUBLIC_URL=https://url-do-frontend
CORS_ORIGINS=https://url-do-frontend
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=postinder-uploads
ZAPI_INSTANCE=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
```

Comandos:

```bash
cd backend
npm install
npm run build
npm start
```

Valide:

```text
GET /health
GET /health/db
```

## 3. Uploads

Em produção, configure Supabase Storage:

1. Crie um projeto no Supabase.
2. Abra Storage.
3. Crie um bucket chamado `postinder-uploads`.
4. Deixe o bucket público para que os arquivos possam ser visualizados no frontend.
5. Copie a URL do projeto e a service role key para o backend.

```env
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=postinder-uploads
```

Sem essas variáveis, uploads em produção retornam erro porque o backend tenta usar storage online.

Valide depois do deploy:

```text
GET /health/storage
```

## 4. Frontend

No ambiente do frontend:

```env
VITE_API_URL=https://url-do-backend/api/v1
```

Comandos:

```bash
cd apps/admin
npm install
npm run build
```

## 5. Testes manuais essenciais

- Login admin.
- Criar cliente.
- Criar post com arquivo.
- Conferir post na prévia do feed.
- Aprovar/reprovar como cliente.
- Ver notificações lidas/não lidas.
- Testar usuário Viewer e confirmar que ele não consegue criar/editar/excluir.
- Exportar insights.
- Conferir `/health/db`.
- Conferir `/health/storage`.
