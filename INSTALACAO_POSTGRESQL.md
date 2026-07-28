# 📋 Guia de Instalação - PostgreSQL para CloudShare v2.0

## 🚀 SISTEMA ATUALIZADO COM AUTENTICAÇÃO E SEPARAÇÃO POR USUÁRIO

### 📦 Instalação do PostgreSQL

#### Windows (Opção 1 - Instalador Oficial)
1. **Download**: https://www.postgresql.org/download/windows/
2. **Instalar**: Execute o instalador
3. **Configurar**:
   - **Porta**: 5432 (padrão)
   - **Usuário**: postgres
   - **Senha**: admin123
   - **Database**: postgres (padrão)

#### Windows (Opção 2 - Docker) ⭐ RECOMENDADO
```bash
# Instalar Docker Desktop se não tiver
# https://docs.docker.com/desktop/install/windows-install/

# Executar PostgreSQL no Docker
docker run --name cloudshare-postgres -e POSTGRES_PASSWORD=admin123 -p 5432:5432 -d postgres:15

# Verificar se está rodando
docker ps
```

#### Windows (Opção 3 - XAMPP PostgreSQL Add-on)
1. Download PostgreSQL add-on para XAMPP
2. Instalar no diretório do XAMPP
3. Configurar através do painel XAMPP

### 🔧 Configuração Inicial

#### 1. Verificar se PostgreSQL está rodando
```bash
# Testar conexão
psql -h localhost -U postgres -p 5432
# Senha: admin123
```

#### 2. Configurar Database do CloudShare
```bash
# No diretório do projeto
npm run setup-db
```

### 🎯 Credenciais Padrão Criadas

| Usuário | Senha | Tipo | Quota |
|---------|-------|------|-------|
| admin | admin123 | Administrador | 10GB |
| demo | demo123 | Usuário | 2GB |

### 📁 Estrutura de Pastas Criada

```
uploads/
├── public/           # Arquivos públicos (usuários não logados)
├── users/           # Pastas privadas dos usuários
│   ├── user_1/      # Arquivos do usuário ID 1
│   ├── user_2/      # Arquivos do usuário ID 2
│   └── ...
└── [logs antigos]   # Mantidos para compatibilidade
```

### 🔒 Sistema de Autenticação

#### Funcionalidades Implementadas
- ✅ **Login/Registro**: Sistema completo de usuários
- ✅ **Sessões**: Baseado em PostgreSQL para escalabilidade
- ✅ **Separação**: Arquivos privados por usuário
- ✅ **Pasta Pública**: Para usuários não logados
- ✅ **Quotas**: Controle de armazenamento por usuário
- ✅ **Logs**: Auditoria completa de ações
- ✅ **Admin Panel**: Interface administrativa

#### Tipos de Acesso
1. **Usuário Logado**: Acesso aos próprios arquivos + públicos
2. **Modo Público**: Apenas arquivos públicos
3. **Administrador**: Acesso total + funcões administrativas

### 🚀 Iniciar o Sistema

#### 1. Configurar Database (primeira vez)
```bash
npm run setup-db
```

#### 2. Iniciar Servidor
```bash
npm start
```

#### 3. Acessar Sistema
- **URL**: http://localhost:8181
- **Rede**: http://192.168.0.200:8181

### 📊 APIs Disponíveis

#### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Status do usuário

#### Arquivos
- `POST /api/upload` - Upload (com/sem auth)
- `GET /api/files` - Listar arquivos
- `GET /api/download/:id` - Download
- `DELETE /api/files/:id` - Excluir (auth required)

#### Administração
- `GET /api/admin/users` - Listar usuários
- `GET /api/admin/stats` - Estatísticas do sistema

### 🔧 Configurações Avançadas

#### Alterar Configurações do Database
Edite `database.js`:
```javascript
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'cloudshare_db',
  password: 'admin123',
  port: 5432,
};
```

#### Alterar Quotas Padrão
Edite `setup-database.js`:
```javascript
// Quota padrão para novos usuários
storage_quota: 1073741824, // 1GB em bytes
```

### 🛡️ Segurança Implementada

- **Rate Limiting**: Proteção contra spam
- **Helmet**: Headers de segurança
- **CORS**: Controle de acesso
- **Bcrypt**: Hash seguro de senhas
- **JWT**: Tokens seguros (opcional)
- **Sessions**: Sessões no PostgreSQL
- **SQL Injection**: Queries parametrizadas

### 📈 Monitoramento

#### Logs Disponíveis
- **activity_logs**: Tabela no PostgreSQL
- **session**: Sessões ativas
- **files**: Metadados dos arquivos
- **users**: Informações dos usuários

### 🔄 Backup e Restauração

#### Backup do Database
```bash
pg_dump -h localhost -U postgres cloudshare_db > backup.sql
```

#### Restaurar Database
```bash
psql -h localhost -U postgres cloudshare_db < backup.sql
```

### 🚨 Solução de Problemas

#### PostgreSQL não conecta
1. Verificar se serviço está rodando
2. Conferir porta 5432
3. Verificar credenciais
4. Testar com psql ou pgAdmin

#### Erro de permissão
1. Verificar user/password no `database.js`
2. Criar database manualmente se necessário
3. Verificar permissões do usuário postgres

#### Arquivos não aparecem
1. Verificar se tabelas foram criadas (`npm run setup-db`)
2. Conferir logs do servidor
3. Verificar permissões de pasta uploads

### 📞 Comandos Úteis

```bash
# Verificar status PostgreSQL (Windows)
net start postgresql-x64-13

# Parar PostgreSQL
net stop postgresql-x64-13

# Conectar ao database
psql -h localhost -U postgres -d cloudshare_db

# Verificar tabelas
\dt

# Ver usuários cadastrados
SELECT username, email, is_admin, storage_quota FROM users;

# Ver arquivos por usuário
SELECT u.username, COUNT(f.id) as files, SUM(f.size) as total_size 
FROM users u 
LEFT JOIN files f ON u.id = f.user_id 
GROUP BY u.id, u.username;
```

---

## 🎉 SISTEMA PRONTO!

**CloudShare v2.0 agora inclui:**
- ✅ Sistema completo de autenticação
- ✅ Separação de arquivos por usuário
- ✅ Pasta pública para visitantes
- ✅ Controle de quotas
- ✅ Logs de auditoria
- ✅ Interface administrativa
- ✅ Segurança robusta

**Para suporte**: Verifique os logs do servidor e do PostgreSQL
