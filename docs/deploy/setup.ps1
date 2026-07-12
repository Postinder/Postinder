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

Write-Host "`n3. Aplicando migrations estruturais..." -ForegroundColor Cyan
Push-Location backend
npm.cmd run db:migrate

Write-Host "`n4. Criando dados de demonstracao..." -ForegroundColor Cyan
$env:APP_MODE = "demo"
npm.cmd run db:seed-demo
Pop-Location

Write-Host "`nSetup concluido." -ForegroundColor Green
Write-Host "Rode: npm run dev" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3001"
