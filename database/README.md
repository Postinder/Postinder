# Banco de dados

## Migrations 021 a 024 - integridade de revisao, soundtrack e reacao positiva

`021_content_revision_and_review_history.sql` adiciona `posts.content_revision`, `approved_revision` e `executed_revision`, vincula drafts/decisoes a uma revisao de conteudo e cria `portal_review_decisions` e `portal_review_actions` como fatos oficiais append-only. O banco bloqueia UPDATE e DELETE direto nesses fatos oficiais. Triggers tambem protegem alteracoes materiais em posts, files e soundtrack quando o ciclo esta protegido. Operacoes do runtime usam `expectedRevision`, e a execucao exige revisao oficialmente aprovada, Cliente ativo e tenant coerente.

O backfill da `021` e deliberadamente conservador:

- `sent`, `pending_approval` e `rejected` historicos recebem `content_revision = 1`;
- `draft` e `ready` permanecem em revisao zero;
- `approved` e `executed` preservam status e historico, mas nao recebem selo artificial;
- nenhuma decisao oficial ou certificacao de soundtrack e fabricada;
- drafts antigos sem revisao confiavel sao descartados porque nao podem ser associados com seguranca a uma `content_revision`.

Assim, um `approved` legado sem `approved_revision` nao pode executar ate cumprir `reopen -> submit -> aprovacao oficial -> execucao`. Historico antigo do portal permanece legado e nao e promovido a `portal_review_decisions` ou `portal_review_actions`.

`022_funnel_visibility_and_revision_snapshot.sql` cria `platform_settings.post_field_client_visibility` com default conservador `{"funnel_tag": false}` e `posts.review_field_visibility`. O valor historico de `funnel_tag` e preservado, e revisoes historicas recebem o snapshot conservador `{"funnel_tag": false}`. Funil interno invisivel nao e material para a aprovacao; quando visivel no snapshot submetido, passa a ser protegido. Alterar a configuracao global nao muda retroativamente revisoes anteriores.

`023_soundtrack_history_append_only.sql` bloqueia UPDATE e DELETE direto em `post_soundtrack_versions` e `post_soundtrack_decisions`, mantendo INSERT legitimo. A funcao de guarda reconhece as cascatas existentes, portanto hard delete autorizado de soundtrack, post ou Cliente continua removendo o historico relacionado.

`024_portal_positive_reaction.sql` e aditiva e acrescenta `positive_reaction` opcional aos drafts e decisoes do portal, alem do `item_snapshot` oficial. **Adorei** persiste `decision = approved` com `positive_reaction = loved`; aprovacao normal e legado permanecem com `NULL`. Constraints aceitam somente combinacoes semanticamente validas, impedem reacao positiva em rejeicao ou no lugar errado e preservam `[]` como snapshot legado valido. A migration nao reescreve decisoes oficiais, nao faz backfill de `loved` e nao enfraquece os triggers append-only.

As migrations `021`/`022` foram validadas sobre dump sanitizado representativo. A `023`, a `024` e a cadeia oficial foram validadas em PostgreSQL 18.4 descartavel; a primeira execucao aplicou `024` uma unica vez, a segunda foi no-op, e os probes confirmaram as constraints, os bloqueios diretos e as cascatas legitimas. O SHA-256 validado da `024` e `A2DD6EFA09EABB0000DE365BE9E8A110259D197FD70910D83552A278C771C294`.

## Migration 020 - forma de aprovacao e revisoes do portal

`020_portal_approval_mode_and_review_drafts.sql` e aditiva e ainda nao publicada. Ela:

- adiciona `platform_settings.portal_approval_mode VARCHAR(20) NOT NULL DEFAULT 'content'`, limitado pela constraint a `content` ou `item`;
- cria `portal_item_review_drafts` para escolhas provisórias por `(post_id, file_id)`, separadas do estado oficial;
- cria `portal_post_reviews` para revisao concluida, numero de revisao e controle de rewind no nivel da postagem;
- adiciona a FK composta `(post_id, file_id) -> files(post_id, id)`, impedindo draft associado a arquivo de outra postagem;
- altera o default de `post_field_policies.funnel_tag` para `hidden`, sem remover a coluna ou os dados historicos de funil/formato.

O autosave e a conclusao usam locks/transacoes; envio, reenvio e conclusao em modo `content` limpam drafts obsoletos aplicaveis. Posts anteriores a migration permanecem compativeis, e instalacoes sem valor explicito usam o fallback de dominio `content`.

A auditoria original aplicou a cadeia estrutural ate `020`; a validacao posterior ampliou o gate ate `024`, sempre em PostgreSQL local descartavel e com segunda execucao no-op.

## Migration 019 — configuracoes globais

`019_platform_settings.sql` e aditiva e ainda nao publicada. Ela cria `platform_settings` com chave singleton, retencao de 24 horas, feature flag de fundo sonoro, JSONB controlado para politicas de campos e booleans do portal. Tambem adiciona `clients.portal_mode_override` anulavel com `simplified|detailed`; `NULL` significa herdar.

A migration nao altera `017`/`018`, nao faz backfill e nao reescreve Clientes, postagens ou arquivos. Instalacoes sem linha usam os mesmos defaults no dominio. A cadeia oficial deve aplicar `017` a `024`, nessa ordem, antes de iniciar o backend atual.

A limitacao anterior de PostgreSQL local foi superada: a auditoria posterior aplicou toda a cadeia ate `024` em banco temporario e confirmou o no-op da segunda rodada. Antes do deploy, ainda sao obrigatorios backup e preflight novos do ambiente publicado.

## Fonte de verdade

As migrations versionadas em `database/migrations` sao a unica fonte de verdade para a estrutura do banco. Elas sao aplicadas em ordem por `backend/scripts/migrate.ts` e registradas em `schema_migrations`.

O schema SQL inicial legado foi removido. Novas instalacoes, demonstracoes e producao devem usar somente o migrador.

## Instalacao e atualizacao

```bash
cd backend
npm run db:migrate
```

O startup nao cria tabelas, colunas, indices ou dados. Em producao, migrations pendentes impedem a inicializacao da API.

`002_development_seed.sql` e uma migration historica preservada para compatibilidade de bancos antigos, mas nao e executada pela cadeia estrutural.

No PostgreSQL publicado da Supabase, `001`, a `002` historica e `003` a `016`
estao registradas. As migrations `012` a `015` foram aplicadas em 30/07/2026,
e `016_client_documents.sql` foi aplicada em 31/07/2026. O banco publicado
esta em `016`. Em relacao ao codigo local atual, `017` a `024` permanecem pendentes para uma futura publicacao.

O migrador real `backend/scripts/migrate.ts` foi validado em clone restaurado
e posteriormente aplicou `012` a `015` em producao. Na publicacao da hotfix,
ignorou as migrations ja registradas e aplicou somente a `016`.

A migration aditiva `017_platform_branding.sql`, ainda nao publicada, cria a configuracao institucional global com uma unica linha opcional, referencia `bucket + storage_path`, MIME, tamanho e versao de cache. Ela nao altera Clientes, postagens, anexos nem historicos; instalacoes sem registro usam o fallback Postinder. O migrador oficial aplicou a `017` somente no PostgreSQL local e confirmou idempotencia em uma segunda execucao; ela deve integrar o pre-deploy da futura publicacao.

A migration aditiva `018_client_portal_preferences_and_recoverable_links.sql`, tambem nao publicada, adiciona `clients.portal_detailed_view BOOLEAN NOT NULL DEFAULT FALSE`, `client_portal_tokens.token_ciphertext TEXT` anulavel e um indice parcial de consulta por Cliente. Nao existe backfill, remocao, reescrita ou invalidacao de token antigo. O migrador oficial aplicou `001`, `003` a `018` em PostgreSQL 18.4 local vazio e, na segunda execucao, ignorou toda a cadeia como ja registrada.

A migration `015_post_soundtracks.sql` cria o estado atual do fundo sonoro e suas tabelas de versoes/decisoes. O vinculo e opcional: postagens anteriores continuam semanticamente no modo `none`, sem backfill de registros nem reescrita de historico. A imutabilidade append-only dessas tabelas e garantida no banco pela `023`. **Adorei** nao pertence ao soundtrack. Falhas correntes de exclusao no Storage sao persistidas em `post_soundtracks.storage_delete_error`, sem atualizar `post_soundtrack_versions`; falhas dessa persistencia continuam observaveis no logger.

A migration `016_client_documents.sql` adiciona `document_type` e
`document_number` anulaveis a `clients`, com constraint de coerencia para CPF
de 11 digitos ou CNPJ de 14 digitos. Ela nao cria unicidade nem altera
registros existentes. CPF/CNPJ permanece opcional e sem unicidade; documentos
cadastrados antes da correcao nao foram recuperados. A migration foi aplicada
com sucesso em producao em 31/07/2026.

## Backup e recuperacao

O backup logico do snapshot publicado foi criado e os originais permaneceram
intactos. A restauracao foi validada em stack Supabase local compativel, em
transacao unica. O procedimento comenta somente, em uma copia de `roles.sql`,
a instrucao incompatível que altera `statement_timeout` de `supabase_admin`;
`schema.sql` e `data.sql` permanecem identicos.

O backup e restauravel com esse procedimento documentado de compatibilidade,
mas nao inclui objetos fisicos do Supabase Storage. Crie novo backup e execute
novo preflight antes de qualquer migration em producao.

Em rehearsal/restauracao sobre PostgreSQL 18 recem-criado, um dump que declara o schema `public` pode colidir com o `public` vazio criado automaticamente. Somente em database comprovadamente descartavel, confirme o alvo e que o schema esta vazio antes de remover apenas esse schema para o `pg_restore`. Este procedimento nao autoriza apagar `public` em producao.

## Dados demo

```powershell
$env:APP_MODE = 'demo'
cd backend
npm run db:seed-demo
```

A seed e explicita e idempotente. `APP_MODE=demo` protege a seed; o reset HTTP
usa a combinacao separada `DEPLOYMENT_MODE=demo` e
`ENABLE_DEMO_RESET=true`, alem da autorizacao administrativa.

## Primeiro administrador

Defina `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, depois execute:

```bash
cd backend
npm run db:bootstrap-admin
```

O comando nao cria administrador quando ja ha um admin ativo. Consulte [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) para o procedimento publicado.
