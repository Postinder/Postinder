# ═══════════════════════════════════════════════════════════════════
# Postinder v2.0 - Setup Local Automático
# ═══════════════════════════════════════════════════════════════════

Write-Host "🚀 Iniciando setup do Postinder v2.0..." -ForegroundColor Green

# 1. Subir Docker Compose
Write-Host "`n📦 Iniciando PostgreSQL com Docker..." -ForegroundColor Cyan
docker-compose up -d
Start-Sleep -Seconds 5

# 2. Setup Backend
Write-Host "`n🔧 Setup Backend..." -ForegroundColor Cyan
if (-Not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "✅ Arquivo .env criado no backend"
}

Set-Location backend
npm install
Set-Location ..

# 3. Setup Frontend
Write-Host "`n🎨 Setup Frontend..." -ForegroundColor Cyan
if (-Not (Test-Path "apps\admin\.env")) {
    Copy-Item "apps\admin\.env.example" "apps\admin\.env"
    Write-Host "✅ Arquivo .env criado no frontend"
}

Set-Location apps/admin
npm install
Set-Location ../..

# 4. Criar banco de dados
Write-Host "`n📊 Criando schema do banco..." -ForegroundColor Cyan
$dbScript = Get-Content "database\001_initial_schema.sql"
docker exec -i postinder-db psql -U postinder_user -d postinder_db -c "$dbScript"

Write-Host "`n✅ Setup completo!`n" -ForegroundColor Green

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           Próximos Passos                                  ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  1. Terminal 1: npm run dev (backend)                      ║" -ForegroundColor Green
Write-Host "║     cd backend && npm run dev                              ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║  2. Terminal 2: npm run dev (frontend)                     ║" -ForegroundColor Green
Write-Host "║     cd apps/admin && npm run dev                           ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║  3. Acessar: http://localhost:5173                         ║" -ForegroundColor Green
Write-Host "║     Email: admin@postinder.local                           ║" -ForegroundColor Green
Write-Host "║     Senha: Admin@123456                                    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
