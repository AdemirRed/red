@echo off
title CloudShare Frontend Server  
echo ==========================================
echo    CloudShare Frontend Auto Start
echo ==========================================
echo.

:: Navegar para o diretório do frontend
cd /d "C:\xampp\htdocs\VideosAulas\Programas\red\frontend"

:: Verificar se o Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado! Instale o Node.js primeiro.
    pause
    exit /b 1
)

:: Verificar se o npm está instalado
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ NPM não encontrado! Instale o Node.js primeiro.
    pause
    exit /b 1
)

:: Aguardar o backend inicializar primeiro
echo ⏳ Aguardando backend inicializar (15 segundos)...
timeout /t 15 /nobreak >nul

:: Verificar se a porta 3000 já está em uso
netstat -an | findstr :3000 >nul
if not errorlevel 1 (
    echo ⚠️ Porta 3000 já está em uso. Tentando finalizar processo anterior...
    taskkill /f /im node.exe >nul 2>&1
    timeout /t 3 /nobreak >nul
)

:: Verificar se node_modules existe
if not exist "node_modules" (
    echo 📦 Instalando dependências...
    npm install
    if errorlevel 1 (
        echo ❌ Erro ao instalar dependências!
        pause
        exit /b 1
    )
)

:: Iniciar o frontend
echo 🚀 Iniciando CloudShare Frontend Server...
echo 📍 Porta: 3000  
echo 🌐 Acesso público: redblackspy.ddns.net:3000
echo 🔄 Proxy para backend: localhost:8181
echo.

:: Executar o servidor em loop para reiniciar automaticamente se crashar
:restart
echo [%date% %time%] Iniciando frontend...
yarn dev --host 0.0.0.0 --port 3000
echo.
echo ⚠️ Frontend parou inesperadamente!
echo ⏳ Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto restart
