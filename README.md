# Postinder

Plataforma de gestao e aprovacao de conteudo para agencias. A agencia prepara e envia postagens; o Cliente revisa imagens, videos e outros arquivos pelo portal; a agencia registra a execucao depois da aprovacao. O portal oferece swipe equivalente para imagens e videos, botoes acessiveis, player nativo de video e legenda expansivel com hifenizacao em portugues.

## Estado atual

A auditoria tecnica pre-deploy e as correcoes anteriores foram publicadas em julho de 2026; o banco publicado continua em `016`. Branding e a rodada de simplificacao do portal permanecem locais e nao publicados: `017_platform_branding.sql` e `018_client_portal_preferences_and_recoverable_links.sql` devem ser aplicadas pelo migrador oficial antes de uma futura publicacao. A validacao local atual possui 170 testes de backend, 52 testes frontend unitarios, 22 testes React reais e os dois builds aprovados.

## Interface atual

- A Previa do Feed usa o componente compartilhado de midia para imagens e videos, com player e fallback neutro quando necessario.
- **Atividade recente** e **Postagens** iniciam recolhidas no Dashboard e podem ser expandidas independentemente.
- O portal simplificado mostra uma fila guiada ordenada pela data prevista e avanca automaticamente depois de cada decisao. A configuracao por Cliente **Visualizacao detalhada do portal** restaura o seletor e a visao geral quando necessario.
- O layout do portal reserva mais espaco para a midia principal, preserva videos verticais com `object-contain`, responsividade e botoes acessiveis.
- Login e recuperacao permanecem identificados como Postinder e nao montam nem consultam o branding configuravel. Um administrador pode configurar em **Identidade visual** o logo institucional exibido dinamicamente na area interna da empresa e no portal do Cliente, sem rebuild; na ausencia ou falha da imagem, o fallback Postinder permanece funcional.
- Novos Clientes sao cadastrados sem CPF/CNPJ. Documentos antigos continuam preservados e editaveis, sem limpeza retroativa nem remocao de colunas.
- O link ativo do portal e recuperavel pelo administrador autorizado; copiar ou abrir nao gera outro token, e substituir exige confirmacao. E-mail Marketing aceita aprovacao por preview web seguro e dispensa anexo quando for o unico canal.
- `3A3R` foi removido das novas selecoes, o fundo sonoro ficou oculto sem remover sua infraestrutura e os anexos ganharam navegacao anterior/proximo no viewer.

## Arquitetura

```text
apps/admin       React + Vite
backend          Express + TypeScript + PostgreSQL
database         migrations versionadas
docs             guias de arquitetura e operacao
```

Em desenvolvimento, arquivos ficam em `uploads`. Em producao, o backend usa Supabase Storage. A topologia de referencia e Vercel para frontend, Render para API e Supabase para banco e Storage.

## Requisitos

- Node.js 24.x (o arquivo `.node-version` fixa 24.16.0 para desenvolvimento e validacao)
- Docker Desktop para PostgreSQL local
- npm 11.13.0

## Inicio rapido

No Windows, o setup assistido instala dependencias, sobe o banco, aplica migrations e cria dados demo explicitamente:

```powershell
.\docs\deploy\setup.ps1
npm run dev
```

Para o fluxo manual:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix apps/admin
docker compose up -d
cd backend
npm run db:migrate
cd ..
npm run dev
```

A raiz e os dois aplicativos versionam lockfiles v3 e usam `npm ci` em desenvolvimento, validacao e deploy. `npm install` fica reservado exclusivamente a mudancas deliberadas de dependencias. Cada artefato implantavel possui `.npmrc` proprio para aplicar `engine-strict=true` mesmo quando npm inicia diretamente em `backend` ou `apps/admin`.

Para incluir dados de demonstracao depois das migrations:

```powershell
$env:APP_MODE = 'demo'
cd backend
npm run db:seed-demo
```

O comando de seed e opcional e continua condicionado a `APP_MODE=demo`. Seed,
reset HTTP e bootstrap sao processos separados.

`NODE_ENV` define apenas o modo tecnico do Node. A finalidade da implantacao usa `DEPLOYMENT_MODE`. O reset de demonstracao so pode existir com a combinacao explicita `DEPLOYMENT_MODE=demo` e `ENABLE_DEMO_RESET=true`, alem de autenticacao e capacidade administrativa. `VITE_DEPLOYMENT_MODE=demo` controla apenas a apresentacao no frontend.

## URLs locais

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- PostgreSQL Docker: `127.0.0.1:5433`

## Dados demo

Depois de executar a seed demo:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Admin | `admin@postinder.local` | `Admin@123456` |
| Cliente | `cliente@example.com` | `Cliente@123456` |

Essas credenciais sao exclusivas de demonstracao e nao devem ser usadas em producao. Para bootstrap sem seed, configure `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, depois rode `npm run db:bootstrap-admin` em `backend`.

## Banco de dados

As migrations em `database/migrations` sao a unica fonte de verdade estrutural. Sempre use:

```bash
cd backend
npm run db:migrate
```

O startup nao cria nem corrige schema. A migration `002_development_seed.sql` e historica e nao faz parte do migrador estrutural. A `018` adiciona somente a preferencia de portal do Cliente, a copia cifrada recuperavel do token e um indice de consulta; nao altera dados historicos.

Em deploy, `npm run db:migrate` deve ser um Pre-Deploy Command/release step bloqueante anterior ao Start Command. Backup logico e preflight do banco sao obrigatorios antes de migrations em producao.

## Autenticacao e autorizacao

- JWT administrativo e JWT de Cliente sao contextos distintos; refresh tokens tambem possuem contexto explicito.
- Todas as rotas administrativas exigem autenticacao, identidade administrativa e capacidade declarada antes do controller.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`.
- `admin` possui todas as capacidades; `manager` executa operacoes nao destrutivas; `editor` atua no fluxo editorial; `viewer` e estritamente somente leitura.
- Rotas administrativas sem politica declarada negam acesso por padrao.
- O portal autenticado de Cliente e o portal por token privado permanecem fluxos separados.

## Integracoes e variaveis frontend

O frontend pode consumir somente configuracoes publicas:

- `VITE_API_URL`;
- `VITE_DEPLOYMENT_MODE`;
- `VITE_GA_MEASUREMENT_ID`.

Segredos nunca pertencem ao frontend. Anthropic e Z-API executam no backend; Twilio, GoHighLevel, Canva e Resend permanecem desabilitados ate uma implementacao server-side segura. A IA chama somente a API do Postinder, exige a capacidade `ai-insights:generate` e envia ao provedor apenas dados agregados e pseudonimizados.

## Comandos uteis

```bash
# Desenvolvimento integrado
npm run dev

# Builds
npm run build --prefix backend
npm run build --prefix apps/admin

# Banco e administracao
cd backend
npm run db:migrate
npm run db:seed-demo
npm run db:bootstrap-admin

# Retencao manual de arquivos
npm run storage:cleanup-retention
```

Para reiniciar somente o banco local: `docker compose down -v`, depois `docker compose up -d` e `npm run db:migrate` em `backend`.

## Documentacao

- [Estado atual](PROJECT_STATE.md)
- [Decisoes de produto](PRODUCT_DECISIONS.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Deploy, banco e ambientes](docs/DEPLOYMENT.md)
- [Checklist de deploy](docs/deploy/CHECKLIST_DEPLOY_TESTE.md)
- [Storage e Retencao](docs/STORAGE_ARCHITECTURE.md)

Os arquivos `*_TEMP.md` permanecem no repositorio como referencia temporaria de conferencia da promocao documental.
