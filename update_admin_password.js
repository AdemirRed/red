const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'cloudshare_db',
        password: 'admin123',
        port: 9000,
    });

    try {
        await client.connect();
        console.log('Conectado ao banco PostgreSQL');

        // Gerar novo hash para admin123
        const newHash = await bcrypt.hash('admin123', 12);
        console.log('Novo hash gerado:', newHash);

        // Atualizar no banco
        const result = await client.query(
            'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING username, password_hash',
            [newHash, 'admin']
        );

        if (result.rows.length > 0) {
            console.log('✅ Senha do admin atualizada com sucesso!');
            console.log('Usuario:', result.rows[0].username);
            
            // Verificar se a senha funciona
            const isValid = await bcrypt.compare('admin123', result.rows[0].password_hash);
            console.log('✅ Verificação da senha:', isValid ? 'SUCESSO' : 'FALHOU');
        } else {
            console.log('❌ Usuário admin não encontrado');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await client.end();
    }
}

updateAdminPassword();
