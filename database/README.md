# Banco de dados

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
esta em `016`. Em relacao ao codigo local atual, a `017` permanece pendente para uma futura publicacao.

O migrador real `backend/scripts/migrate.ts` foi validado em clone restaurado
e posteriormente aplicou `012` a `015` em producao. Na publicacao da hotfix,
ignorou as migrations ja registradas e aplicou somente a `016`.

A migration aditiva `017_platform_branding.sql`, ainda nao publicada, cria a configuracao institucional global com uma unica linha opcional, referencia `bucket + storage_path`, MIME, tamanho e versao de cache. Ela nao altera Clientes, postagens, anexos nem historicos; instalacoes sem registro usam o fallback Postinder. O migrador oficial aplicou a `017` somente no PostgreSQL local e confirmou idempotencia em uma segunda execucao; ela deve integrar o pre-deploy da futura publicacao.

A migration `015_post_soundtracks.sql` cria o estado atual do fundo sonoro, suas revisoes imutaveis e decisoes do Cliente. O vinculo e opcional: postagens anteriores continuam semanticamente no modo `none`, sem backfill de registros nem reescrita de historico.

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
