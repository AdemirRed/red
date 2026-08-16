# 🚀 INSTALAÇÃO RÁPIDA - CloudShare Pro na VPS
# Copie e cole cada bloco de comandos na VPS

# ==============================================
# 1. CONECTAR NA VPS
# ==============================================
ssh root@184.107.106.222
# Senha: BnR4xAyJrSi6M6bE


# ==============================================
# 2. INSTALAR DOCKER (se ainda não tiver)
# ==============================================
apt update -y && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release git

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


# ==============================================
# 3. BAIXAR O PROJETO
# ==============================================
mkdir -p /opt/apps
cd /opt/apps
git clone https://github.com/AdemirRed/red.git cloudshare
cd cloudshare


# ==============================================
# 4. CONFIGURAR VARIÁVEIS DE AMBIENTE
# ==============================================
cp .env.example .env
# (Os valores padrão já funcionam, não precisa editar agora)


# ==============================================
# 5. LIBERAR PORTAS NO FIREWALL (se necessário)
# ==============================================
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 8181/tcp
ufw reload


# ==============================================
# 6. SUBIR O SISTEMA (ESTE É O COMANDO PRINCIPAL)
# ==============================================
docker compose up -d --build


# ==============================================
# 7. AGUARDAR E CONFIGURAR BANCO
# ==============================================
sleep 30
docker compose exec backend node setup-database.js


# ==============================================
# 8. VERIFICAR SE ESTÁ FUNCIONANDO
# ==============================================
docker compose ps
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend

curl http://localhost:8181/api/health
curl http://localhost:3000


# ==============================================
# ✅ PRONTO! AGORA ACESSE NO NAVEGADOR:
# ==============================================
# Frontend: http://184.107.106.222:3000
# Backend:  http://184.107.106.222:8181/api/health

# Login padrão:
# Usuário: admin
# Senha: admin123


# ==============================================
# 🔄 COMANDOS ÚTEIS
# ==============================================

# Ver logs em tempo real:
docker compose logs -f

# Parar tudo:
docker compose down

# Reiniciar:
docker compose restart

# Atualizar código do GitHub:
cd /opt/apps/cloudshare
git pull
docker compose down
docker compose up -d --build

# Ver quanto de memória/CPU está usando:
docker stats

# Apagar tudo e recomeçar (CUIDADO: apaga dados!):
docker compose down -v
docker compose up -d --build
docker compose exec backend node setup-database.js
