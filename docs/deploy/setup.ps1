$ErrorActionPreference = "Stop"

Write-Host "Postinder v2.0 - setup local reproduzivel" -ForegroundColor Green

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

Write-Host "`n1. Subindo PostgreSQL..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar o PostgreSQL." }
Start-Sleep -Seconds 5

function Invoke-NpmCleanInstall {
  param([Parameter(Mandatory = $true)][string]$Directory)

  Push-Location $Directory
  try {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci falhou em $Directory." }
  } finally {
    Pop-Location
  }
}

Write-Host "`n2. Instalando dependencias pelos lockfiles..." -ForegroundColor Cyan
Invoke-NpmCleanInstall $projectRoot
Invoke-NpmCleanInstall (Join-Path $projectRoot "backend")
Invoke-NpmCleanInstall (Join-Path $projectRoot "apps\admin")

Write-Host "`n3. Aplicando migrations estruturais..." -ForegroundColor Cyan
Push-Location backend
try {
  npm.cmd run db:migrate
  if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar migrations estruturais." }

  Write-Host "`n4. Criando dados de demonstracao..." -ForegroundColor Cyan
  $env:APP_MODE = "demo"
  npm.cmd run db:seed-demo
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar dados de demonstracao." }
} finally {
  Pop-Location
}

Write-Host "`nSetup concluido." -ForegroundColor Green
Write-Host "Rode: npm run dev" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3001"
