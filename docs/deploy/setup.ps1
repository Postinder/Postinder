Write-Host "Postinder v2.0 - setup local" -ForegroundColor Green

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

Write-Host "`n1. Subindo PostgreSQL..." -ForegroundColor Cyan
docker compose up -d
Start-Sleep -Seconds 5

Write-Host "`n2. Instalando dependencias..." -ForegroundColor Cyan
npm install
npm install --prefix backend
npm install --prefix apps/admin

Write-Host "`n3. Aplicando schema do banco..." -ForegroundColor Cyan
Get-Content "database\001_initial_schema.sql" | docker exec -i postinder-db psql -U postinder_user -d postinder_db

Write-Host "`nSetup concluido." -ForegroundColor Green
Write-Host "Rode: npm run dev" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3001"
