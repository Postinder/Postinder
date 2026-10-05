# Backend do Postinder

## Contratos de revisão e certificação administrativa (025)

GET dos portais por token e autenticado expõe `rewind: {available, postId, decisionId, contentRevision, reviewSequence}`; sem decisão anterior, apenas `available:false`. Cada postagem informa `reviewSequence`. Todos os comandos de revisão exigem `expectedRevision` e `expectedReviewSequence`; rewind exige `expectedDecisionId`. Conflitos usam HTTP 409 (`REVIEW_CONFLICT`, `REVISION_CONFLICT` ou conflito de decisão). Conclusões/rewind adquirem advisory lock por cliente antes do lock da postagem, ordenando conclusões entre posts. Retry reconhece o fato anterior e não reaplica efeitos.

`positiveFeedback` é string opcional de até 5.000 caracteres, trim/branco→NULL, permitida somente em approved+loved. Em content pertence ao fato oficial; em item pertence ao draft até a conclusão e a `item_snapshot[].positiveFeedback` depois. Mesmo retry com texto diferente conflita. Não é gravada em `feedback`.

- `GET /api/v1/posts/:id/admin-approval`: valida elegibilidade e devolve revisão/fingerprint para a intenção.
- `POST /api/v1/posts/:id/admin-approve`: body fechado `{justification, expectedRevision, expectedFingerprint, idempotencyKey}`. Ambos exigem `posts:admin-approve`, concedida somente a admin. Ator/role/empresa vêm da autenticação, nunca do body.
- `GET /api/v1/posts/:id/review-history`: leitura administrativa `posts:read`; inclui decisões originais e ações com justificativa/responsável.

`AdministrativeApprovalService` bloqueia postagem, arquivos, soundtrack e configuração aplicável; valida rejeição oficial atual, cliente/empresa e completude; compara fingerprint; certifica r+1 e insere `admin_approved` referenciando a rejeição r. Arquivos, decisão de soundtrack com ator admin, ação e selo do post são atômicos. Uma chave com payload diferente conflita. O gate e as projeções compartilham `approvalSourceSql` (client/admin), sem novo status.

### Fingerprint material

SHA-256 do JSON canônico em `MaterialFingerprint.ts`, envelope version=1. Chaves de objetos ordenadas recursivamente; undefined/null→null; datas ISO UTC; texto visível exato; arrays de domínio preservados. Anexos são ordenados por sort_order (NULL=999999), created_at e id. Política de campos obrigatórios é ordenada antes do hash.

- Post: id, client_id, company_id, content_revision, title, description, channels, formats, email_link, scheduled_date e funnel_tag quando a política da nova revisão o torna visível.
- Arquivo: id, url, bucket, storage_path, mime_type, size_bytes, original_name, file_type, sort_order, storage_deleted_at. created_at determina desempate da ordem, sem integrar cada objeto material.
- Soundtrack habilitada/aplicável: id, mode, revision_number, source_media_id, track_name, artist, external_url, platform, start_time_seconds, usage_source, usage_notes, rights_notes, audio_url, bucket, storage_path, mime_type, size_bytes, original_name, storage_deleted_at.
- Política: soundtrackEnabled, funnelVisible, requiredFields. Soundtrack ausente/none/desabilitada e funil não visível não entram como material. Status derivado, timestamp de leitura/atualização e valores da interface ficam fora.

### Validação local

`npm test`: 240 testes, incluindo 25 de fingerprint/validação. `npm run test:integration:post-revision`: 27; `npm run test:integration:portal-approval`: 14; `npm run test:integration:review-package`: 40. Integrações exigem `POST_REVISION_INTEGRATION=1`, `POST_REVISION_TEST_CONFIRM=RUN_ISOLATED_TESTS` e `POST_REVISION_TEST_DATABASE_URL` local com nome terminado em `_test`; a suíte portal exige também `PORTAL_APPROVAL_INTEGRATION=1`. Não executar as três suítes contra o mesmo banco em paralelo: a primeira recria o schema. Rodar na ordem revisão → portal → pacote.

Nesta entrega foi usado PostgreSQL descartável em 127.0.0.1:55439, container `postinder-approval-test-20261004`, bancos `postinder_approval_test` e `postinder_migration_test`. O script `test:integration:soundtracks` passou com DATABASE_URL local e credenciais Supabase vazias, usando exclusivamente arquivos locais. Build/typecheck passou. Container removido ao final; consulta posterior confirmou sua ausência.


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
- Aprovacao e solicitacao de ajuste pertencem ao portal do Cliente. Para conteudo, as intencoes visiveis sao **Adorei**, **Aprovar** e **Solicitar ajuste**: **Adorei** persiste `decision = approved` com `positive_reaction = loved`; **Aprovar** persiste `decision = approved` com reacao `NULL`; ajuste preserva o resultado negativo existente. Nao existe status `loved` ou `super_like`, nem regra de execucao diferente.
- `content` conclui uma decisao para a postagem inteira. `item` grava escolhas provisórias em `portal_item_review_drafts`; cada item pode ser aprovado normalmente, receber **Adorei** ou solicitar ajuste. `POST .../complete-review` consolida o `item_snapshot` somente quando todas as midias estao resolvidas. Misturar **Aprovar** e **Adorei** continua aprovando o post; qualquer ajuste mantem a logica negativa. Drafts nao alteram estado canonico, feedback, atividade, notificacao ou metricas.
- Autosave e conclusao bloqueiam a postagem/arquivos dentro de transacoes. Retry identico ou conclusao concorrente depois do primeiro commit recebe resposta idempotente com `already_completed`, sem duplicar revisao ou feedback; retry conflitante retorna conflito e nao converte **Aprovar** em **Adorei**, nem o inverso.
- Submissoes oficiais incrementam `content_revision`; aprovacao e execucao selam `approved_revision` e `executed_revision`. Operacoes de review recebem `expectedRevision` e recusam estado stale. A execucao exige selo corrente, certificação oficial do Cliente ou administrativa, tenant coerente e Cliente ativo.
- Postagens protegidas, seus arquivos e soundtrack nao aceitam alteracao material silenciosa. A agencia deve reabrir antes de editar; posts `approved` legados sem selo precisam cumprir `reopen -> submit -> aprovacao oficial -> execucao`.
- `portal_review_decisions` e `portal_review_actions` sao fatos append-only. A reacao opcional fica na decisao oficial em modo `content`; no modo `item`, o `item_snapshot` oficial preserva cada escolha e tambem e imutavel. Drafts anteriores a `021` sem revisao confiavel sao descartados; decisoes anteriores a `024` permanecem com `positive_reaction = NULL`, e nenhum historico legado e promovido ou marcado artificialmente como **Adorei**.
- `POST .../posts/:postId/reopen` implementa rewind por postagem: somente a última conclusão oficial do Cliente, se elegível pode ser reaberta uma vez por ciclo. Navegacao entre midias nao chama rewind e nao altera estado oficial. O rewind preserva a decisao historica anterior, limpa sua projecao corrente e nao herda automaticamente **Adorei** na nova analise.
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
- A aprovacao de soundtrack e vinculada a `content_revision`. `post_soundtrack_versions` e `post_soundtrack_decisions` sao append-only no PostgreSQL: INSERT legitimo permanece aceito, UPDATE/DELETE direto e bloqueado e hard delete de soundtrack, post ou Cliente continua cascando o historico relacionado. **Adorei** pertence somente ao conteudo; soundtrack continua restrito a aprovacao ou solicitacao de ajuste e nao aceita `positive_reaction`.
- Falhas ao remover o objeto fisico de uma trilha ficam no estado corrente `post_soundtracks.storage_delete_error`; a versao historica nao e atualizada. Se a persistencia do erro falhar, o logger ainda registra a falha para observabilidade e retry.
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
