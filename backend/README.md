# Backend do Postinder

API Express/TypeScript do Postinder. Ela atende autenticacao, usuarios, Clientes, postagens, aprovacoes, portal, arquivos, feedbacks, atividades, notificacoes e manutencao de demonstracao.

## Desenvolvimento

```bash
npm install
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
npm run build
npm run start
```

Migrations sao a unica fonte de verdade do schema. O startup valida compatibilidade e nao executa DDL corretivo.

## API e regras principais

Base local: `http://localhost:3001/api/v1`.

- JWT de Cliente nao acessa as rotas administrativas de postagens.
- Aprovacao e reprovacao pertencem ao portal do Cliente.
- `PATCH /posts/:id/status` aceita apenas `draft <-> ready`.
- Postagens `executed` sao imutaveis; duplicacao cria uma nova postagem.

Consulte [../PROJECT_STATE.md](../PROJECT_STATE.md) e [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) para a documentacao consolidada.
