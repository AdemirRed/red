const fs = require('fs');
const db = require('./database');

async function applyMigrations() {
    console.log('🔧 Aplicando migrations...');
    
    try {
        // Migration 1: Corrigir activity_logs
        console.log('📝 Aplicando migration para activity_logs...');
        await db.query(`
            ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
            ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
            ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
        `);
        
        // Migration 2: Adicionar campos para identificação de dispositivo
        console.log('📝 Aplicando migration para device identification...');
        await db.query(`
            ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_ip VARCHAR(45);
            ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_user_agent TEXT;
            ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_fingerprint VARCHAR(64);
            ALTER TABLE files ADD COLUMN IF NOT EXISTS delete_token VARCHAR(64);
        `);
        
        // Criar índices
        console.log('📝 Criando índices...');
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_files_delete_token ON files(delete_token);
            CREATE INDEX IF NOT EXISTS idx_files_fingerprint ON files(uploader_fingerprint);
        `);
        
        console.log('✅ Todas as migrations aplicadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao aplicar migrations:', error);
    } finally {
        process.exit();
    }
}

applyMigrations();
