const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function testAdminLogin() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'cloudshare_db',
        password: 'admin123',
        port: 9000,
    });

    try {
        await client.connect();
        console.log('=== TESTE DE LOGIN ADMIN ===');

        // Buscar o usuário admin
        const result = await client.query(
            'SELECT username, password_hash, is_admin, is_active FROM users WHERE username = $1',
            ['admin']
        );

        if (result.rows.length === 0) {
            console.log('❌ Usuário admin não encontrado');
            return;
        }

        const user = result.rows[0];
        console.log('✅ Usuário encontrado:', user.username);
        console.log('✅ É admin:', user.is_admin);
        console.log('✅ Está ativo:', user.is_active);
        console.log('✅ Hash no banco:', user.password_hash.substring(0, 20) + '...');

        // Testar a senha
        const testPassword = 'admin123';
        const isValid = await bcrypt.compare(testPassword, user.password_hash);
        
        console.log('🔐 Testando senha "admin123":', isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');

        if (isValid) {
            console.log('🎉 LOGIN FUNCIONANDO! Use: admin / admin123');
        } else {
            console.log('❌ Problema na validação da senha');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await client.end();
    }
}

testAdminLogin();
