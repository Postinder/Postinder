# Postinder v2.0

Plataforma para agencias de marketing criarem posts com arquivos e enviarem para aprovacao dos clientes.

O admin cria clientes e postagens. O cliente acessa a area de aprovacao e aprova ou reprova cada arquivo.

## O que precisa instalar

Antes de rodar o projeto, instale:

1. **Node.js 18 ou superior**
   - Baixe em: https://nodejs.org
   - Depois de instalar, abra o terminal e confira:

```bash
node -v
npm -v
```

2. **Docker Desktop**
   - Baixe em: https://www.docker.com/products/docker-desktop/
   - Abra o Docker Desktop antes de rodar o projeto.

3. **Git**
   - Baixe em: https://git-scm.com/downloads

4. **Editor de codigo**
   - Recomendado: VS Code

## Estrutura do projeto

```text
postinder/
├── apps/admin/                # Tela web em React
├── backend/                   # API em Express + TypeScript
├── database/                  # Schema do banco PostgreSQL
├── docker-compose.yml         # Configuracao do banco local
├── setup.ps1                  # Setup automatico no Windows/PowerShell
├── iniciar.bat                # Atalho para iniciar o projeto no Windows
└── README.md
```

## Rodar pela primeira vez

### Opcao facil no Windows

Abra o PowerShell na pasta do projeto e rode:

```powershell
.\setup.ps1
```

Esse script faz:

- sobe o PostgreSQL no Docker;
- instala dependencias da raiz, backend e frontend;
- aplica o schema do banco;
- deixa tudo pronto para rodar.

Depois rode:

```bash
npm run dev
```

### Opcao manual

1. Instale as dependencias:

```bash
npm install
npm install --prefix backend
npm install --prefix apps/admin
```

2. Suba o banco de dados:

```bash
docker compose up -d
```

3. Aplique o schema do banco:

No PowerShell:

```powershell
Get-Content database\001_initial_schema.sql | docker exec -i postinder-db psql -U postinder_user -d postinder_db
```

No Git Bash ou terminal Linux/macOS:

```bash
docker exec -i postinder-db psql -U postinder_user -d postinder_db < database/001_initial_schema.sql
```

4. Rode o projeto:

```bash
npm run dev
```

## Acessos locais

Com o projeto rodando:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check da API: http://localhost:3001/health

## Variaveis de ambiente

Copie `.env.example` para `.env` e confira os valores principais:

- `DATABASE_URL`: conexao com o PostgreSQL local.
- `JWT_SECRET`: chave usada para login.
- `APP_PUBLIC_URL`: URL usada pelo backend para enviar a area de aprovacao ao cliente.
- `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`: dados da Z-API para envio automatico de WhatsApp.

Em desenvolvimento local, `APP_PUBLIC_URL` deve ficar como `http://localhost:5173`. Quando fizer deploy, troque pela URL real do site.

## Logins de teste

Admin:

- E-mail: `admin@postinder.local`
- Senha: `Admin@123456`

Cliente:

- E-mail: `cliente@example.com`
- Senha: `Cliente@123456`

## Como iniciar no dia a dia

Se ja fez o setup uma vez, normalmente basta:

```bash
docker compose up -d
npm run dev
```

No Windows, tambem pode dar dois cliques em:

```text
iniciar.bat
```

Ele encerra processos antigos nas portas `3001` e `5173` e inicia o projeto.

## Portas usadas

- `5173`: site/admin React
- `3001`: API backend
- `5433`: PostgreSQL local via Docker

Se alguma dessas portas estiver ocupada, feche o processo antigo ou use o `iniciar.bat`.

## Comandos uteis

Build do backend:

```bash
npm run build --prefix backend
```

Build do frontend:

```bash
npm run build --prefix apps/admin
```

Parar o banco:

```bash
docker compose down
```

Resetar o banco completamente:

```bash
docker compose down -v
docker compose up -d
```

Depois aplique o schema de novo.

## Problemas comuns

### `ERR_CONNECTION_REFUSED` no navegador

O backend provavelmente nao esta rodando.

Confira:

```bash
curl http://localhost:3001/health
```

Se falhar, rode:

```bash
npm run dev
```

### Docker nao sobe

Abra o Docker Desktop e espere ele ficar pronto. Depois rode:

```bash
docker compose up -d
```

### Login nao funciona

Verifique se o schema foi aplicado no banco. Rode novamente:

```powershell
Get-Content database\001_initial_schema.sql | docker exec -i postinder-db psql -U postinder_user -d postinder_db
```

### Tela abre, mas dados nao carregam

Confirme se frontend e backend estao nas portas certas:

- http://localhost:5173
- http://localhost:3001/health

Se necessario, pare tudo e rode `iniciar.bat`.

## Observacoes para o time

- Nao precisa mexer em `node_modules`.
- Nao envie arquivos `.env` para o Git.
- Arquivos `.log` sao gerados localmente e podem ser apagados.
- O banco local roda no Docker; sem Docker, a API nao consegue salvar ou buscar dados.
