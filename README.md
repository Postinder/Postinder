# Postinder

**A forma mais rápida de aprovar conteúdo entre agência e cliente.**

Postinder é uma plataforma de aprovação de conteúdo para agências de marketing e social media. O admin (agência) monta postagens com múltiplos arquivos — imagens, vídeos, áudios, PDFs, planilhas, apresentações — e envia para o cliente aprovar. O cliente recebe um aviso no WhatsApp, abre o link, e aprova ou reprova arquivo por arquivo em uma interface de swipe (arrasta pra aprovar, arrasta pra reprovar — como um Tinder de conteúdo, daí o nome). Tudo fica registrado: quem aprovou, quando, por quê, e com que taxa de retrabalho.

---

## O problema que resolve

Aprovação de conteúdo entre agência e cliente hoje normalmente acontece em canais que não foram feitos pra isso: grupo de WhatsApp com trinta imagens soltas, planilha de status desatualizada, e-mails perdidos em thread. O resultado é sempre o mesmo:

- Ninguém sabe ao certo o que já foi aprovado e o que ainda está pendente.
- Feedback de reprovação se perde ("não gostei", sem dizer o quê).
- A agência não tem dado nenhum sobre taxa de aprovação, tempo de resposta do cliente ou motivos recorrentes de retrabalho.
- O cliente precisa de login/senha só pra bater o olho em três imagens.

Postinder resolve isso com um fluxo dedicado: a agência centraliza a criação e o envio, o cliente aprova pelo celular sem fricção, e todo o histórico vira dado — dashboard, atividades e métricas de aprovação prontos pra qualquer reunião de resultado.

---

## Como funciona

```mermaid
sequenceDiagram
    actor Admin as Agência (Admin)
    participant Postinder
    participant WhatsApp as WhatsApp (Z-API)
    actor Cliente

    Admin->>Postinder: Cria cliente e monta o post (arquivos, canais, agendamento)
    Admin->>Postinder: Envia para aprovação
    Postinder->>WhatsApp: Notifica o cliente automaticamente
    WhatsApp->>Cliente: "Você tem posts aguardando aprovação"
    Cliente->>Postinder: Abre o portal (link com token ou login)
    Cliente->>Postinder: Aprova / reprova arquivo por arquivo (swipe)
    alt Reprovado
        Cliente->>Postinder: Registra motivo + tag de rejeição
        Postinder->>Admin: Notifica pendência de ajuste
        Admin->>Postinder: Reenvia arquivo corrigido
    else Aprovado
        Postinder->>Admin: Marca post como aprovado
    end
    Postinder->>Admin: Atualiza dashboard, timeline de atividades e insights
```

**Dois jeitos de o cliente acessar**, conforme o nível de fricção desejado:
- **Link mágico com token** — sem senha, expira automaticamente, ideal para aprovação rápida pelo celular.
- **Login autenticado** — para clientes que acessam o painel com frequência e querem histórico completo.

---

## Funcionalidades

### Para a agência (admin)
- **Gestão de clientes** — cadastro com cor de marca, segmento, prazo de aprovação (SLA) configurável e número de WhatsApp; ativação/desativação sem perder histórico.
- **Criação de postagens** — múltiplos canais e formatos por post, upload de vários arquivos (imagem, vídeo, áudio, PDF, doc, planilha, apresentação, link de e-mail), reordenação, substituição e remoção de arquivos, agendamento e tags de funil.
- **Envio em lote** — manda vários posts para aprovação de uma vez em vez de um por um.
- **Fila de aprovações** — visão consolidada de tudo que está pendente entre todos os clientes.
- **Dashboard e timeline de atividades** — auditoria de eventos (quem criou, aprovou, reprovou, reenviou) por cliente e por post.
- **Insights & Feedbacks** — taxa de aprovação, taxa de rejeição, aprovação por arquivo, tempo médio de decisão do cliente, ranking dos motivos de rejeição mais comuns, feedback mensal por cliente (nota + comentário), com exportação.
- **Controle de acesso por papel** — administradores com acesso total e usuários "viewer" com acesso somente leitura, além do isolamento por empresa (multi-tenant via `company_id`).
- **Notificações internas** — central de notificações no painel, marcadas como lida/não lida por usuário.
- **Configurações** — integrações (WhatsApp/Z-API, armazenamento), e-mail e ferramentas de manutenção (reset de dados de demonstração).

### Para o cliente
- **Portal de aprovação dedicado**, com ou sem login.
- **Aprovação por swipe** — cada arquivo é avaliado individualmente: aprovar, reprovar com motivo + tag, ou desfazer.
- **Prévia nativa por tipo de arquivo** — imagem, vídeo, áudio, PDF, documento, planilha, apresentação e e-mail, sem precisar baixar nada.
- **Feedback consolidado** — nota e comentário sobre o mês/entrega.
- **Aviso automático via WhatsApp** sempre que há algo novo para revisar.

---

## Arquitetura

Monorepo (`pnpm` workspace) com backend e frontend desacoplados por uma API REST versionada.

```text
postinder/
├── apps/admin/          # Painel React (Vite) — admin e portal do cliente
│   └── src/
│       ├── features/    # Telas por domínio: posts, approvals, clients, insights...
│       ├── services/    # Client HTTP para a API
│       └── store/       # Estado global (Zustand)
├── backend/              # API REST em Express + TypeScript
│   └── src/modules/      # Um módulo por domínio (Clean Architecture)
│       ├── auth/         # domain → application → infrastructure → presentation
│       ├── posts/
│       ├── clients/
│       ├── approvals/
│       ├── portal/       # acesso do cliente (token e autenticado)
│       ├── activities/   # timeline/auditoria
│       ├── notifications/
│       └── maintenance/
├── database/
│   ├── 001_initial_schema.sql
│   └── migrations/       # migrations incrementais versionadas
├── docs/deploy/          # scripts e guias de setup/deploy
└── docker-compose.yml    # PostgreSQL local
```

Cada módulo do backend segue **Clean Architecture**: `domain` (entidades e regras), `application` (casos de uso/serviços), `infrastructure` (repositórios e integrações) e `presentation` (controllers e rotas HTTP) — isolando regra de negócio de detalhes de framework e banco.

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite, Zustand, Tailwind |
| Backend | Node.js + TypeScript + Express |
| Banco de dados | PostgreSQL |
| Autenticação | JWT (access curto + refresh token) |
| Armazenamento de arquivos | Local em dev · Supabase Storage em produção |
| Notificação | WhatsApp via Z-API |
| Deploy | Vercel (frontend) + Docker (banco local) |

---

## Rodando localmente

### Pré-requisitos
- [Node.js](https://nodejs.org) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git

### Setup rápido (Windows)

```powershell
.\docs\deploy\setup.ps1
npm run dev
```

O script sobe o PostgreSQL via Docker, instala as dependências da raiz, do backend e do frontend, e aplica o schema do banco.

### Setup manual (qualquer sistema)

```bash
# 1. Dependências
npm install
npm install --prefix backend
npm install --prefix apps/admin

# 2. Banco de dados
docker compose up -d

# 3. Schema
docker exec -i postinder-db psql -U postinder_user -d postinder_db < database/001_initial_schema.sql

# 4. Variáveis de ambiente
cp .env.example .env

# 5. Sobe backend + frontend juntos
npm run dev
```

| Serviço | URL |
|---|---|
| Painel (frontend) | http://localhost:5173 |
| API (backend) | http://localhost:3001 |
| Health check | http://localhost:3001/health |
| PostgreSQL | `localhost:5433` |

### Variáveis de ambiente principais

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL |
| `JWT_SECRET` / `JWT_EXPIRY_MINUTES` / `JWT_REFRESH_EXPIRY_DAYS` | Configuração de autenticação |
| `APP_PUBLIC_URL` | URL usada para gerar os links do portal do cliente |
| `ZAPI_INSTANCE` / `ZAPI_TOKEN` / `ZAPI_CLIENT_TOKEN` | Credenciais da Z-API para envio automático de WhatsApp |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Armazenamento de arquivos em produção |

### Contas de teste (seed local)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `admin@postinder.local` | `Admin@123456` |
| Cliente | `cliente@example.com` | `Cliente@123456` |

---

## Comandos úteis

```bash
npm run build --prefix backend      # build do backend
npm run build --prefix apps/admin   # build do frontend
docker compose down                 # parar o banco
docker compose down -v && docker compose up -d   # resetar o banco (aplique o schema de novo depois)
```

No Windows, `docs\deploy\iniciar.bat` encerra processos antigos nas portas `3001`/`5173` e sobe o projeto com um clique.

---

## Troubleshooting

**`ERR_CONNECTION_REFUSED` no navegador** — o backend não está rodando. Teste `curl http://localhost:3001/health`; se falhar, rode `npm run dev`.

**Docker não sobe** — abra o Docker Desktop e aguarde ficar pronto antes de rodar `docker compose up -d`.

**Login não funciona** — o schema pode não ter sido aplicado. Rode novamente o comando de schema da seção de setup.

**Tela abre mas os dados não carregam** — confirme que frontend (`5173`) e backend (`3001`) estão de pé; em último caso, use `docs\deploy\iniciar.bat`.

---

## Notas para o time

- Não versione o arquivo `.env`.
- O banco local roda via Docker — sem ele, a API não lê nem grava dados.
- Rotinas de manutenção (retenção de posts executados, limpeza de arquivos de clientes inativos, arquivamento por desativação) rodam via migrations versionadas em `database/migrations/`.
