# Database

Este diretório mantém o schema PostgreSQL do Postinder.

## Caminho recomendado

Use as migrations versionadas em `database/migrations`.

No backend:

```bash
cd backend
npm run db:migrate
```

O comando cria a tabela `schema_migrations`, aplica apenas arquivos ainda não executados e registra cada migration aplicada.

## Arquivos

- `migrations/001_core_schema.sql`: tabelas, índices e extensões.
- `migrations/002_development_seed.sql`: usuário admin e cliente inicial para teste.
- `001_initial_schema.sql`: schema legado consolidado, mantido por compatibilidade.

## Antes de publicar

Configure `DATABASE_URL` apontando para o PostgreSQL online e rode:

```bash
cd backend
npm run db:migrate
```

Depois valide a conexão com:

```text
GET /health/db
```
