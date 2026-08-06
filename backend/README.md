# Backend do Postinder

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
  45 rotas, com negacao por padrao.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`; `viewer` e
  estritamente somente leitura.
- Aprovacao e reprovacao pertencem ao portal do Cliente.
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
- Fundo sonoro usa entidade e aprovacao separadas dos anexos. Audio enviado aceita um arquivo ativo de ate 50 MB em MP3, WAV, OGG, AAC ou M4A e reutiliza o Storage existente.
- Alteracoes de fundo sonoro em postagens `executed` sao recusadas. Decisoes pertencem somente ao Cliente e ficam versionadas para auditoria.
- `GET /api/v1/branding` fornece somente a identidade institucional publica, incluindo `logo_configured` derivado da referencia persistida. `POST /api/v1/branding/logo` e `DELETE /api/v1/branding/logo` exigem contexto administrativo e a capacidade `branding:update`, exclusiva de `admin`.
- Logos usam o Storage existente em `branding/logo/{uuid}.{ext}` e aceitam somente PNG, JPEG ou WebP estaticos de ate 2 MB e 16 milhoes de pixels. O pipeline confronta MIME/extensao/formato, rejeita WebP animado, APNG e multipagina, valida limites e CRC de todos os chunks PNG e conclui a decodificacao da unica imagem antes do Storage. Multer 2.2.0 limita o multipart a um arquivo, nenhum campo textual e dois parts; duas decodificacoes podem ocorrer em paralelo. A URL nao e persistida; ausencia ou falha usa o fallback Postinder.

Consulte [../PROJECT_STATE.md](../PROJECT_STATE.md), [../docs/STORAGE_ARCHITECTURE.md](../docs/STORAGE_ARCHITECTURE.md) e [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) para a documentacao consolidada.
