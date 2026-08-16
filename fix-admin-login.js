#!/usr/bin/env node
/**
 * 🔧 Fix Admin Login - CloudShare Pro
 * Verifica e corrige o login do administrador
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 9000,
    user: process.env.DB_USER || 'cloudshare_user',
    password: process.env.DB_PASSWORD || 'cloudshare_pass_2026',
    database: process.env.DB_NAME || 'cloudshare'
});

async function fixAdminLogin() {
    console.log('🔍 Verificando usuário admin...\n');

    try {
        // 1. Buscar usuário admin
        const result = await pool.query(
            'SELECT id, username, password, is_admin FROM users WHERE username = $1',
            ['admin']
        );

        if (result.rows.length === 0) {
            console.log('❌ Usuário admin NÃO encontrado!');
            console.log('📝 Criando usuário admin...\n');

            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            await pool.query(
                `INSERT INTO users (username, password, is_admin, email, user_type, storage_quota, is_active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                ['admin', hashedPassword, true, 'admin@cloudshare.local', 'admin', 0, true]
            );

            console.log('✅ Usuário admin CRIADO com sucesso!');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            console.log('   Is Admin: true\n');

        } else {
            const user = result.rows[0];
            console.log(`✅ Usuário admin encontrado (ID: ${user.id})`);
            console.log(`   Is Admin: ${user.is_admin ? '✅ SIM' : '❌ NÃO'}`);
            
            // 2. Verificar se a senha está correta
            const passwordCorrect = await bcrypt.compare('admin123', user.password);
            console.log(`   Senha válida: ${passwordCorrect ? '✅ SIM' : '❌ NÃO'}`);

            if (!passwordCorrect || !user.is_admin) {
                console.log('\n🔧 Corrigindo usuário admin...');
                
                const hashedPassword = await bcrypt.hash('admin123', 10);
                
                await pool.query(
                    'UPDATE users SET password = $1, is_admin = $2 WHERE id = $3',
                    [hashedPassword, true, user.id]
                );

                console.log('✅ Usuário admin CORRIGIDO!');
                console.log('   Username: admin');
                console.log('   Password: admin123');
                console.log('   Is Admin: true\n');
            } else {
                console.log('\n✅ Usuário admin está CORRETO! Senha: admin123\n');
            }
        }

        // 3. Verificar outros usuários
        const allUsers = await pool.query(
            'SELECT username, is_admin FROM users ORDER BY id'
        );
        
        console.log('📋 Usuários no sistema:');
        allUsers.rows.forEach(u => {
            console.log(`   - ${u.username} ${u.is_admin ? '(ADMIN)' : ''}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

fixAdminLogin();
