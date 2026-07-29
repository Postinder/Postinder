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

No snapshot auditado do PostgreSQL publicado da Supabase, `001`, a `002`
historica e `003` a `011` estavam registradas; `012`, `013`, `014` e `015`
permaneciam pendentes. Havia 1 Cliente ativo, nenhum inativo, 0 posts e 0
files, sem orfaos, duplicidades incompatíveis ou FKs invalidas. A `012` nao
atingia linhas nesse snapshot, mas o preflight deve ser repetido imediatamente
antes do deploy.

O migrador real `backend/scripts/migrate.ts` foi validado em clone restaurado:
aplicou `012` a `015` na ordem correta, a segunda execucao foi no-op e o
advisory lock foi liberado. No Render, execute `npm run db:migrate` em release
step bloqueante anterior ao Start Command.

A migration `015_post_soundtracks.sql` cria o estado atual do fundo sonoro, suas revisoes imutaveis e decisoes do Cliente. O vinculo e opcional: postagens anteriores continuam semanticamente no modo `none`, sem backfill de registros nem reescrita de historico.

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
