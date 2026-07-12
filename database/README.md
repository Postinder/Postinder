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

## Dados demo

```powershell
$env:APP_MODE = 'demo'
cd backend
npm run db:seed-demo
```

A seed e explicita e idempotente. `APP_MODE` ainda nao controla todos os comportamentos da aplicacao; ele protege a seed demo nesta fase.

## Primeiro administrador

Defina `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, depois execute:

```bash
cd backend
npm run db:bootstrap-admin
```

O comando nao cria administrador quando ja ha um admin ativo. Consulte [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) para o procedimento publicado.
