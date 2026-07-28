const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function resetPassword() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'cloudshare_db',
        password: 'admin123',
        port: 9000,
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco PostgreSQL\n');

        // Listar usuários disponíveis
        const users = await client.query('SELECT id, username, email, role FROM users ORDER BY id');
        
        console.log('📋 Usuários disponíveis:');
        console.log('─────────────────────────────────────────');
        users.rows.forEach(user => {
            console.log(`ID: ${user.id} | Usuário: ${user.username} | Email: ${user.email || 'N/A'} | Tipo: ${user.role}`);
        });
        console.log('─────────────────────────────────────────\n');

        // Solicitar nome de usuário
        const username = await question('Digite o nome de usuário para resetar a senha: ');
        
        // Verificar se o usuário existe
        const userCheck = await client.query('SELECT id, username FROM users WHERE username = $1', [username]);
        
        if (userCheck.rows.length === 0) {
            console.log('❌ Usuário não encontrado!');
            rl.close();
            await client.end();
            return;
        }

        // Solicitar nova senha
        const newPassword = await question('Digite a nova senha: ');
        
        if (newPassword.length < 4) {
            console.log('❌ A senha deve ter pelo menos 4 caracteres!');
            rl.close();
            await client.end();
            return;
        }

        // Gerar hash da nova senha
        const newHash = await bcrypt.hash(newPassword, 12);
        console.log('\n🔐 Gerando hash seguro...');

        // Atualizar no banco
        const result = await client.query(
            'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username',
            [newHash, username]
        );

        if (result.rows.length > 0) {
            console.log('\n✅ Senha atualizada com sucesso!');
            console.log('─────────────────────────────────────────');
            console.log('Usuário:', result.rows[0].username);
            console.log('Nova senha:', newPassword);
            console.log('─────────────────────────────────────────');
            
            // Verificar se a senha funciona
            const isValid = await bcrypt.compare(newPassword, newHash);
            console.log('✅ Validação:', isValid ? 'Senha funcionando corretamente' : 'ERRO na validação');
        } else {
            console.log('❌ Erro ao atualizar senha');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        rl.close();
        await client.end();
    }
}

// Tratamento de saída
rl.on('close', () => {
    process.exit(0);
});

console.log('🔐 CloudShare - Reset de Senha\n');
resetPassword();
