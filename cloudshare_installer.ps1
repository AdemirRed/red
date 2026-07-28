# CloudShare Auto Start Installer
# Este script adiciona o CloudShare à inicialização automática do Windows

param(
    [Parameter()]
    [switch]$Install,
    
    [Parameter()]
    [switch]$Uninstall,
    
    [Parameter()]
    [switch]$Status
)

$ProjectPath = "C:\xampp\htdocs\VideosAulas\Programas\red"
$StartupScript = "$ProjectPath\cloudshare_autostart.bat"
$TaskName = "CloudShare Auto Start"

function Install-CloudShareAutoStart {
    Write-Host "🔧 Instalando CloudShare na inicialização do Windows..." -ForegroundColor Cyan
    
    # Verificar se o script existe
    if (-not (Test-Path $StartupScript)) {
        Write-Host "❌ Script não encontrado: $StartupScript" -ForegroundColor Red
        return $false
    }
    
    try {
        # Criar tarefa agendada para executar na inicialização
        $Action = New-ScheduledTaskAction -Execute $StartupScript
        $Trigger = New-ScheduledTaskTrigger -AtStartup
        $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        
        # Registrar a tarefa
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force
        
        Write-Host "✅ CloudShare adicionado à inicialização automática!" -ForegroundColor Green
        Write-Host "💡 O sistema será iniciado automaticamente quando o Windows ligar." -ForegroundColor Yellow
        return $true
    }
    catch {
        Write-Host "❌ Erro ao instalar: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Uninstall-CloudShareAutoStart {
    Write-Host "🗑️ Removendo CloudShare da inicialização..." -ForegroundColor Cyan
    
    try {
        # Remover tarefa agendada
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        
        Write-Host "✅ CloudShare removido da inicialização automática!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Erro ao desinstalar: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-CloudShareStatus {
    Write-Host "📊 Status do CloudShare Auto Start" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    
    # Verificar tarefa agendada
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($Task) {
        Write-Host "✅ Auto Start: INSTALADO" -ForegroundColor Green
        Write-Host "📅 Última execução: $($Task.LastRunTime)" -ForegroundColor White
        Write-Host "📊 Status: $($Task.State)" -ForegroundColor White
    } else {
        Write-Host "❌ Auto Start: NÃO INSTALADO" -ForegroundColor Red
    }
    
    # Verificar se os processos estão rodando
    Write-Host ""
    Write-Host "🔍 Processos ativos:" -ForegroundColor White
    
    $NodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($NodeProcesses) {
        Write-Host "✅ Node.js: $($NodeProcesses.Count) processo(s) rodando" -ForegroundColor Green
        foreach ($Process in $NodeProcesses) {
            Write-Host "   • PID: $($Process.Id) | CPU: $($Process.CPU) | Memória: $([math]::round($Process.WorkingSet / 1MB, 2)) MB" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Node.js: Nenhum processo rodando" -ForegroundColor Red
    }
    
    # Verificar portas
    Write-Host ""
    Write-Host "🔗 Status das portas:" -ForegroundColor White
    
    $Port8181 = Get-NetTCPConnection -LocalPort 8181 -ErrorAction SilentlyContinue
    if ($Port8181) {
        Write-Host "✅ Backend (8181): ATIVO" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend (8181): INATIVO" -ForegroundColor Red
    }
    
    $Port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue  
    if ($Port3000) {
        Write-Host "✅ Frontend (3000): ATIVO" -ForegroundColor Green
    } else {
        Write-Host "❌ Frontend (3000): INATIVO" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🌐 URLs de acesso:" -ForegroundColor White
    Write-Host "   • Local: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   • Público: http://redblackspy.ddns.net:3000" -ForegroundColor Cyan
    Write-Host "   • API: http://localhost:8181/api/health" -ForegroundColor Cyan
}

# Menu principal
Write-Host ""
Write-Host "===========================================" -ForegroundColor Magenta
Write-Host "    CloudShare Auto Start Manager" -ForegroundColor Magenta  
Write-Host "===========================================" -ForegroundColor Magenta
Write-Host ""

if ($Install) {
    Install-CloudShareAutoStart
} elseif ($Uninstall) {
    Uninstall-CloudShareAutoStart
} elseif ($Status) {
    Show-CloudShareStatus
} else {
    Write-Host "💡 Como usar:" -ForegroundColor Yellow
    Write-Host "   • Instalar:   .\cloudshare_installer.ps1 -Install" -ForegroundColor White
    Write-Host "   • Desinstalar: .\cloudshare_installer.ps1 -Uninstall" -ForegroundColor White  
    Write-Host "   • Status:     .\cloudshare_installer.ps1 -Status" -ForegroundColor White
    Write-Host ""
    
    # Mostrar status atual
    Show-CloudShareStatus
}

Write-Host ""
