const db = require('./database');

async function checkPublicFiles() {
    try {
        console.log('🔍 Verificando arquivos públicos na base de dados...\n');
        
        // Buscar arquivos da pasta public ou públicos
        const result = await db.query(`
            SELECT f.id, f.original_name, f.filename, f.is_public, f.size, 
                   f.created_at, u.username
            FROM files f 
            LEFT JOIN users u ON f.user_id = u.id 
            WHERE u.username = 'public' OR f.is_public = true
            ORDER BY f.created_at DESC
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ Nenhum arquivo público encontrado na base de dados');
            
            // Verificar se existe usuário public
            const userResult = await db.query("SELECT id, username FROM users WHERE username = 'public'");
            if (userResult.rows.length === 0) {
                console.log('❌ Usuário "public" não existe');
            } else {
                console.log('✅ Usuário "public" existe:', userResult.rows[0]);
            }
        } else {
            console.log(`✅ ${result.rows.length} arquivo(s) público(s) encontrado(s):\n`);
            
            result.rows.forEach((file, index) => {
                console.log(`${index + 1}. ${file.original_name}`);
                console.log(`   - ID: ${file.id}`);
                console.log(`   - Arquivo: ${file.filename}`);
                console.log(`   - Tamanho: ${file.size} bytes`);
                console.log(`   - Público: ${file.is_public}`);
                console.log(`   - Usuário: ${file.username}`);
                console.log(`   - Data: ${file.created_at}`);
                console.log('');
            });
        }
        
        // Verificar total de arquivos
        const totalResult = await db.query('SELECT COUNT(*) as total FROM files');
        console.log(`📊 Total de arquivos na base: ${totalResult.rows[0].total}`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        process.exit(0);
    }
}

checkPublicFiles();
