# Postinder

Plataforma de gestao e aprovacao de conteudo para agencias. A agencia prepara e envia postagens; o Cliente revisa imagens, videos e outros arquivos pelo portal; a agencia registra a execucao depois da aprovacao. O portal oferece swipe e botoes acessiveis, player nativo de video e legenda expansivel com hifenizacao em portugues.

## Arquitetura

```text
apps/admin       React + Vite
backend          Express + TypeScript + PostgreSQL
database         migrations versionadas
docs             guias de arquitetura e operacao
```

Em desenvolvimento, arquivos ficam em `uploads`. Em producao, o backend usa Supabase Storage. A topologia de referencia e Vercel para frontend, Render para API e Supabase para banco e Storage.

## Requisitos

- Node.js 18 ou superior
- Docker Desktop para PostgreSQL local
- npm

## Inicio rapido

No Windows, o setup assistido instala dependencias, sobe o banco, aplica migrations e cria dados demo explicitamente:

```powershell
.\docs\deploy\setup.ps1
npm run dev
```

Para o fluxo manual:

```bash
npm install
npm install --prefix backend
npm install --prefix apps/admin
docker compose up -d
cd backend
npm run db:migrate
cd ..
npm run dev
```

Para incluir dados de demonstracao depois das migrations:

```powershell
$env:APP_MODE = 'demo'
cd backend
npm run db:seed-demo
```

O comando de seed e opcional. Ele e o unico comportamento atualmente condicionado a `APP_MODE=demo`; a separacao completa entre Modo demonstracao e Modo producao ainda nao esta implementada.

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

O startup nao cria nem corrige schema. A migration `002_development_seed.sql` e historica e nao faz parte do migrador estrutural.

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
- [Storage e Retencao](docs/STORAGE_ARCHITECTURE.md)

Os arquivos `*_TEMP.md` permanecem no repositorio como referencia temporaria de conferencia da promocao documental.
