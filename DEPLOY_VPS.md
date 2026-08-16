# 🚀 Guia de Deploy na VPS - CloudShare Pro

## 📋 Informações da VPS

- **IP Público**: 184.107.106.222
- **Porta SSH**: 22
- **Usuário**: root

---

## 🔧 Instalação Completa (Passo a Passo)

### 1️⃣ Conectar na VPS via SSH

```bash
ssh root@184.107.106.222
```

Quando pedir a senha, use a senha fornecida no painel.

---

### 2️⃣ Instalar Docker e Docker Compose

```bash
# Atualizar sistema
apt update -y && apt upgrade -y

# Instalar dependências
apt install -y ca-certificates curl gnupg lsb-release git

# Adicionar repositório oficial do Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update -y
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Iniciar e habilitar Docker
systemctl enable docker
systemctl start docker

# Verificar instalação
docker --version
docker compose version
```

---

### 3️⃣ Baixar o Projeto do GitHub

```bash
# Criar diretório de aplicações
mkdir -p /opt/apps
cd /opt/apps

# Clonar repositório
git clone https://github.com/AdemirRed/red.git cloudshare
cd cloudshare
```

---

### 4️⃣ Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar variáveis (opcional - valores padrão já funcionam)
nano .env
```

**Pressione Ctrl+X, depois Y, depois Enter para salvar.**

---

### 5️⃣ Liberar Portas no Firewall (se UFW estiver ativo)

```bash
# Verificar se firewall está ativo
ufw status

# Se estiver ativo, liberar portas
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Frontend
ufw allow 8181/tcp  # Backend API
ufw reload
```

---

### 6️⃣ Subir os Containers

```bash
# Build e iniciar todos os serviços
docker compose up -d --build

# Aguardar ~30 segundos para tudo iniciar
sleep 30

# Verificar status dos containers
docker compose ps
```

**Você deve ver 3 containers rodando:**
- `cloudshare_postgres` (banco de dados)
- `cloudshare_backend` (API Node.js)
- `cloudshare_frontend` (Interface Nginx)

---

### 7️⃣ Executar Migrações do Banco de Dados

```bash
# Criar tabelas do banco
docker compose exec backend node setup-database.js

# Rodar migrações (se existirem)
docker compose exec backend node migrations.js run
```

---

### 8️⃣ Verificar Logs

```bash
# Ver logs do backend
docker compose logs -f backend

# Ver logs do frontend
docker compose logs -f frontend

# Ver logs do PostgreSQL
docker compose logs -f postgres

# Pressione Ctrl+C para sair dos logs
```

---

## ✅ Testar o Sistema

### No navegador, acesse:

1. **Frontend (Interface Principal)**
   - http://184.107.106.222:3000

2. **Backend API (Health Check)**
   - http://184.107.106.222:8181/api/health

3. **Listar Arquivos**
   - http://184.107.106.222:8181/api/files

### Via terminal (SSH):

```bash
# Testar API health
curl http://localhost:8181/api/health

# Testar listagem de arquivos
curl http://localhost:8181/api/files

# Testar frontend
curl -I http://localhost:3000
```

---

## 🔄 Comandos Úteis

### Ver status dos containers
```bash
docker compose ps
```

### Parar todos os serviços
```bash
docker compose down
```

### Reiniciar apenas o backend
```bash
docker compose restart backend
```

### Reiniciar apenas o frontend
```bash
docker compose restart frontend
```

### Ver uso de recursos
```bash
docker stats
```

### Atualizar o projeto (depois de git push)
```bash
cd /opt/apps/cloudshare
git pull
docker compose down
docker compose up -d --build
```

### Backup do banco de dados
```bash
docker compose exec postgres pg_dump -U postgres cloudshare_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar backup
```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres cloudshare_db
```

### Limpar volumes (CUIDADO: apaga dados!)
```bash
docker compose down -v
```

---

## 🐛 Resolução de Problemas

### Frontend não abre (erro de conexão)

```bash
# Verificar se container está rodando
docker compose ps

# Ver logs do frontend
docker compose logs frontend

# Reiniciar frontend
docker compose restart frontend
```

### Backend retorna erro 500

```bash
# Ver logs detalhados
docker compose logs --tail=200 backend

# Verificar se banco está acessível
docker compose exec backend ping postgres

# Recriar banco (APAGA DADOS!)
docker compose down
docker volume rm cloudshare_postgres_data
docker compose up -d
docker compose exec backend node setup-database.js
```

### Porta já em uso

```bash
# Ver o que está usando a porta 3000
lsof -i :3000

# Ou
netstat -tulpn | grep 3000

# Matar processo (substitua PID pelo número real)
kill -9 PID
```

### Containers não sobem

```bash
# Ver logs de erro
docker compose logs

# Recriar containers
docker compose down
docker compose up -d --force-recreate
```

---

## 🔒 Segurança Pós-Instalação

### 1. Trocar senha de root
```bash
passwd
```

### 2. Criar usuário não-root
```bash
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy
```

### 3. Desabilitar login root via SSH (opcional)
```bash
nano /etc/ssh/sshd_config
# Alterar: PermitRootLogin no
systemctl restart sshd
```

### 4. Instalar Fail2Ban (proteção contra brute force)
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

## 🌐 Configurar Domínio (Opcional)

Se você tiver um domínio apontando para a VPS:

### 1. Instalar Nginx como Proxy Reverso
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2. Criar configuração do site
```bash
nano /etc/nginx/sites-available/cloudshare
```

Cole este conteúdo (substitua `seudominio.com`):

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Ativar site e SSL
```bash
ln -s /etc/nginx/sites-available/cloudshare /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Obter certificado SSL (Let's Encrypt)
certbot --nginx -d seudominio.com -d www.seudominio.com
```

---

## 📊 Monitoramento

### Ver uso de disco
```bash
df -h
```

### Ver uso de memória
```bash
free -h
```

### Ver processos
```bash
htop  # Instale com: apt install htop
```

### Logs do sistema
```bash
journalctl -xe
```

---

## 📞 Credenciais Padrão do Sistema

Após instalação, você pode fazer login com:

| Usuário | Senha | Tipo |
|---------|-------|------|
| admin | admin123 | Administrador |
| demo | demo123 | Usuário Normal |

**⚠️ IMPORTANTE: Troque as senhas após o primeiro login!**

---

## ✅ Checklist de Instalação

- [ ] Docker e Docker Compose instalados
- [ ] Projeto clonado do GitHub
- [ ] Arquivo .env configurado
- [ ] Firewall configurado
- [ ] Containers rodando (`docker compose ps`)
- [ ] Banco de dados migrado
- [ ] Frontend acessível em http://184.107.106.222:3000
- [ ] Backend respondendo em http://184.107.106.222:8181/api/health
- [ ] Login funcionando
- [ ] Upload de arquivo funcionando
- [ ] Senha de root trocada
- [ ] Backups configurados (opcional)
- [ ] Domínio e SSL configurados (opcional)

---

**Desenvolvido com ❤️ para CloudShare Pro**
