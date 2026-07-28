# 🔐 Guia de Recuperação de Senha - CloudShare Pro

## Como Resetar Sua Senha

Se você esqueceu sua senha, existem duas formas de recuperá-la:

---

## 🌐 Opção 1: Pela Interface Web (NOVO - Mais Fácil!)

**Esta é a forma mais simples e rápida!**

1. **Acesse o CloudShare** em seu navegador:
   - http://localhost:3000 (local)
   - http://192.168.0.200:3000 (rede)

2. **Clique em "Fazer Login"**

3. **Clique em "Esqueceu a senha?"** (link abaixo do campo de senha)

4. **Preencha o formulário:**
   - Digite seu nome de usuário OU email
   - Digite a nova senha (mínimo 4 caracteres)
   - Confirme a nova senha

5. **Clique em "Resetar Senha"**

6. **Pronto!** Você será redirecionado para o login automaticamente

✅ **Vantagens:**
- Não precisa acessar o servidor
- Pode ser feito de qualquer dispositivo
- Interface intuitiva e simples
- Funciona de qualquer lugar da rede

---

## 💻 Opção 2: Script Automatizado via Terminal

### Quando usar:
- Se você tem acesso ao servidor
- Para resetar senha de múltiplos usuários
- Para administração do sistema

1. **Abra o PowerShell ou Terminal**
   - Windows: Pressione `Win + X` e selecione "Windows PowerShell" ou "Terminal"
   - Ou navegue até a pasta do projeto pelo explorador de arquivos e digite `powershell` na barra de endereço

2. **Navegue até a pasta do projeto** (se ainda não estiver lá)
   ```powershell
   cd C:\xampp\htdocs\VideosAulas\Programas\red
   ```

3. **Execute o comando de reset**
   ```powershell
   npm run reset-password
   ```

4. **Siga as instruções**
   - O sistema mostrará todos os usuários disponíveis
   - Digite o nome de usuário que deseja resetar
   - Digite a nova senha (mínimo 4 caracteres)
   - Confirme que a senha foi alterada com sucesso

### Opção 2: Script Direto

Se preferir executar o script diretamente:

```powershell
node reset_password.js
```

### Exemplo de Uso

```
🔐 CloudShare - Reset de Senha

✅ Conectado ao banco PostgreSQL

📋 Usuários disponíveis:
─────────────────────────────────────────
ID: 1 | Usuário: admin | Email: admin@cloudshare.com | Tipo: admin
ID: 2 | Usuário: demo | Email: demo@cloudshare.com | Tipo: user
─────────────────────────────────────────

Digite o nome de usuário para resetar a senha: admin
Digite a nova senha: minhasenha123

🔐 Gerando hash seguro...

✅ Senha atualizada com sucesso!
─────────────────────────────────────────
Usuário: admin
Nova senha: minhasenha123
─────────────────────────────────────────
✅ Validação: Senha funcionando corretamente
```

### Credenciais Padrão

Caso precise saber as credenciais padrão do sistema:

| Usuário | Senha Padrão |
|---------|--------------|
| admin   | admin123     |
| demo    | demo123      |

### Problemas Comuns

**Erro: "Usuário não encontrado"**
- Verifique se digitou o nome de usuário corretamente
- Consulte a lista de usuários disponíveis

**Erro: "Não foi possível conectar ao banco"**
- Verifique se o PostgreSQL está rodando: `docker ps`
- Se não estiver rodando, inicie com: `docker start cloudshare-postgres`

**Erro: "A senha deve ter pelo menos 4 caracteres"**
- Digite uma senha com no mínimo 4 caracteres

### Contato

Se continuar com problemas, entre em contato com o administrador do sistema ou consulte a documentação completa nos arquivos:
- `README.md`
- `INSTALACAO_POSTGRESQL.md`
- `STATUS_FINAL.md`

---

**Segurança:** Sempre escolha senhas fortes e únicas. Evite usar senhas fáceis como "123456" ou "password".
