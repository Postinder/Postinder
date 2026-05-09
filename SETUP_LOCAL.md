# 🚀 Setup Local - Postinder v2.0

## Pré-requisitos
- Docker Desktop instalado
- Node.js 18+ instalado
- Git

## 1️⃣ Subir Banco de Dados (PostgreSQL)

```bash
# Na raiz do projeto
docker-compose up -d

# Verificar se está rodando
docker ps
```

Credenciais:
- **User:** `postinder_user`
- **Password:** `postinder_pass`
- **Database:** `postinder_db`
- **Host:** `localhost:5432`

---

## 2️⃣ Setup Backend

```bash
cd backend

# Copiar .env.example para .env
cp .env.example .env

# Instalar dependências
npm install

# Rodar migrations (se usar um script de migration)
npm run migrate

# Iniciar servidor de desenvolvimento
npm run dev
```

Backend rodará em **http://localhost:3001**

---

## 3️⃣ Setup Frontend

```bash
cd apps/admin

# Copiar .env.example para .env
cp .env.example .env

# Instalar dependências
npm install

# Iniciar dev server
npm run dev
```

Frontend rodará em **http://localhost:5173**

---

## 🔐 Credenciais de Teste

| Tipo | Email | Senha |
|---|---|---|
| **Admin** | admin@postinder.local | Admin@123456 |
| **Cliente** | cliente@example.com | Cliente@123456 |

---

## ✅ Testes

1. Abra http://localhost:5173
2. Faça login com `admin@postinder.local` / `Admin@123456`
3. Navegue pelas funcionalidades
4. Teste criar um post, cliente, etc.

---

## 🐛 Troubleshooting

### Erro: "Connection refused" no backend
```bash
# Verificar se PostgreSQL está rodando
docker ps

# Se não estiver, subir novamente
docker-compose up -d
```

### Erro: "DATABASE_URL not found"
```bash
# Verificar se .env existe no backend
ls backend/.env

# Se não existir, copiar do .env.example
cp backend/.env.example backend/.env
```

### Resetar banco de dados
```bash
# Parar containers
docker-compose down

# Deletar volume de dados
docker volume rm postinder_postgres_data

# Subir novamente
docker-compose up -d
```

---

## 🌍 Deploy Depois (Render ou Railway)

Quando quiser hospedar:
1. Fazer push no GitHub
2. Conectar repositório no Render/Railway
3. Configurar variáveis de ambiente (DATABASE_URL, JWT_SECRET, etc)
4. Deploy automático

**Custos:**
- **Render:** Gratuito (com limitações)
- **Railway:** ~US$5/mês (melhor performance)

