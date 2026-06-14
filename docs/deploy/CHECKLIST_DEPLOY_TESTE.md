# Checklist de Deploy para Teste

## 1. Banco PostgreSQL online

Crie um banco PostgreSQL hospedado e copie a connection string.

No ambiente do backend, configure:

```env
DATABASE_URL=postgresql://...
NODE_ENV=production
JWT_SECRET=uma-chave-longa-e-segura
```

Antes de iniciar o backend em producao, aplique as migrations:

```bash
cd backend
npm install
npm run db:migrate
```

## 2. Backend

Variaveis recomendadas:

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

Em producao, configure Supabase Storage:

1. Crie um projeto no Supabase.
2. Abra Storage.
3. Crie um bucket chamado `postinder-uploads`.
4. Deixe o bucket publico para que os arquivos possam ser visualizados no frontend.
5. Copie a URL do projeto e a service role key para o backend.

```env
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=postinder-uploads
```

Sem essas variaveis, uploads em producao retornam erro porque o backend tenta usar storage online.

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
- Gerar link do portal na tela de detalhes do cliente.
- Abrir `/portal/:token` em janela anonima e conferir se o portal carrega sem login.
- Criar post com arquivo.
- Reordenar arquivos/anexos e salvar.
- Editar post recusado, remover arquivo antigo, adicionar novo arquivo e reenviar para aprovacao.
- Conferir post na previa do feed.
- Aprovar/reprovar como cliente pelo swipe e pelos botoes.
- Confirmar que o cliente nao consegue voltar depois que o projeto inteiro foi aprovado.
- Conferir aba de recusados no portal e edicao de feedback antes do reenvio.
- Ver notificacoes lidas/nao lidas.
- Conferir aba de postagens com projetos em andamento e concluidos.
- Testar usuario Viewer e confirmar que ele nao consegue criar/editar/excluir.
- Conferir insights de aprovacao inicial, recusa inicial, revisao e metricas por item.
- Conferir detalhes do cliente, incluindo ultimo acesso apos abrir o portal.
- Conferir `/health/db`.
- Conferir `/health/storage`.
