# Deploy, Banco e Ambientes

## Topologia de referencia

- **Vercel:** frontend React/Vite em `apps/admin`.
- **Render:** API Express/TypeScript em `backend`.
- **Supabase:** PostgreSQL e Storage.
- **Docker Compose:** PostgreSQL local na porta `5433`.

O estado efetivamente publicado deve ser confirmado no painel de cada provedor. Este guia descreve o procedimento oficial, nao uma garantia de que uma configuracao remota ja foi aplicada.

## Estado atual da publicacao

- O deploy esta **nao autorizado**.
- Frontend e backend ativos ainda correspondem a versoes anteriores as correcoes pre-deploy.
- O backend ativo observado no Render correspondia ao commit abreviado `3552b8e` (`Correcao swipe`); isso nao prova a inexistencia de deployments intermediarios.
- O bundle frontend ativo contem a arquitetura antiga de integracoes e nomes legados `VITE_*`, sem credencial funcional evidenciada. A exposicao historica permanece inconclusiva.
- As correcoes atuais existem somente no repositorio local. A versao publicada nao deve receber dados reais sensiveis nem novas credenciais frontend.

## Banco e migrations

`database/migrations` e a unica fonte de verdade estrutural. Para criar ou atualizar um banco:

```bash
cd backend
npm run db:migrate
```

O migrador registra cada migration em `schema_migrations`. A migration `002_development_seed.sql` e historica e nao deve ser executada como parte da cadeia estrutural. O startup valida migrations pendentes e nao corrige schema automaticamente.

O banco publicado usa PostgreSQL da Supabase. O inventario confirmou `001`, a `002` historica e `003` a `011`; `012`, `013`, `014` e `015` ainda nao foram aplicadas. No snapshot auditado havia 1 Cliente ativo, nenhum inativo, 0 posts e 0 files, sem orfaos, duplicidades incompatíveis ou FKs invalidas. A `012` atingiria zero linhas naquele snapshot, mas esse impacto deve ser reconfirmado imediatamente antes da execucao real.

O migrador oficial e `backend/scripts/migrate.ts`. Em um clone restaurado, `npm run db:migrate` executado em `backend` aplicou `012` a `015` na ordem correta; uma segunda execucao foi no-op, e o advisory lock foi adquirido e liberado.

No Render, configure um Pre-Deploy Command/release step separado e bloqueante:

```text
npm run db:migrate
```

Ele deve terminar com sucesso antes do Start Command. Nao incorpore migrations ao Start Command e nao permita que o backend novo inicie se a etapa falhar. O artefato do servico precisa conter `../database/migrations`.

## Backup, preflight e recuperacao

- Criar um novo backup logico imediatamente antes do deploy; o backup auditado pode ficar desatualizado durante os proximos testes.
- Validar hashes e preservar juntos `roles.sql`, `schema.sql` e `data.sql`, fora do repositorio.
- Executar novo inventario/preflight somente leitura, incluindo contagens afetaveis pela `012`.
- O procedimento de restauracao validado usa stack Supabase local compativel e transacao unica.
- A copia preparada de `roles.sql` comenta somente a instrucao que altera `statement_timeout` de `supabase_admin`; `schema.sql` e `data.sql` permanecem identicos.
- O backup e restauravel com esse procedimento documentado de compatibilidade.
- Objetos fisicos do Supabase Storage nao integram o backup logico e exigem plano operacional separado.

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

`APP_MODE=demo` protege a seed explicita. Para o reset, `NODE_ENV` continua sendo apenas o modo tecnico, enquanto `DEPLOYMENT_MODE` define a finalidade da implantacao. A demo publicada deve configurar:

```text
DEPLOYMENT_MODE=demo
ENABLE_DEMO_RESET=true
```

Mesmo nessa configuracao, o reset exige admin autenticado com a capacidade propria. Em ausencia, valor invalido ou `DEPLOYMENT_MODE=production`, a rota nao e montada e o controller mantem uma segunda guarda antes de qualquer efeito lateral.

## Variaveis de ambiente

Backend, por nome: `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`,
`JWT_EXPIRY_MINUTES`, `JWT_REFRESH_EXPIRY_DAYS`, `APP_PUBLIC_URL`,
`CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_STORAGE_BUCKET`, `DEPLOYMENT_MODE` e `ENABLE_DEMO_RESET`.

Integracoes server-side, quando deliberadamente habilitadas: `ZAPI_INSTANCE`,
`ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` e
`ANTHROPIC_TIMEOUT_MS`.

Frontend — unicas variaveis permitidas:

- `VITE_API_URL`;
- `VITE_DEPLOYMENT_MODE`;
- `VITE_GA_MEASUREMENT_ID`.

Na demo publicada, configure `VITE_DEPLOYMENT_MODE=demo`. Esse valor e apenas
visual e nao habilita o reset do backend.

Nao versione segredos. Nenhuma chave, token, client secret ou credencial deve
usar prefixo `VITE_*`. Segredos pertencem somente ao backend ou ao ambiente
local protegido.

## Render

Diretorio raiz: `backend`.

```text
Build Command: npm install --include=dev && npm run build
Pre-Deploy Command: npm run db:migrate
Start Command: npm run start
```

A verificacao manual do servico confirmou categorias de URL/CORS, banco, JWT,
Supabase/Storage e `NODE_ENV`; nenhum `VITE_*`, credencial de Anthropic, Z-API,
Twilio, GoHighLevel, Canva ou Resend, nem Environment Group foi evidenciado.
O backend publicado ainda e anterior as correcoes. `DEPLOYMENT_MODE`,
`ENABLE_DEMO_RESET` e a credencial server-side da IA continuam ausentes.

Depois da etapa de migration e do startup, valide:

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

A verificacao administrativa da Vercel continua pendente. Antes do deploy,
inventarie manualmente os nomes e escopos das variaveis em Production, Preview,
Development e ambientes customizados, o commit ativo, deployments anteriores e
previews acessiveis. Nao abra valores. Se for confirmada configuracao historica
de segredo `VITE_*`, autorize uma microetapa separada de rotacao ou invalidacao.

## Ordem de publicacao

1. Concluir layout e validacao local.
2. Concluir a verificacao manual da Vercel e as decisoes de rotacao.
3. Criar novo backup e executar preflight do banco.
4. Configurar variaveis e o release step bloqueante no Render.
5. Publicar primeiro o backend.
6. Confirmar `012` a `015`, ausencia de pendencias, startup e health checks.
7. Publicar o frontend.
8. Confirmar commits e bundles ativos.
9. Executar smoke tests, conferir logs sanitizados e validar o reset demo.

## Smoke tests e logs

- Validar `/health`, `/health/db` e `/health/storage`.
- Exercitar login, regras por perfil, criacao, envio, portal por token, portal
  autenticado, decisao do Cliente, correcao, execucao, upload e duplicacao.
- Confirmar que JWT de Cliente nao alcanca rotas administrativas.
- Confirmar que URLs de portal aparecem nos logs com token redigido e que
  respostas/erros nao refletem credenciais.
- Validar upload e reproducao de MP4 H.264/AAC, progresso, rejeicao acima de
  200 MB e controles que nao disparam swipe.
- Executar limpeza de Retencao e reset demo somente com dados descartaveis.

## Rollback operacional

Nao existem down migrations. Se o release step falhar:

1. bloquear o startup do backend novo;
2. identificar a primeira migration que falhou e quais anteriores ja foram
   confirmadas;
3. nao editar `schema_migrations` nem reaplicar SQL manualmente;
4. manter a versao anterior do backend;
5. restaurar o backup somente em operacao separada e autorizada, usando o
   procedimento validado;
6. tratar objetos fisicos do Storage separadamente.

Consulte [deploy/CHECKLIST_DEPLOY_TESTE.md](deploy/CHECKLIST_DEPLOY_TESTE.md)
para a checklist completa, [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md)
para o modelo de arquivos e [../ROADMAP.md](../ROADMAP.md) para pendencias.
