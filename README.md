# ☁️ CloudShare Pro

Sistema profissional de compartilhamento de arquivos com autenticação, quotas por usuário, pastas públicas e interface administrativa.

![CloudShare Pro](https://img.shields.io/badge/version-2.0.0-blue)
![Docker](https://img.shields.io/badge/docker-ready-green)
![License](https://img.shields.io/badge/license-MIT-green)

## ⚡ Instalação Rápida (3 comandos!)

```bash
git clone https://github.com/AdemirRed/red.git /opt/cloudshare
cd /opt/cloudshare
docker compose up -d && sleep 30 && docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250801235845_initial_schema.sql && docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250801235934_default_users.sql && docker compose restart backend
```

**Acesse:** `http://SEU-IP:3000` | **Login:** `admin` / `admin123`

---

## 📋 Índice

- [Recursos](#-recursos)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [Comandos Úteis](#-comandos-úteis)
- [Troubleshooting](#-troubleshooting)
- [Atualização](#-atualização)

---

## ✨ Recursos

- ✅ **Autenticação JWT** - Login seguro com tokens
- ✅ **Múltiplos usuários** - Admin, usuários normais e premium
- ✅ **Quotas individuais** - Limite de armazenamento por usuário
- ✅ **Pasta pública** - Compartilhamento sem login
- ✅ **Interface admin** - Gerenciamento completo de usuários
- ✅ **Upload drag & drop** - Interface moderna
- ✅ **Visualização de arquivos** - Prévia de imagens, vídeos, PDFs
- ✅ **Logs de atividade** - Auditoria completa
- ✅ **Responsivo** - Funciona em mobile e desktop
- ✅ **Docker ready** - Deploy em 3 comandos

---

## 🖥️ Requisitos

- **VPS/Servidor** com Ubuntu 20.04+ ou Debian 11+
- **Docker** 20.10+ e **Docker Compose** 2.0+
- **2 GB RAM** mínimo (4 GB recomendado)
- **10 GB disco** + espaço para arquivos
- **Portas abertas:** 3000 (frontend), 8181 (backend), 9000 (postgres - opcional)

---

## 🚀 Instalação

### Opção 1: Instalação Completa Automatizada

```bash
# 1. Clonar repositório
git clone https://github.com/AdemirRed/red.git /opt/cloudshare
cd /opt/cloudshare

# 2. Executar script de deploy
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### Opção 2: Docker Compose Manual

```bash
# 1. Clonar repositório
git clone https://github.com/AdemirRed/red.git /opt/cloudshare
cd /opt/cloudshare

# 2. Criar diretórios
mkdir -p uploads/public uploads/users logs
chown -R 1001:1001 uploads

# 3. Subir containers
docker compose up -d

# 4. Aguardar PostgreSQL iniciar
sleep 30

# 5. Aplicar migrations
docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250801235845_initial_schema.sql
docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250801235934_default_users.sql
docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250802000632_add_user_preferences.sql
docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/20250802001500_add_device_identification.sql

# 6. Reiniciar backend
docker compose restart backend
```

**Pronto!** Acesse: `http://SEU-IP:3000`

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto (opcional):

```env
# Database
DB_NAME=cloudshare
DB_USER=cloudshare_user
DB_PASSWORD=cloudshare_pass_2026
DB_PORT=9000

# JWT & Session  
JWT_SECRET=cloudshare_super_secret_key_2026
SESSION_SECRET=cloudshare_session_secret_2026

# Email (para recuperação de senha)
EMAIL_HOST=smtp.zoho.eu
EMAIL_PORT=587
EMAIL_USER=seu@email.com
EMAIL_PASS=sua_senha
```

### Portas

| Serviço | Porta Padrão | Customizar |
|---------|--------------|------------|
| Frontend | 3000 | Editar `docker-compose.yml` linha 61 |
| Backend | 8181 | Editar `docker-compose.yml` linha 42 |
| PostgreSQL | 9000 | Editar `.env` ou `docker-compose.yml` linha 12 |

---

## 📖 Uso

### Credenciais Padrão

| Usuário | Senha | Tipo | Quota |
|---------|-------|------|-------|
| admin | admin123 | Administrador | Ilimitada |
| demo | demo123 | Normal | 100 MB |
| premium | premium123 | Premium | 1 GB |

### Acessar o Sistema

1. **Frontend:** `http://SEU-IP:3000`
2. **Login** com `admin` / `admin123`
3. **Alterar senha** em "Perfil"
4. **Upload de arquivos** - Arrastar e soltar
5. **Gerenciar usuários** - Menu "Administração" (apenas admin)

### API REST

```bash
# Health check
curl http://SEU-IP:8181/api/health

# Login
curl -X POST http://SEU-IP:8181/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Listar arquivos (requer token)
curl http://SEU-IP:8181/api/files \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## 🛠️ Comandos Úteis

### Gerenciamento de Containers

```bash
# Ver logs
docker compose logs -f              # Todos
docker compose logs -f backend      # Apenas backend
docker compose logs -f frontend     # Apenas frontend

# Status
docker compose ps

# Reiniciar
docker compose restart              # Todos
docker compose restart backend      # Apenas backend

# Parar
docker compose stop

# Iniciar
docker compose start

# Remover containers (mantém dados)
docker compose down

# Remover TUDO incluindo dados (⚠️ CUIDADO!)
docker compose down -v
```

### Banco de Dados

```bash
# Backup
docker exec cloudshare_postgres pg_dump -U cloudshare_user cloudshare > backup_$(date +%Y%m%d).sql

# Restaurar
docker exec -i cloudshare_postgres psql -U cloudshare_user cloudshare < backup.sql

# Acessar PostgreSQL
docker exec -it cloudshare_postgres psql -U cloudshare_user -d cloudshare

# Ver usuários
docker exec cloudshare_postgres psql -U cloudshare_user -d cloudshare -c "SELECT id, username, is_admin FROM users;"
```

### Monitoramento

```bash
# Uso de recursos
docker stats

# Espaço em disco
docker system df
du -sh /opt/cloudshare/uploads

# Logs do sistema
tail -f logs/*.log
```

---

## 🐛 Troubleshooting

### Backend não conecta no banco

```bash
# Verificar PostgreSQL
docker compose logs postgres

# Reiniciar PostgreSQL
docker compose restart postgres
sleep 10
docker compose restart backend
```

### Frontend mostra erro

```bash
# Testar backend
curl http://localhost:8181/api/health

# Ver logs
docker compose logs backend --tail=50
```

### Erro de permissão

```bash
# Corrigir permissões do diretório uploads
chown -R 1001:1001 /opt/cloudshare/uploads
docker compose restart backend
```

### Resetar senha do admin

```bash
docker exec cloudshare_backend node update_admin_password.js
```

---

## 🔄 Atualização

```bash
cd /opt/cloudshare

# Fazer backup
docker exec cloudshare_postgres pg_dump -U cloudshare_user cloudshare > backup_pre_update.sql

# Atualizar código
git pull

# Rebuild containers
docker compose down
docker compose up -d --build

# Aplicar novas migrations (se houver)
docker exec -i cloudshare_postgres psql -U cloudshare_user -d cloudshare < migrations/nova_migration.sql
```

---

## 📦 Estrutura do Projeto

```
cloudshare/
├── server.js              # Backend Node.js/Express
├── database.js            # Configuração PostgreSQL
├── docker-compose.yml     # Orquestração containers
├── Dockerfile             # Build backend
├── deploy-vps.sh          # Script de deploy automático
├── frontend/              # Frontend Vite + Vue
│   ├── src/
│   │   ├── App.vue
│   │   └── main.js
│   ├── Dockerfile
│   └── nginx.conf
├── migrations/            # SQL migrations
├── uploads/               # Arquivos (volume persistente)
└── logs/                  # Logs do sistema
```

---

## 🌐 Deploy em Produção

### Com Domínio e SSL

1. **Configure DNS** apontando para seu IP
2. **Instale Nginx** como reverse proxy:

```bash
apt install nginx certbot python3-certbot-nginx

# Configuração Nginx
cat > /etc/nginx/sites-available/cloudshare << 'EOF'
server {
    listen 80;
    server_name cloudshare.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8181;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/cloudshare /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# SSL com Let's Encrypt
certbot --nginx -d cloudshare.seudominio.com
```

3. **Configure CORS** no backend editando `server.js`

---

## 📊 Performance

### Otimizações Recomendadas

- **Nginx cache** para arquivos estáticos
- **PostgreSQL tuning** para alto volume
- **CDN** para distribuição de arquivos
- **Load balancer** para múltiplas instâncias

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 📧 Suporte

- **Issues:** https://github.com/AdemirRed/red/issues
- **Docs completos:** [DEPLOY_VPS.md](DEPLOY_VPS.md)
- **Email:** ademir@explorarlocais.com.br

---

## 🎯 Roadmap

- [ ] Sistema de pastas aninhadas
- [ ] Compartilhamento com links temporários
- [ ] Integração com Google Drive/Dropbox
- [ ] Upload em chunks para arquivos grandes
- [ ] Preview de mais formatos de arquivo
- [ ] App mobile React Native
- [ ] Modo escuro

---

**Desenvolvido com ❤️ por [AdemirRed](https://github.com/AdemirRed)**
