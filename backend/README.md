# Backend do Postinder

## Configuracoes da plataforma

`GET /api/v1/platform-settings` le a configuracao global; `PATCH /api/v1/platform-settings` aceita somente chaves conhecidas e atualizacoes parciais. A mutacao exige admin com `platform-settings:update`. Ausencia de linha retorna defaults de dominio; a primeira alteracao cria o singleton.

O schema inclui `retention.executed_attachment_hours` (1 a 8760), `features.soundtrack`, politicas `hidden|optional|required` para quatro campos de Cliente e tres de postagem, `post_field_client_visibility.funnel_tag` (default `false`), os tres booleans do portal e `portal.approval_mode` (`content|item`, default `content`). Branding nao faz parte do contrato. Funil permanece configuravel; sua politica interna e sua exposicao ao Cliente sao independentes.

`StorageRetentionScheduler` inicia uma varredura nao bloqueante junto ao servidor e repete a cada hora com timer `unref`. O cleanup limita o lote total a 50, exige `status='executed'`, `executed_at` e prazo vencido/coerente, usa locks por objeto e marca `storage_deleted_at` somente apos remocao confirmada. Falhas persistem mensagem sanitizada e permanecem elegiveis para retry.

API Express/TypeScript do Postinder. Ela atende autenticacao, usuarios, Clientes, postagens, aprovacoes, portal, arquivos, fundos sonoros, feedbacks, atividades, notificacoes e manutencao de demonstracao.

O runtime do backend requer Node.js 24.x; `.node-version` fixa 24.16.0 para desenvolvimento e validacao e o npm esperado e 11.13.0. Essa faixa e compativel com os binarios pre-compilados do Sharp 0.35.0 usados exclusivamente para decodificar e validar logos PNG, JPEG e WebP. O `package-lock.json` v3 e a fonte da resolucao exata, e `backend/.npmrc` aplica `engine-strict=true` quando este diretorio e usado como raiz no Render.

## Desenvolvimento

```bash
npm ci
copy .env.example .env
npm run db:migrate
npm run dev
```

No macOS/Linux, substitua `copy` por `cp`. O banco local padrao e configurado pelo `docker-compose.yml` da raiz.

## Scripts

```bash
npm run db:migrate
npm run db:seed-demo
npm run db:bootstrap-admin
npm run storage:cleanup-retention
npm test
npm run test:integration:soundtracks
npm run test:integration:portal-approval
npm run test:integration:post-revision
npm run build
npm run start
```

Migrations sao a unica fonte de verdade do schema. O startup valida compatibilidade e nao executa DDL corretivo.

Em deploy, `npm run db:migrate` deve executar como Pre-Deploy Command/release
step bloqueante antes de `npm run start`. Falha de migration impede a
inicializacao do backend novo.

## API e regras principais

Base local: `http://localhost:3001/api/v1`.

- Access tokens administrativos exigem contexto `type: "admin"`; tokens de
  Cliente usam `type: "client"` somente nos fluxos proprios. Refresh tokens,
  tokens ambiguos e tokens privados de portal nao sao access tokens
  administrativos.
- Todas as rotas administrativas passam pela cadeia central de autenticacao,
  contexto administrativo e capacidade. Existem 37 capacidades declaradas em
  48 rotas, com negacao por padrao.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`; `viewer` e
  estritamente somente leitura.
- Aprovacao e reprovacao pertencem ao portal do Cliente.
- `content` conclui uma decisao para a postagem inteira. `item` grava escolhas provisórias em `portal_item_review_drafts`; `POST .../complete-review` consolida o snapshot somente quando todas as midias estao resolvidas. Drafts nao alteram estado canonico, feedback, atividade, notificacao ou metricas.
- Autosave e conclusao bloqueiam a postagem/arquivos dentro de transacoes. Retry ou conclusao concorrente depois do primeiro commit recebe resposta idempotente com `already_completed`, sem duplicar revisao ou feedback.
- Submissoes oficiais incrementam `content_revision`; aprovacao e execucao selam `approved_revision` e `executed_revision`. Operacoes de review recebem `expectedRevision` e recusam estado stale. A execucao exige selo corrente, decisao oficial do Cliente, tenant coerente e Cliente ativo.
- Postagens protegidas, seus arquivos e soundtrack nao aceitam alteracao material silenciosa. A agencia deve reabrir antes de editar; posts `approved` legados sem selo precisam cumprir `reopen -> submit -> aprovacao oficial -> execucao`.
- `portal_review_decisions` e `portal_review_actions` sao fatos append-only. Drafts anteriores a `021` sem revisao confiavel sao descartados, e historico legado nao e promovido artificialmente a decisao oficial.
- `POST .../posts/:postId/reopen` implementa rewind por postagem: somente a conclusao elegivel mais recente do Cliente pode ser reaberta uma vez por ciclo. Navegacao entre midias nao chama rewind e nao altera estado oficial.
- `PATCH /posts/:id/status` aceita apenas `draft <-> ready`.
- Postagens `executed` sao imutaveis; duplicacao cria uma nova postagem.
- O reset so e montado com `DEPLOYMENT_MODE=demo` e
  `ENABLE_DEMO_RESET=true`, e ainda exige admin com a capacidade exclusiva.
- URLs privadas, query strings sensiveis, objetos e erros passam por
  sanitizacao; tokens privados nao sao persistidos em eventos de atividade.
- `POST /api/v1/integrations/ai-insights` executa Anthropic somente no backend,
  com a capacidade `ai-insights:generate`, hoje exclusiva de `admin`. Ausencia
  de configuracao mantem apenas a IA indisponivel.
- Upload aceita no maximo 200 MB por arquivo. Excesso retorna `413/FILE_TOO_LARGE` e tipo nao suportado retorna `415/UNSUPPORTED_FILE_TYPE`.
- Em producao, cada arquivo ainda e recebido em memoria antes do envio ao Supabase; upload direto ou retomavel esta no roadmap.
- Fundo sonoro conserva entidade, versoes, decisoes e Storage separados dos anexos, mas e opcional, secundario e de baixa prioridade. Ausente, desabilitado ou `none` nunca bloqueia. No modo `item`, a decisao de soundtrack usa `recalculatePostStatus: false`: ela nao conclui/reprova a postagem isoladamente; uma trilha aplicavel pendente so bloqueia quando as midias resultariam em aprovacao. O modo `content` preserva a compatibilidade existente.
- Alteracoes de fundo sonoro em postagens `executed` sao recusadas. Decisoes pertencem somente ao Cliente e ficam versionadas para auditoria.
- A aprovacao de soundtrack e vinculada a `content_revision`. `post_soundtrack_versions` e `post_soundtrack_decisions` sao append-only no PostgreSQL: INSERT legitimo permanece aceito, UPDATE/DELETE direto e bloqueado e hard delete de soundtrack, post ou Cliente continua cascando o historico relacionado.
- `GET /api/v1/branding` fornece somente a identidade institucional publica, incluindo `logo_configured` derivado da referencia persistida. `POST /api/v1/branding/logo` e `DELETE /api/v1/branding/logo` exigem contexto administrativo e a capacidade `branding:update`, exclusiva de `admin`.
- Logos usam o Storage existente em `branding/logo/{uuid}.{ext}` e aceitam somente PNG, JPEG ou WebP estaticos de ate 2 MB e 16 milhoes de pixels. O pipeline confronta MIME/extensao/formato, rejeita WebP animado, APNG e multipagina, valida limites e CRC de todos os chunks PNG e conclui a decodificacao da unica imagem antes do Storage. Multer 2.2.0 limita o multipart a um arquivo, nenhum campo textual e dois parts; duas decodificacoes podem ocorrer em paralelo. A URL nao e persistida; ausencia ou falha usa o fallback Postinder.
- `GET /api/v1/clients/:id/portal-link`, `POST /api/v1/clients/:id/portal-link` e `POST /api/v1/clients/:id/portal-link/replace` exigem `clients:portal-access`. Consulta nunca gera token; criacao recusa link ativo e substituicao usa lock e transacao para preservar o anterior se a emissao falhar.
- Tokens de portal novos mantem `token_hash` como credencial autoritativa e guardam somente uma copia AES-256-GCM em `token_ciphertext` para recuperacao administrativa. Tokens antigos sem ciphertext continuam autenticando e sao apresentados como nao recuperaveis.
- `portal_detailed_view` e booleano por Cliente, com default `false`, retornado tanto no portal por token quanto no autenticado. A fila e ordenada no SQL e novamente normalizada por data prevista, criacao e ID, com datas ausentes por ultimo.
- E-mail Marketing exige `email_link` HTTP(S). Como canal unico, pode ser enviado sem arquivo; os demais canais continuam exigindo anexo. A API nao busca a URL externa e o DTO do portal omite protocolos inseguros inclusive em dados antigos.
- Envio em lote aceita apenas posts `draft|ready|rejected` com midia, ou E-mail Marketing como unico canal e `email_link` nao vazio. O frontend usa a mesma regra para selecao individual, mestre e conjunto efetivamente enviado.
- Estado oficial, `portal_post_reviews` e feedback sao atomicos. `activity_events` permanece best-effort no controller depois do commit transacional da decisao oficial no banco; sua falha pode omitir o evento secundario, mas nao altera o resultado oficial nem as metricas.
- `3A3R` e recusado em novas postagens, mas uma edicao parcial pode preservar um valor historico ja existente. A criacao de Cliente ignora campos legados de documento e persiste ambos como nulos; edicao e leitura antigas permanecem compativeis.

Consulte [../PROJECT_STATE.md](../PROJECT_STATE.md), [../docs/STORAGE_ARCHITECTURE.md](../docs/STORAGE_ARCHITECTURE.md) e [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) para a documentacao consolidada.
