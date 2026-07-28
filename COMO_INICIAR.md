# 🚀 CloudShare Pro - Como Iniciar

## Forma Mais Simples (RECOMENDADA)

### **Opção 1: Clique Duplo** ⭐

Simplesmente dê **duplo clique** no arquivo:

```
START_CLOUDSHARE.bat
```

**Pronto!** O sistema vai:
✅ Verificar PostgreSQL
✅ Instalar dependências (se necessário)
✅ Iniciar Backend (porta 8181)
✅ Iniciar Frontend (porta 3000)
✅ Abrir o navegador automaticamente

---

### **Opção 2: Linha de Comando**

Abra o PowerShell/Terminal nesta pasta e execute:

```powershell
.\START_CLOUDSHARE.bat
```

ou diretamente:

```powershell
.\start_cloudshare.ps1
```

---

## Comandos NPM Individuais

Se preferir iniciar manualmente cada parte:

### Backend (porta 8181)
```bash
npm start
```

### Frontend (porta 3000)
```bash
npm run frontend
```

### Ambos juntos (alternativa)
```bash
npm run start:all
```

---

## Parar os Servidores

Para parar os servidores, você pode:

1. **Fechar as janelas** do Backend e Frontend que foram abertas
2. **Pressionar Ctrl+C** em cada janela
3. **Executar comando** para matar todos os processos:

```powershell
Get-Process node | Stop-Process -Force
```

---

## Acessos

Após iniciar, o sistema estará disponível em:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8181
- **Rede Local**: http://192.168.0.200:3000

---

## Credenciais Padrão

| Usuário | Senha | Tipo |
|---------|-------|------|
| admin | admin123 | Administrador |
| demo | demo123 | Usuário Normal |

---

## Requisitos

- ✅ Node.js instalado
- ✅ Docker Desktop rodando
- ✅ PostgreSQL no Docker (porta 9000)

**Comando para criar o banco:**
```bash
docker run --name cloudshare-postgres -e POSTGRES_PASSWORD=admin123 -p 9000:5432 -d postgres:15
```

---

## Troubleshooting

### Porta já em uso

Se aparecer erro de porta já em uso, execute:

```powershell
Get-Process node | Stop-Process -Force
```

### PostgreSQL não inicia

Verifique se o Docker Desktop está rodando:
```powershell
docker ps
```

Se o container não existir, crie-o:
```powershell
docker run --name cloudshare-postgres -e POSTGRES_PASSWORD=admin123 -p 9000:5432 -d postgres:15
npm run setup-db
```

### Dependências faltando

O script instala automaticamente, mas se precisar manual:

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
```

---

## 💡 Dicas

- Mantenha as janelas do Backend e Frontend abertas enquanto usa o sistema
- O navegador abrirá automaticamente após a inicialização
- Os logs aparecem nas janelas do PowerShell abertas
- Verifique o console do navegador (F12) para debug do frontend

---

**Desenvolvido com ❤️ para CloudShare Pro**
