@echo off
title CloudShare Pro - Iniciando...
color 0B

echo.
echo ================================================
echo   CloudShare Pro - Sistema Completo
echo ================================================
echo.

REM Executar o script PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0start_cloudshare.ps1"

pause
