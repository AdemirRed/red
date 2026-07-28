@echo off
title CloudShare Backend Server
echo ==========================================
echo    CloudShare Backend Auto Start
echo ==========================================
echo.

:: Navegar para o diretório do projeto
cd /d "C:\xampp\htdocs\VideosAulas\Programas\red"

:: Verificar se o Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado! Instale o Node.js primeiro.
    pause
    exit /b 1
)

:: Aguardar um pouco para o sistema inicializar completamente
echo ⏳ Aguardando inicialização do sistema (10 segundos)...
timeout /t 10 /nobreak >nul

:: Verificar se a porta 8181 já está em uso
netstat -an | findstr :8181 >nul
if not errorlevel 1 (
    echo ⚠️ Porta 8181 já está em uso. Tentando finalizar processo anterior...
    taskkill /im node.exe /f >nul 2>&1
    timeout /t 3 /nobreak >nul
)

:: Iniciar o backend
echo 🚀 Iniciando CloudShare Backend Server...
echo 📍 Porta: 8181
echo 🌐 CORS configurado para: redblackspy.ddns.net:3000
echo.

:: Executar o servidor em loop para reiniciar automaticamente se crashar
:restart
echo [%date% %time%] Iniciando servidor...
node server.js
echo.
echo ⚠️ Servidor parou inesperadamente!
echo ⏳ Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto restart
