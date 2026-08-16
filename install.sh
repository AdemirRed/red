#!/bin/bash
# CloudShare Pro - Instalação Rápida
# Execute: curl -sSL https://raw.githubusercontent.com/AdemirRed/red/main/install.sh | bash

set -e

echo "🚀 CloudShare Pro - Instalação Automática"
echo "=========================================="

# 1. Clonar repositório
if [ ! -d "/opt/cloudshare" ]; then
    git clone https://github.com/AdemirRed/red.git /opt/cloudshare
fi

cd /opt/cloudshare

# 2. Executar deploy
bash deploy-vps.sh
