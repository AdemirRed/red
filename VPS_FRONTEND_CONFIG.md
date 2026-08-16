# Configuração Frontend no Coolify (VPS)

## 📋 **Opção 1: Application (Git-based) — Se aparecer "Docker" no Build Pack**

| Campo na UI | Valor |
|-------------|-------|
| **Nome** | `CloudShare_Pro_Front` |
| **Domínio Principal** | `CloudShareProFront.vps9645.panel.icontainer.net` |
| **Credencial GitHub** | (sua credencial já configurada) |
| **Repositório** | `AdemirRed/red` |
| **Branch** | `main` |
| **Pasta do projeto** | `frontend/` |
| **Build Pack** | **`Docker`** ← Procure esta opção (pode estar em "Advanced" ou "Build Settings") |
| **Dockerfile** | `Dockerfile` |
| **Comando de inicialização** | `nginx -g "daemon off;"` |
| **Porta da Aplicação** | `80` |
| **Porta Externa** | `80` (ou 443 com SSL) |
| **Acesso externo** | ✅ Habilitado |
| **Smoke test** | ✅ Habilitado (health check: `/`) |
| **Retenção** | `5` releases / `30` dias |
| **Destino** | `/home/apps/cloudshare_pro_front/` |
| **Variáveis** | `NODE_ENV=production` |

---

## 📋 **Opção 2: Container (Docker Image) — RECOMENDADA se não tiver "Docker" no Build Pack**

> **No menu lateral do Coolify:** clique em **"Containers"** → **"Criar Container"**

| Campo | Valor |
|-------|-------|
| **Nome** | `cloudshare-pro-front` |
| **Imagem** | `ghcr.io/ademirred/red-frontend:latest` *(ou build local)* |
| **Porta** | `80` |
| **Domínio** | `CloudShareProFront.vps9645.panel.icontainer.net` |
| **Comando** | `nginx -g "daemon off;"` |
| **Variáveis** | `NODE_ENV=production` |
| **Network** | `cloudshare_network` (mesma rede do backend/postgres) |

### **Como obter a imagem Docker (duas formas):**

#### **A) GitHub Container Registry (Automático via GitHub Actions)**
Crie `.github/workflows/docker-frontend.yml`:
```yaml
name: Build Frontend Docker

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      packages: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/red-frontend:latest
```

#### **B) Build local e push manual**
```bash
cd frontend
docker build -t ghcr.io/ademirred/red-frontend:latest .
docker push ghcr.io/ademirred/red-frontend:latest
```

---

## 🔗 **Rede Docker (Importante para Container)**

Se usar **Opção 2 (Container)**, crie a rede primeiro no servidor VPS:
```bash
docker network create cloudshare_network
```

E conecte os containers existentes:
```bash
docker network connect cloudshare_network cloudshare_backend
docker network connect cloudshare_network cloudshare_postgres
```

Assim o frontend consegue acessar `http://backend:8181` via nome do container.

---

## ✅ **Recomendação: Use a Opção 2 (Container)**

Vantagens:
- ✅ Não depende de Build Pack do Coolify
- ✅ Build mais rápido (imagem já pronta)
- ✅ Controle total da imagem
- ✅ Funciona mesmo se Coolify não tiver opção Docker no Application

---

## 🔧 **Variáveis de Ambiente (Adicionar na seção "Variáveis")**

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |

---

## 🐳 **Por que Porta 80 (não 3000)?**

O `Dockerfile` do frontend faz **multi-stage build**:
1. **Stage 1 (Node.js 20)**: `npm run build` → gera pasta `dist/`
2. **Stage 2 (Nginx Alpine)**: Copia `dist/` para `/usr/share/nginx/html` e roda **Nginx na porta 80**

O `nginx.conf` expõe a porta 80, não 3000. O Vite (porta 3000) só é usado em **desenvolvimento local**.

---

## 🔗 **Configuração de Comunicação (Importante!)**

### **Opção A: Proxy no Nginx (Recomendado - mesmo domínio)**
No `frontend/nginx.conf`, **descomente** estas linhas:
```nginx
location /api/ {
    proxy_pass http://backend:8181;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

location /uploads/ {
    proxy_pass http://backend:8181;
    # ... mesmas configurações de headers
}
```
> **Requer rebuild** da imagem Docker após alterar o nginx.conf

### **Opção B: CORS no Backend (domínios separados)**
No `server.js` (backend), adicione o domínio do frontend:
```javascript
origin: [
    'http://localhost:3000',
    'https://CloudShareProFront.vps9645.panel.icontainer.net',
    'https://CloudShareProBack.vps9645.panel.icontainer.net'
],
credentials: true
```
> Não requer rebuild do frontend, só restart do backend

---

## ✅ **Checklist Pós-Deploy**

- [ ] Frontend acessível em `https://CloudShareProFront.vps9645.panel.icontainer.net`
- [ ] Login funciona (chama API do backend)
- [ ] Upload de arquivos funciona
- [ ] Thumbnails carregam
- [ ] WebSocket/notificações funcionam (se aplicável)
- [ ] SSL/HTTPS ativo (Coolify configura automaticamente com Let's Encrypt)

---

## 🔄 **Atualizações Futuras**

```bash
# No servidor VPS, ou via GitHub Actions:
cd /home/apps/cloudshare_pro_front/
docker compose pull
docker compose up -d --build
```

Ou configure **Auto Deploy** no Coolify (webhook do GitHub).