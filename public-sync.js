const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const db = require('./database');

class PublicSync {
    constructor() {
        this.publicPath = path.join(__dirname, 'uploads', 'public');
        this.watchedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx', '.mp4', '.mp3', '.zip', '.rar', '.exe', '.apk', '.msi', '.7z'];
        this.excludeFiles = ['index.html', 'admin.html', 'manifest.json', 'sw.js', 'mobile.css', 'teste.txt'];
        this.excludeDirs = ['icons'];
        this.publicUserId = null;
        this.watcher = null;
    }

    async init() {
        console.log('🔄 Iniciando sincronização da pasta public...');
        
        // Criar ou encontrar usuário "public" para arquivos da pasta public
        await this.ensurePublicUser();
        
        // Fazer scan inicial
        await this.initialScan();
        
        // Iniciar monitoramento
        this.startWatching();
        
        console.log('✅ Sincronização da pasta public ativa');
    }

    async ensurePublicUser() {
        try {
            // Verificar se existe usuário "public"
            const publicUser = await db.query(
                'SELECT id FROM users WHERE username = $1',
                ['public']
            );

            if (publicUser.rows.length > 0) {
                this.publicUserId = publicUser.rows[0].id;
            } else {
                // Criar usuário "public"
                const newUser = await db.query(`
                    INSERT INTO users (username, email, password_hash, full_name, is_admin, is_active, storage_quota)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `, ['public', 'public@cloudshare.local', 'no-password', 'Arquivos Públicos', false, true, 10 * 1024 * 1024 * 1024]); // 10GB
                
                this.publicUserId = newUser.rows[0].id;
                console.log('👤 Usuário "public" criado para arquivos da pasta public');
            }
        } catch (error) {
            console.error('❌ Erro ao criar usuário public:', error);
        }
    }

    async initialScan() {
        try {
            const files = await this.scanDirectory(this.publicPath);
            
            for (const file of files) {
                await this.addFileToDatabase(file);
            }
            
            console.log(`📁 Scan inicial: ${files.length} arquivos encontrados`);
        } catch (error) {
            console.error('❌ Erro no scan inicial:', error);
        }
    }

    async scanDirectory(dirPath, relativePath = '') {
        const files = [];
        
        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const relPath = path.join(relativePath, item.name).replace(/\\/g, '/');
                
                if (item.isDirectory()) {
                    // Pular diretórios excluídos
                    if (this.excludeDirs.includes(item.name)) continue;
                    
                    // Recursivo para subdiretórios
                    const subFiles = await this.scanDirectory(fullPath, relPath);
                    files.push(...subFiles);
                } else if (item.isFile()) {
                    // Pular arquivos excluídos
                    if (this.excludeFiles.includes(item.name)) continue;
                    
                    // Verificar extensão
                    const ext = path.extname(item.name).toLowerCase();
                    if (this.watchedExtensions.includes(ext)) {
                        const stat = await fs.stat(fullPath);
                        files.push({
                            name: item.name,
                            path: fullPath,
                            relativePath: relPath,
                            size: stat.size,
                            modifiedTime: stat.mtime
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao ler diretório ${dirPath}:`, error);
        }
        
        return files;
    }

    async addFileToDatabase(fileInfo) {
        try {
            // Verificar se arquivo já existe no banco
            const existing = await db.query(
                'SELECT id FROM files WHERE filename = $1 AND user_id = $2 AND folder_path = $3',
                [fileInfo.name, this.publicUserId, path.dirname(fileInfo.relativePath) || '/']
            );

            if (existing.rows.length > 0) {
                return; // Arquivo já existe
            }

            // Determinar tipo MIME
            const mimeType = this.getMimeType(path.extname(fileInfo.name));
            
            // Gerar URL pública
            const publicUrl = `http://localhost:8181/${fileInfo.relativePath}`;
            
            // Inserir no banco usando nome original como filename
            await db.query(`
                INSERT INTO files (
                    filename, original_name, mimetype, size, 
                    user_id, folder_path, file_hash, path, 
                    created_at, is_public
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                fileInfo.name, // usar nome original como filename
                fileInfo.name, // nome original para display
                mimeType,
                fileInfo.size,
                this.publicUserId,
                path.dirname(fileInfo.relativePath) || '/',
                'public-file-' + Date.now(),
                fileInfo.path,
                new Date(),
                true
            ]);

            console.log(`📄 Arquivo adicionado: ${fileInfo.relativePath}`);
        } catch (error) {
            console.error(`❌ Erro ao adicionar arquivo ${fileInfo.name}:`, error);
        }
    }

    startWatching() {
        // Configurar watcher para monitorar mudanças
        this.watcher = chokidar.watch(this.publicPath, {
            ignored: [
                /node_modules/,
                ...this.excludeFiles.map(f => path.join(this.publicPath, f)),
                ...this.excludeDirs.map(d => path.join(this.publicPath, d, '**'))
            ],
            persistent: true,
            ignoreInitial: true
        });

        this.watcher
            .on('add', async (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (this.watchedExtensions.includes(ext)) {
                    const relativePath = path.relative(this.publicPath, filePath).replace(/\\/g, '/');
                    const stat = await fs.stat(filePath);
                    
                    await this.addFileToDatabase({
                        name: path.basename(filePath),
                        path: filePath,
                        relativePath: relativePath,
                        size: stat.size,
                        modifiedTime: stat.mtime
                    });
                    
                    console.log(`➕ Novo arquivo detectado: ${relativePath}`);
                }
            })
            .on('unlink', async (filePath) => {
                const relativePath = path.relative(this.publicPath, filePath).replace(/\\/g, '/');
                await this.removeFileFromDatabase(path.basename(filePath), path.dirname(relativePath));
                console.log(`➖ Arquivo removido: ${relativePath}`);
            });
    }

    async removeFileFromDatabase(filename, folderPath) {
        try {
            await db.query(
                'DELETE FROM files WHERE filename = $1 AND user_id = $2 AND folder_path = $3',
                [filename, this.publicUserId, folderPath || '/']
            );
        } catch (error) {
            console.error(`❌ Erro ao remover arquivo ${filename}:`, error);
        }
    }

    getMimeType(ext) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed'
        };
        
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            console.log('🔴 Monitoramento da pasta public parado');
        }
    }
}

module.exports = PublicSync;
