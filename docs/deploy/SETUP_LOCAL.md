# Setup local

## Primeira execucao

```powershell
.\docs\deploy\setup.ps1
npm run dev
```

O script sobe o PostgreSQL local, instala dependencias, aplica migrations e executa a seed demo explicita. Para uma instalacao sem dados demo, siga o fluxo manual no [README](../../README.md) e nao execute `db:seed-demo`.

## Dia a dia

```bash
docker compose up -d
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`

O banco deve ser atualizado somente com `npm run db:migrate` em `backend`. Consulte o [README](../../README.md) para credenciais demo e variaveis de ambiente.
