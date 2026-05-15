# Setup Local Rapido

Este arquivo e um resumo. O guia completo esta no `README.md`.

## Primeira vez

No PowerShell:

```powershell
.\setup.ps1
```

Depois:

```bash
npm run dev
```

## Dia a dia

```bash
docker compose up -d
npm run dev
```

Ou, no Windows, use:

```text
iniciar.bat
```

## URLs

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

## Credenciais

Admin:

- `admin@postinder.local`
- `Admin@123456`

Cliente:

- `cliente@example.com`
- `Cliente@123456`
