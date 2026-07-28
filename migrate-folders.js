const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'cloudshare',
    user: 'postgres',
    password: 'admin'
});

async function runFolderMigrations() {
    console.log('🔄 Executando migrações para suporte a pastas...');
    
    try {
        // Verificar se as colunas já existem
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'files' 
            AND column_name IN ('folder_path', 'is_folder', 'parent_folder_id', 'folder_structure')
        `);
        
        const existingColumns = columnCheck.rows.map(row => row.column_name);
        console.log('📋 Colunas existentes:', existingColumns);
        
        // Adicionar colunas que não existem
        if (!existingColumns.includes('folder_path')) {
            await pool.query('ALTER TABLE files ADD COLUMN folder_path TEXT DEFAULT \'\'');
            console.log('✅ Coluna folder_path adicionada');
        }
        
        if (!existingColumns.includes('is_folder')) {
            await pool.query('ALTER TABLE files ADD COLUMN is_folder BOOLEAN DEFAULT FALSE');
            console.log('✅ Coluna is_folder adicionada');
        }
        
        if (!existingColumns.includes('parent_folder_id')) {
            await pool.query('ALTER TABLE files ADD COLUMN parent_folder_id INTEGER');
            console.log('✅ Coluna parent_folder_id adicionada');
        }
        
        if (!existingColumns.includes('folder_structure')) {
            await pool.query('ALTER TABLE files ADD COLUMN folder_structure JSONB DEFAULT \'{}\'::jsonb');
            console.log('✅ Coluna folder_structure adicionada');
        }
        
        // Criar índices para performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files(folder_path)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_files_parent_folder ON files(parent_folder_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_files_is_folder ON files(is_folder)');
        console.log('✅ Índices criados');
        
        // Verificar estrutura final
        const finalCheck = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'files' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Estrutura final da tabela files:');
        finalCheck.rows.forEach(row => {
            console.log(`   ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'NULL'}`);
        });
        
        console.log('\n✅ Migrações de pastas executadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runFolderMigrations();
}

module.exports = { runFolderMigrations };
