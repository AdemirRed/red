# 🚀 CloudShare Auto Start System

Sistema de inicialização automática para o CloudShare que permite que o backend e frontend sejam iniciados automaticamente junto com o Windows.

## 📁 Arquivos Criados

### Scripts de Inicialização
- `start_backend.bat` - Inicia o servidor backend (porta 8181)
- `start_frontend.bat` - Inicia o servidor frontend (porta 3000)
- `cloudshare_autostart.bat` - Script mestre que inicia ambos os serviços

### Instaladores
- `install_autostart.bat` - Instalador simples com menu interativo
- `cloudshare_installer.ps1` - Instalador PowerShell avançado (requer privilégios)

## 🔧 Como Instalar Auto Start

### Método 1: Instalador Simples (Recomendado)
1. Execute `install_autostart.bat` como administrador
2. Escolha a opção `[1] Instalar Auto Start`
3. O sistema será adicionado à pasta Startup do Windows

### Método 2: Instalador PowerShell (Avançado)
```powershell
# Executar como administrador
.\cloudshare_installer.ps1 -Install
```

### Método 3: Manual
1. Pressione `Win + R` e digite `shell:startup`
2. Copie o arquivo `cloudshare_autostart.bat` para a pasta que abriu
3. Reinicie o Windows

## 🌐 URLs de Acesso

Após a instalação, o sistema estará disponível em:

- **Local**: http://localhost:3000
- **Rede Local**: http://[SEU-IP]:3000
- **Público**: http://redblackspy.ddns.net:3000
- **API Backend**: http://localhost:8181/api/health

## 📊 Verificar Status

### Via Instalador
Execute `install_autostart.bat` e escolha `[3] Ver Status`

### Via PowerShell
```powershell
.\cloudshare_installer.ps1 -Status
```

### Via Linha de Comando
```cmd
# Verificar processos Node.js
tasklist /fi "imagename eq node.exe"

# Verificar portas ativas
netstat -an | findstr :8181
netstat -an | findstr :3000
```

## 🛠️ Gerenciamento

### Parar Todos os Serviços
```cmd
taskkill /im node.exe /f
```

### Reiniciar Manualmente
Execute `cloudshare_autostart.bat`

### Desinstalar Auto Start
1. Execute `install_autostart.bat`
2. Escolha `[2] Desinstalar Auto Start`

## 📝 Logs

Os logs são salvos automaticamente em:
- `logs/backend.log` - Log do servidor backend
- `logs/frontend.log` - Log do servidor frontend

### Visualizar Logs
```cmd
# Backend
type logs\backend.log

# Frontend  
type logs\frontend.log

# Monitorar em tempo real
powershell Get-Content logs\backend.log -Wait
```

## ⚙️ Configurações

### Portas Utilizadas
- **Backend**: 8181
- **Frontend**: 3000

### Configurações de CORS
O backend está configurado para aceitar requisições de:
- `http://localhost:3000`
- `http://127.0.0.1:3000`  
- `http://redblackspy.ddns.net:3000`
- `https://redblackspy.ddns.net:3000`

### Configurações do Vite
O frontend aceita conexões de:
- `localhost`
- `127.0.0.1`
- `redblackspy.ddns.net`

## 🔄 Reinicialização Automática

Os scripts incluem reinicialização automática em caso de crash:
- Se um serviço parar inesperadamente, será reiniciado automaticamente em 5 segundos
- Os logs mostrarão quando ocorrem reinicializações

## 🚨 Solução de Problemas

### Porta já está em uso
```cmd
# Encontrar processo usando a porta
netstat -ano | findstr :8181
netstat -ano | findstr :3000

# Finalizar processo específico
taskkill /pid [PID] /f
```

### Node.js não encontrado
1. Instale o Node.js: https://nodejs.org/
2. Reinicie o prompt de comando
3. Verifique: `node --version`

### Dependências não instaladas
```cmd
cd C:\xampp\htdocs\VideosAulas\Programas\red\frontend
npm install
```

### Permissões insuficientes
Execute os instaladores como administrador:
- Clique direito → "Executar como administrador"

## 📋 Checklist de Instalação

- [ ] Node.js instalado
- [ ] Dependências instaladas (`npm install`)
- [ ] Portas 3000 e 8181 disponíveis
- [ ] Auto start configurado
- [ ] Testado após reinicialização

## 💡 Dicas

1. **Performance**: Os serviços consomem recursos. Monitore o uso de CPU/RAM.
2. **Firewall**: Certifique-se que as portas 3000 e 8181 estão liberadas.
3. **Updates**: Após atualizações do código, reinicie os serviços.
4. **Backup**: Mantenha backup dos arquivos de configuração.

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs em `logs/`
2. Execute o status: `install_autostart.bat` → `[3] Ver Status`
3. Teste manualmente: `cloudshare_autostart.bat`

---

🎉 **CloudShare Auto Start System** - Configurado com sucesso!
