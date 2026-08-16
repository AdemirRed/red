#!/bin/bash

# Script de Deploy Automático - CloudShare Pro
# Uso: bash deploy-vps.sh

set -e

echo "🚀 CloudShare Pro - Deploy Automático na VPS"
echo "=============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para printar mensagens coloridas
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    print_error "Este script precisa ser executado como root"
    echo "Use: sudo bash deploy-vps.sh"
    exit 1
fi

print_info "Verificando se Docker está instalado..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    print_info "Docker não encontrado. Instalando..."
    
    # Instalar Docker
    apt update -y
    apt install -y ca-certificates curl gnupg lsb-release
    
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    systemctl enable docker
    systemctl start docker
    
    print_success "Docker instalado com sucesso!"
else
    print_success "Docker já está instalado"
fi

# Verificar se o projeto já existe
if [ ! -d "/opt/apps/cloudshare" ]; then
    print_info "Clonando projeto do GitHub..."
    mkdir -p /opt/apps
    cd /opt/apps
    git clone https://github.com/AdemirRed/red.git cloudshare
    print_success "Projeto clonado!"
else
    print_info "Atualizando projeto..."
    cd /opt/apps/cloudshare
    git pull
    print_success "Projeto atualizado!"
fi

cd /opt/apps/cloudshare

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    print_info "Criando arquivo .env..."
    cp .env.example .env
    print_success "Arquivo .env criado!"
else
    print_info "Arquivo .env já existe"
fi

# Parar containers antigos (se existirem)
print_info "Parando containers antigos..."
docker compose down 2>/dev/null || true

# Construir e iniciar containers
print_info "Construindo e iniciando containers..."
docker compose up -d --build

# Aguardar containers iniciarem
print_info "Aguardando containers iniciarem (30 segundos)..."
sleep 30

# Verificar status dos containers
print_info "Verificando status dos containers..."
docker compose ps

# Executar setup do banco de dados
print_info "Configurando banco de dados..."
docker compose exec -T backend node setup-database.js || print_error "Erro ao configurar banco (pode ser normal se já estiver configurado)"

# Executar migrações
print_info "Executando migrações..."
docker compose exec -T backend node migrations.js run || print_error "Erro nas migrações (pode ser normal se já estiverem aplicadas)"

echo ""
echo "=============================================="
print_success "Deploy concluído com sucesso!"
echo "=============================================="
echo ""
echo "📋 Informações de Acesso:"
echo ""
echo "Frontend: http://$(curl -s ifconfig.me):3000"
echo "Backend:  http://$(curl -s ifconfig.me):8181/api/health"
echo ""
echo "Credenciais padrão:"
echo "  Admin: admin / admin123"
echo "  Demo:  demo / demo123"
echo ""
echo "Comandos úteis:"
echo "  Ver logs:      docker compose logs -f"
echo "  Parar:         docker compose down"
echo "  Reiniciar:     docker compose restart"
echo "  Atualizar:     bash deploy-vps.sh"
echo ""
print_info "Não esqueça de trocar as senhas padrão após o primeiro login!"
echo ""
