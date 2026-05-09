# Postinder Backend

Professional backend for Postinder SaaS platform.

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env with your Supabase credentials
pnpm run dev
```

## Architecture

- **modules/** — Domain-driven modules (posts, auth, approvals, clients, users)
- **shared/** — Shared utilities (middlewares, exceptions, database client)
- **config/** — Environment and app configuration

Each module follows Clean Architecture: domain → application → presentation → infrastructure

## API

Base URL: http://localhost:3001/api/v1

See individual module READMEs for endpoint documentation.
