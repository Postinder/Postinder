# Deploy, Banco e Ambientes

## Topologia de referencia

- **Vercel:** frontend React/Vite em `apps/admin`.
- **Render:** API Express/TypeScript em `backend`.
- **Supabase:** PostgreSQL e Storage.
- **Docker Compose:** PostgreSQL local na porta `5433`.

O estado efetivamente publicado deve ser confirmado no painel de cada provedor. Este guia descreve o procedimento oficial, nao uma garantia de que uma configuracao remota ja foi aplicada.

## Estado atual da publicacao

- Backend e frontend das correcoes anteriores foram publicados em 30/07/2026.
- A hotfix de CPF/CNPJ e `deadline_days` foi commitada, enviada ao Git e publicada em backend e frontend em 31/07/2026.
- A migration `016_client_documents.sql` foi aplicada com sucesso. O banco publicado esta em `016`; `017_platform_branding.sql`, `018_client_portal_preferences_and_recoverable_links.sql` e `019_platform_settings.sql` existem somente no codigo local e devem ser aplicadas, nessa ordem, antes de um futuro deploy.
- `/health`, `/health/db` e `/health/storage` responderam com sucesso depois da publicacao.
- Criacao com CPF, criacao e edicao com CNPJ, remocao do documento, Cliente antigo sem documento e prazo diferente de 7 dias foram validados.
- O ambiente permanece em modo demo para avaliacao da 20Cinco em `https://portal-20cinco.vercel.app`.
- O script de lint do frontend nao e executavel no estado atual porque ESLint e sua configuracao nao estao instalados. Nao ha workflow de CI no repositorio, e as configuracoes versionadas da Vercel e os comandos documentados do Render nao invocam lint; a pendencia nao bloqueia esta publicacao, mas nao deve ser descrita como validacao aprovada. A verificacao administrativa da Vercel deve confirmar que nao existe override remoto.

## Banco e migrations

`database/migrations` e a unica fonte de verdade estrutural. Para criar ou atualizar um banco:

```bash
cd backend
npm run db:migrate
```

O migrador registra cada migration em `schema_migrations`. A migration `002_development_seed.sql` e historica e nao deve ser executada como parte da cadeia estrutural. O startup valida migrations pendentes e nao corrige schema automaticamente.

O banco publicado usa PostgreSQL da Supabase e esta em `016`. A migration `002_development_seed.sql` permanece historica; `001` e `003` a `016` estao registrados. A `016`, aplicada em 31/07/2026, adiciona campos anulaveis de documento do Cliente e nao faz backfill. `017_platform_branding.sql`, `018_client_portal_preferences_and_recoverable_links.sql` e `019_platform_settings.sql` existem somente no codigo/local e devem ser as proximas migrations estruturais aplicadas no pre-deploy da futura publicacao.

A `019` cria o singleton operacional e o override anulavel do portal, sem backfill. Antes do deploy, valide a cadeia ate `019` e a segunda execucao/no-op em PostgreSQL local descartavel. Essa validacao nao foi concluida nesta rodada porque o Docker local estava inativo e a instalacao `psql` nao incluia servidor inicializavel; nao substitua esse gate por teste em producao.

Depois do startup, o backend executa a limpeza de retencao e agenda novas varreduras a cada hora. Aplique a `019` antes de iniciar a nova versao e confirme Storage/DB nos health checks; nao e necessario Render Cron Job.

A `018` e aditiva: inclui a preferencia booleana do portal com default simplificado, ciphertext anulavel para recuperacao administrativa e indice parcial. Ela nao invalida links existentes nem exige nova variavel de ambiente; a cifra deriva de forma separada do `JWT_SECRET` backend ja obrigatorio. Em caso de rollback de aplicacao, mantenha o backend anterior ate decidir a estrategia de schema — nao remova colunas nem reescreva tokens.

O migrador oficial e `backend/scripts/migrate.ts`. Na publicacao da hotfix, ele consultou `schema_migrations`, ignorou as migrations ja registradas e aplicou `016_client_documents.sql`. Em relacao ao repositorio atual, `017`, `018` e `019` permanecem deliberadamente pendentes. A cadeia ate `018` foi validada anteriormente em PostgreSQL 18.4 local vazio; a validacao de `019` permanece gate de pre-deploy.

No Render, configure um Pre-Deploy Command/release step separado e bloqueante:

```text
npm run db:migrate
```

Ele deve terminar com sucesso antes do Start Command. Nao incorpore migrations ao Start Command e nao permita que o backend novo inicie se a etapa falhar. O artefato do servico precisa conter `../database/migrations`.

## Backup, preflight e recuperacao

- Criar um novo backup logico imediatamente antes do deploy; o backup auditado pode ficar desatualizado durante os proximos testes.
- Validar hashes e preservar juntos `roles.sql`, `schema.sql` e `data.sql`, fora do repositorio.
- Executar novo inventario/preflight somente leitura antes de qualquer migration futura.
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

Runtime: Node.js 24.x, conforme `engines` do `backend/package.json`; a versao validada localmente e 24.16.0 com npm 11.13.0. O Sharp 0.35.0 fornece binarios pre-compilados compativeis para Linux nesse runtime; o build nao deve compilar libvips manualmente. Como o painel nao foi alterado nesta microcorrecao, conferir e, se necessario, definir `NODE_VERSION=24.16.0` no Render e um major Node 24 no Vercel e gate manual obrigatorio.

```text
Build Command: npm ci --include=dev && npm run build
Pre-Deploy Command: npm run db:migrate
Start Command: npm run start
```

A verificacao manual do servico confirmou categorias de URL/CORS, banco, JWT,
Supabase/Storage e `NODE_ENV`; nenhum `VITE_*`, credencial de Anthropic, Z-API,
Twilio, GoHighLevel, Canva ou Resend, nem Environment Group foi evidenciado.
O backend da hotfix foi publicado em 31/07/2026, depois da aplicacao da `016`.
Os tres endpoints de health responderam com sucesso.

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
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Depois de alterar `VITE_API_URL`, faca redeploy. Confirme tambem que `APP_PUBLIC_URL` e `CORS_ORIGINS` permitem o dominio publicado do frontend e que links `/portal/:token` apontam para ele.

A verificacao administrativa da Vercel continua pendente. Antes do deploy,
inventarie manualmente os nomes e escopos das variaveis em Production, Preview,
Development e ambientes customizados, o commit ativo, deployments anteriores e
previews acessiveis. Nao abra valores. Se for confirmada configuracao historica
de segredo `VITE_*`, autorize uma microetapa separada de rotacao ou invalidacao.

Os lockfiles v3 da raiz, `backend` e `apps/admin` devem acompanhar toda mudanca deliberada de dependencias. Sharp e Multer permanecem declarados por faixa compativel, coerente com as demais dependencias; `npm ci` usa as versoes exatas 0.35.0 e 2.2.0 registradas no lockfile. `backend/.npmrc` e `apps/admin/.npmrc` aplicam `engine-strict=true` mesmo quando cada plataforma usa o subdiretorio como raiz. Nao substituir `npm ci` por `npm install` no Render/Vercel.

## Publicacao da hotfix concluida

Em 31/07/2026, a hotfix foi commitada e enviada ao Git; a `016` foi aplicada,
backend e frontend foram publicados e os tres health checks foram aprovados.
Os smoke tests especificos de documento e prazo tambem foram concluidos. O
ambiente demo esta preparado para avaliacao da 20Cinco.

## Smoke tests e logs

- Validar `/health`, `/health/db` e `/health/storage`.
- Exercitar login, regras por perfil, criacao, envio, portal por token, portal
  autenticado, decisao do Cliente, correcao, execucao, upload e duplicacao.
- Confirmar que JWT de Cliente nao alcanca rotas administrativas.
- Confirmar que URLs de portal aparecem nos logs com token redigido e que
  respostas/erros nao refletem credenciais.
- Validar upload e reproducao de MP4 H.264/AAC, progresso, rejeicao acima de
  200 MB, swipe horizontal em imagens e videos, rolagem vertical, fullscreen e
  controles nativos que nao disparam aprovacao ou ajuste.
- Validar os paineis recolhiveis do Dashboard e a Visao geral do portal,
  inclusive preservacao de filtros e conteudos ao recolher e reabrir.
- Conferir a identidade da 20Cinco, contraste e foco nos temas claro e escuro,
  sem alterar as cores semanticas.
- Criar e editar Cliente com e sem CPF/CNPJ, remover o documento e confirmar
  prazo de aprovacao diferente de 7 dias.
- Executar limpeza de Retencao e reset demo somente com dados descartaveis.

## Rollback operacional

Para o primeiro rollout do branding: (1) criar backup e executar preflight; (2) aplicar a migration aditiva `017`; (3) publicar o backend; (4) concluir smoke tests; (5) publicar o frontend. Em rollback, retornar primeiro o frontend, depois o backend; a migration `017` permanece, pois e aditiva. Frontend novo tolera backend antigo derivando `logo_configured` de `logo_url`, e backend novo preserva o contrato consumido pelo frontend anterior.

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
