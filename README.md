# Postinder

## Configuracoes da plataforma

O pacote local atual adiciona uma configuracao operacional global da instalacao em `/admin/platform-settings`, sem multi-tenancy. Ela controla retencao de arquivos apos `executed`, fundo sonoro, politicas de campos seguros de Clientes/postagens, visibilidade do funil para o Cliente, defaults do portal e a forma de aprovacao do Cliente (`content` ou `item`, com default `content`). Identidade visual continua separada em `/admin/branding`.

Somente admin altera a configuracao. O backend valida um schema fechado, usa defaults de dominio quando ainda nao existe registro e persiste atualizacoes parciais de forma transacional no singleton criado por `019_platform_settings.sql`.

A retencao usa 24 horas por default e grava o prazo no momento da execucao. Um scheduler interno varre no startup e a cada hora. Apenas objetos fisicos de postagens executadas com `executed_at` e prazo confiavel sao removidos; registros, metricas e historico permanecem.

Cada submissao oficial possui `content_revision`. A aprovacao sela essa revisao em `approved_revision`, e a execucao so e aceita quando o selo continua corrente, sendo registrada em `executed_revision`. Conteudo protegido precisa ser reaberto antes de qualquer alteracao material; operacoes do portal enviam `expectedRevision` para recusar drafts ou decisoes stale. O Cliente possui tres intencoes visiveis para o conteudo: **Adorei**, **Aprovar** e **Solicitar ajuste**. **Adorei** e **Aprovar** produzem a mesma aprovacao operacional; somente **Adorei** acrescenta `positive_reaction = loved` ao fato historico oficial.

Plataforma de gestao e aprovacao de conteudo para agencias. A agencia prepara e envia postagens; o Cliente revisa imagens, videos e outros arquivos pelo portal; a agencia registra a execucao depois da aprovacao. O portal permite uma decisao por postagem (`content`) ou escolhas provisórias por midia consolidadas em **Concluir analise** (`item`), sempre com navegacao livre entre as midias.

## Estado atual

A auditoria tecnica pre-deploy e as correcoes anteriores foram publicadas em julho de 2026; o banco publicado continua em `016`. O pacote local atual possui um commit anterior preservado, mas a leva **Adorei** ainda nao recebeu seu segundo commit nem foi publicada. O backend futuro exige as migrations estruturais `017` a `024`, nessa ordem, antes de uma publicacao autorizada. Os totais de validacao estao registrados em `PROJECT_STATE.md`. Nenhum deploy deste pacote foi realizado.

## Interface atual

- A Previa do Feed usa o componente compartilhado de midia para imagens e videos, com player e fallback neutro quando necessario.
- **Atividade recente** e **Postagens** iniciam recolhidas no Dashboard e podem ser expandidas independentemente.
- O portal simplificado mostra uma fila guiada ordenada pela data prevista e avanca automaticamente depois de cada decisao. A configuracao por Cliente **Visualizacao detalhada do portal** restaura o seletor e a visao geral quando necessario.
- A forma de aprovacao e global: `content` consolida uma decisao para a postagem inteira; `item` salva escolhas provisórias por midia e somente as oficializa quando o Cliente conclui a analise. Nos dois modos, **Aprovar** e **Adorei** sao escolhas positivas; qualquer **Solicitar ajuste** preserva a logica negativa vigente.
- O layout do portal reserva mais espaco para a midia principal, preserva videos verticais com `object-contain`, responsividade e botoes acessiveis. O Cliente ve titulo e legenda completos, data de publicacao e canais, sem filename tecnico; as tres acoes usam os textos **Adorei**, **Aprovar** e **Solicitar ajuste**.
- Login e recuperacao permanecem identificados como Postinder e nao montam nem consultam o branding configuravel. Um administrador pode configurar em **Identidade visual** o logo institucional exibido dinamicamente na area interna da empresa e no portal do Cliente, sem rebuild; na ausencia ou falha da imagem, o fallback Postinder permanece funcional.
- Novos Clientes sao cadastrados sem CPF/CNPJ. Documentos antigos continuam preservados e editaveis, sem limpeza retroativa nem remocao de colunas.
- O link ativo do portal e recuperavel pelo administrador autorizado; copiar ou abrir nao gera outro token, e substituir exige confirmacao. E-mail Marketing aceita aprovacao por preview web seguro e dispensa anexo quando for o unico canal.
- `3A3R` foi removido das novas selecoes. Fundo sonoro permanece atras de feature flag, compativel e secundario; desligado, ausente ou `none` nao bloqueia a aprovacao.
- Funil permanece configuravel como `hidden|optional|required`. Sua visibilidade para o Cliente e independente e conservadoramente `false`; cada submissao salva em `review_field_visibility` o que aquela revisao efetivamente expos.
- Na lista administrativa, **Selecionar todos** inclui somente postagens elegiveis, carregadas e visiveis nos filtros atuais; checkbox individual, checkbox mestre e envio usam o mesmo conjunto contextual.

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

O startup nao cria nem corrige schema. A migration `002_development_seed.sql` e historica e nao faz parte do migrador estrutural. A `018` adiciona a preferencia de portal do Cliente e a copia cifrada recuperavel do token; a `020` adiciona o modo de aprovacao e drafts provisorios; a `021` introduz revisao/certificacao de conteudo e historico oficial; a `022` adiciona visibilidade e snapshot do funil; a `023` torna versions/decisions de soundtrack append-only sem bloquear cascatas legitimas; e a `024` acrescenta a reacao opcional **Adorei** e o `item_snapshot` oficial sem inventar reacao em registros legados.

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

# Retencao manual de arquivos (o scheduler interno tambem executa automaticamente)
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
