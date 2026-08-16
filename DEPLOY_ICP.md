# 🚀 Deploy CloudShare Pro no ICP (iContainer Panel)

## 📋 Pré-requisitos

- Projeto clonado do GitHub no servidor
- Acesso ao painel ICP

---

## 🔧 Configuração do Backend

### 1. Criar Application para o Backend

No painel ICP, vá em **"Aplicações"** → **"Criar Application"**:

| Campo | Valor |
|-------|-------|
| **Nome** | `CloudShare_Pro_Back` |
| **Tipo** | Container/Docker |
| **Repositório** | `AdemirRed/red` |
| **Branch** | `main` |
| **Build Path** | `.` (raiz do projeto) |
| **Dockerfile Path** | `Dockerfile` |
| **Port** | `8181` |

**Variáveis de Ambiente:**
```
NODE_ENV=production
PORT=8181
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cloudshare_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=cloudshare_super_secret_2026
SESSION_SECRET=cloudshare_session_2026
```

---

## 🎨 Configuração do Frontend

### 2. Criar Application para o Frontend

No painel ICP, vá em **"Aplicações"** → **"Criar Application"**:

| Campo | Valor |
|-------|-------|
| **Nome** | `CloudShare_Pro_Front` |
| **Tipo** | Container/Docker |
| **Repositório** | `AdemirRed/red` |
| **Branch** | `main` |
| **Build Path** | `frontend` ← **IMPORTANTE!** |
| **Dockerfile Path** | `frontend/Dockerfile` |
| **Port** | `80` |

**Variáveis de Ambiente:**
```
NODE_ENV=production
```

---

## 💾 Configuração do Banco de Dados

### 3. Criar Container PostgreSQL

No painel ICP, vá em **"Container"** → **"Criar Container"**:

| Campo | Valor |
|-------|-------|
| **Nome** | `cloudshare_postgres` |
| **Imagem** | `postgres:16-alpine` |
| **Port** | `5432` |
| **Restart Policy** | `always` |

**Variáveis de Ambiente:**
```
POSTGRES_DB=cloudshare_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

**Volumes:**
```
/var/lib/postgresql/data → cloudshare_postgres_data
```

---

## 🔗 Conectar os Containers (Network)

### 4. Criar Network

No painel ICP, vá em **"Rede"** → **"Criar Network"**:

```
Nome: cloudshare_network
Driver: bridge
```

### 5. Conectar Containers à Network

Conecte os 3 containers criados à network `cloudshare_network`:
- `cloudshare_postgres`
- `CloudShare_Pro_Back`
- `CloudShare_Pro_Front`

---

## ⚙️ Configuração Inicial do Banco

### 6. Executar Setup do Banco

Após o backend subir, execute via terminal do container:

```bash
# No painel ICP, vá em Container → CloudShare_Pro_Back → Terminal
node setup-database.js
```

---

## ✅ Verificar se Está Funcionando

### 7. Testar Endpoints

**Frontend:**
```
http://SEU_DOMINIO:80
```

**Backend Health:**
```
http://SEU_DOMINIO:8181/api/health
```

**Listar Arquivos:**
```
http://SEU_DOMINIO:8181/api/files
```

---

## 🐛 Solução de Problemas

### ❌ Erro "image build failed!" no Frontend

**Causa:** Caminho do Dockerfile incorreto

**Solução:**
1. No painel de "Construir imagem", verifique se o **Build Path** está como `frontend`
2. O **Dockerfile Path** deve ser `frontend/Dockerfile` ou apenas `Dockerfile` se o Build Path já for `frontend`

### ❌ Backend retorna erro 500 ao listar arquivos

**Causa:** Banco de dados não configurado

**Solução:**
```bash
# Acesse o terminal do container do backend
node setup-database.js
```

### ❌ Frontend não consegue chamar API

**Causa:** CORS ou proxy não configurado

**Solução:**
1. Verifique se ambos containers estão na mesma network
2. Verifique variável `VITE_API_URL` no frontend
3. Ou configure Nginx como proxy reverso (ver abaixo)

---

## 🌐 Configurar Domínio e Proxy Reverso (Opcional)

### Opção 1: Usando Nginx no Host

Crie um arquivo de configuração Nginx:

```nginx
# /etc/nginx/sites-available/cloudshare

server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_set_header Host $host;
    }
}
```

Ativar:
```bash
ln -s /etc/nginx/sites-available/cloudshare /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Opção 2: SSL com Certbot

```bash
certbot --nginx -d seu-dominio.com
```

---

## 🔄 Atualizar o Projeto

### Quando fizer mudanças no código:

1. **Fazer push para o GitHub:**
   ```bash
   git add .
   git commit -m "suas alterações"
   git push
   ```

2. **No painel ICP:**
   - Vá em **Aplicações** → Selecione a aplicação
   - Clique em **"Pull (Baixar)"** para atualizar o código
   - Clique em **"Construir Imagem"**
   - Depois clique em **"Deploy"**

---

## 📊 Monitoramento

No painel ICP você pode:

- Ver **Logs** em tempo real
- Ver **Métricas** de CPU/Memória
- **Reiniciar** containers
- Acessar **Terminal** dos containers
- Ver **Portas** expostas

---

## 🔐 Credenciais Padrão

Após instalação:

| Usuário | Senha | Tipo |
|---------|-------|------|
| admin | admin123 | Administrador |
| demo | demo123 | Usuário Normal |

**⚠️ Troque as senhas após primeiro login!**

---

## 📝 Checklist de Deploy

- [ ] PostgreSQL container criado e rodando
- [ ] Backend container criado e rodando
- [ ] Frontend container criado e rodando
- [ ] Todos na mesma network
- [ ] Banco de dados configurado (setup-database.js)
- [ ] Frontend acessível
- [ ] API respondendo (/api/health)
- [ ] Login funcionando
- [ ] Upload funcionando
- [ ] Domínio configurado (opcional)
- [ ] SSL configurado (opcional)

---

**Desenvolvido com ❤️ para CloudShare Pro**
