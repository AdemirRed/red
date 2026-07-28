# CloudShare Pro - Inicializacao Completa
# Este script inicia o Backend e o Frontend simultaneamente

Write-Host "[CLOUDSHARE] Iniciando sistema completo..." -ForegroundColor Cyan
Write-Host ""

# Verificar se o PostgreSQL esta rodando
Write-Host "[CHECK] Verificando PostgreSQL..." -ForegroundColor Yellow
$postgres = docker ps --filter "name=cloudshare-postgres" --format "{{.Names}}"
if ($postgres -eq "cloudshare-postgres") {
    Write-Host "[OK] PostgreSQL rodando" -ForegroundColor Green
} else {
    Write-Host "[WARNING] PostgreSQL nao encontrado. Tentando iniciar..." -ForegroundColor Yellow
    docker start cloudshare-postgres 2>$null
    if ($?) {
        Write-Host "[OK] PostgreSQL iniciado" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] PostgreSQL nao esta disponivel!" -ForegroundColor Red
        Write-Host "Execute: docker run --name cloudshare-postgres -e POSTGRES_PASSWORD=admin123 -p 9000:5432 -d postgres:15" -ForegroundColor Yellow
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "[CHECK] Verificando dependencias..." -ForegroundColor Yellow

# Verificar dependencias do backend
if (-not (Test-Path "node_modules")) {
    Write-Host "[INSTALL] Instalando dependencias do backend..." -ForegroundColor Yellow
    npm install
}

# Verificar dependencias do frontend
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "[INSTALL] Instalando dependencias do frontend..." -ForegroundColor Yellow
    cd frontend
    npm install
    cd ..
}

Write-Host "[OK] Dependencias verificadas" -ForegroundColor Green
Write-Host ""

# Matar processos Node.js existentes nas portas 8181 e 3000
Write-Host "[CLEANUP] Limpando processos anteriores..." -ForegroundColor Yellow
$ports = @(8181, 3000, 3001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  Encerrando processo na porta $port..." -ForegroundColor Gray
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 1
Write-Host "[OK] Portas liberadas" -ForegroundColor Green
Write-Host ""

# Iniciar Backend
Write-Host "[START] Iniciando Backend (porta 8181)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[BACKEND] CloudShare Backend' -ForegroundColor Blue; Write-Host ''; node server.js" -WindowStyle Normal

# Aguardar backend iniciar
Write-Host "[WAIT] Aguardando backend inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verificar se backend esta rodando
$backendOk = $false
for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8181" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendOk = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($backendOk) {
    Write-Host "[OK] Backend rodando em http://localhost:8181" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Backend pode nao estar respondendo ainda" -ForegroundColor Yellow
}

Write-Host ""

# Iniciar Frontend
Write-Host "[START] Iniciando Frontend (porta 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[FRONTEND] CloudShare Frontend' -ForegroundColor Green; Write-Host ''; cd frontend; npm run dev" -WindowStyle Normal

# Aguardar frontend iniciar
Write-Host "[WAIT] Aguardando frontend inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar se frontend esta rodando
$frontendPort = 3000
$frontendOk = $false
for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$frontendPort" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $frontendOk = $true
            break
        }
    } catch {
        # Tentar porta 3001 se 3000 falhar
        if ($frontendPort -eq 3000) {
            $frontendPort = 3001
        }
        Start-Sleep -Seconds 1
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[SUCCESS] CloudShare Pro iniciado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Status do Sistema:" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8181" -ForegroundColor Blue
Write-Host "  Frontend: http://localhost:$frontendPort" -ForegroundColor Green
Write-Host "  Database: PostgreSQL (porta 9000)" -ForegroundColor Magenta
Write-Host ""
Write-Host "Credenciais padrao:" -ForegroundColor White
Write-Host "  Admin: admin / admin123" -ForegroundColor Gray
Write-Host "  Demo:  demo  / demo123" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador
Write-Host "[BROWSER] Abrindo navegador..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process "http://localhost:$frontendPort"

Write-Host ""
Write-Host "DICA: Mantenha as janelas do Backend e Frontend abertas!" -ForegroundColor Yellow
Write-Host "Para encerrar, feche as janelas ou pressione Ctrl+C em cada uma." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar esta janela..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
