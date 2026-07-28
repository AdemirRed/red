@echo off
title Instalador CloudShare Auto Start
cls
echo.
echo ==========================================
echo    CloudShare Auto Start Installer
echo ==========================================
echo.
echo Este instalador vai configurar o CloudShare para
echo iniciar automaticamente com o Windows.
echo.
echo 📁 Local: C:\xampp\htdocs\VideosAulas\Programas\red
echo 🌐 Frontend: redblackspy.ddns.net:3000  
echo 🔗 Backend: localhost:8181
echo.
echo Escolha uma opção:
echo.
echo [1] Instalar Auto Start
echo [2] Desinstalar Auto Start  
echo [3] Ver Status
echo [4] Testar Sistema Agora
echo [5] Sair
echo.
set /p choice="Digite sua escolha (1-5): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto test
if "%choice%"=="5" goto exit
goto menu

:install
echo.
echo 🔧 Instalando CloudShare Auto Start...
echo.

:: Criar atalho na pasta Startup do usuário
set startup_folder=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set shortcut_path=%startup_folder%\CloudShare Auto Start.lnk
set target_path=%~dp0cloudshare_autostart.bat

:: Usar PowerShell para criar o atalho
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcut_path%'); $Shortcut.TargetPath = '%target_path%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save()"

if exist "%shortcut_path%" (
    echo ✅ Auto Start instalado com sucesso!
    echo 📍 Local: %shortcut_path%
    echo 💡 O CloudShare será iniciado automaticamente na próxima inicialização.
) else (
    echo ❌ Erro ao instalar Auto Start!
)

echo.
pause
goto menu

:uninstall
echo.
echo 🗑️ Desinstalando CloudShare Auto Start...
echo.

set startup_folder=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set shortcut_path=%startup_folder%\CloudShare Auto Start.lnk

if exist "%shortcut_path%" (
    del "%shortcut_path%"
    echo ✅ Auto Start desinstalado com sucesso!
) else (
    echo ❌ Auto Start não estava instalado.
)

echo.
pause
goto menu

:status
echo.
echo 📊 Status do CloudShare
echo ======================
echo.

:: Verificar se o atalho existe
set startup_folder=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set shortcut_path=%startup_folder%\CloudShare Auto Start.lnk

if exist "%shortcut_path%" (
    echo ✅ Auto Start: INSTALADO
    echo 📍 Local: %shortcut_path%
) else (
    echo ❌ Auto Start: NÃO INSTALADO
)

echo.
echo 🔍 Processos Node.js ativos:
tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe" >nul
if errorlevel 1 (
    echo ❌ Nenhum processo Node.js rodando
) else (
    echo ✅ Node.js está rodando
    tasklist /fi "imagename eq node.exe"
)

echo.
echo 🔗 Status das portas:
netstat -an | findstr :8181 >nul
if errorlevel 1 (
    echo ❌ Backend (8181): INATIVO
) else (
    echo ✅ Backend (8181): ATIVO
)

netstat -an | findstr :3000 >nul
if errorlevel 1 (
    echo ❌ Frontend (3000): INATIVO
) else (
    echo ✅ Frontend (3000): ATIVO
)

echo.
echo 🌐 URLs de acesso:
echo    • Local: http://localhost:3000
echo    • Público: http://redblackspy.ddns.net:3000
echo    • API: http://localhost:8181/api/health
echo.
pause
goto menu

:test
echo.
echo 🧪 Testando CloudShare System...
echo.
call cloudshare_autostart.bat
goto menu

:menu
cls
echo.
echo ==========================================
echo    CloudShare Auto Start Installer
echo ==========================================
echo.
echo Este instalador vai configurar o CloudShare para
echo iniciar automaticamente com o Windows.
echo.
echo 📁 Local: C:\xampp\htdocs\VideosAulas\Programas\red
echo 🌐 Frontend: redblackspy.ddns.net:3000  
echo 🔗 Backend: localhost:8181
echo.
echo Escolha uma opção:
echo.
echo [1] Instalar Auto Start
echo [2] Desinstalar Auto Start  
echo [3] Ver Status
echo [4] Testar Sistema Agora
echo [5] Sair
echo.
set /p choice="Digite sua escolha (1-5): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto status
if "%choice%"=="4" goto test
if "%choice%"=="5" goto exit
goto menu

:exit
echo.
echo 👋 Obrigado por usar o CloudShare!
echo.
pause
exit
