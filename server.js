require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const mimeTypes = require('mime-types');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const crypto = require('crypto');

// Módulos customizados
const db = require('./database');
const auth = require('./auth');
const PublicSync = require('./public-sync');
const ThumbnailGenerator = require('./thumbnail-generator');

// Tratar erros não capturados para evitar crash do servidor
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado (uncaughtException):', error);
    console.error('Stack trace:', error.stack);
    // Não finalizar o processo para manter o servidor rodando
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada (unhandledRejection):', reason);
    console.error('Promise:', promise);
    // Não finalizar o processo para manter o servidor rodando
});

const app = express();
const PORT = process.env.PORT || 8181;

// Middleware de segurança aprimorada
app.use(helmet({
    contentSecurityPolicy: false, // Temporariamente desabilitado para debug
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // Corrigir problema COOP
    originAgentCluster: false // Desabilitar Origin-Agent-Cluster header
}));

// Rate limiting mais rigoroso
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 2000, // 2000 requests por IP (uso local/desenvolvimento)
    message: {
        success: false,
        message: 'Muitas tentativas. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Ignora rate limit para localhost
        const ip = req.ip || req.connection.remoteAddress || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos  
    max: 20, // máximo de 20 tentativas de login por IP
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 50, // máximo de 50 uploads por minuto
    message: {
        success: false,
        message: 'Muitos uploads. Aguarde um momento.'
    }
});

app.use(limiter);

// Middleware básico
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://redblackspy.ddns.net:3000',
        'https://redblackspy.ddns.net:3000',
        'http://184.107.106.222:3000',
        'http://184.107.106.222:8181',
        'http://184.107.106.222'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10gb' }));
app.use(express.urlencoded({ extended: true, limit: '10gb' }));

// Configuração de sessão com PostgreSQL
app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'session'
    }),
    secret: 'cloudshare_session_secret_2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true em produção com HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    }
}));

// Configurar diretórios ANTES de usar
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(UPLOAD_DIR, 'public');
const USERS_DIR = path.join(UPLOAD_DIR, 'users');

fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(PUBLIC_DIR);
fs.ensureDirSync(USERS_DIR);

// Servir arquivos estáticos
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

// Inicializar gerador de thumbnails
const thumbnailGenerator = new ThumbnailGenerator();

// Middleware para evitar problemas de protocolo e cache
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('X-Content-Type-Options', 'nosniff');
    next();
});

// Função para obter diretório do usuário
function getUserDirectory(userId) {
    const userDir = path.join(USERS_DIR, `user_${userId}`);
    fs.ensureDirSync(userDir);
    return userDir;
}

// Configuração do Multer com segurança aprimorada
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.user) {
            // Usuário logado - pasta privada
            const userDir = getUserDirectory(req.user.id);
            cb(null, userDir);
        } else {
            // Usuário não logado - pasta pública
            cb(null, PUBLIC_DIR);
        }
    },
    filename: (req, file, cb) => {
        // Manter nome original, mas verificar se já existe
        let originalName = sanitizeFilename(file.originalname);
        let finalName = originalName;
        let counter = 1;
        
        // Se arquivo já existe, adicionar contador
        const checkPath = req.user ? getUserDirectory(req.user.id) : PUBLIC_DIR;
        while (fs.existsSync(path.join(checkPath, finalName))) {
            const ext = path.extname(originalName);
            const nameWithoutExt = path.basename(originalName, ext);
            finalName = `${nameWithoutExt}(${counter})${ext}`;
            counter++;
        }
        
        cb(null, finalName);
    }
});

// Lista de tipos de arquivo permitidos
const ALLOWED_MIME_TYPES = [
    // Imagens
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    // Documentos
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown', 'application/rtf',
    // Vídeos
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv', 
    'video/quicktime', 'video/x-msvideo', 'video/3gpp', 'video/x-flv',
    // Áudios
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 
    'audio/aac', 'audio/flac', 'audio/x-wav', 'audio/x-ms-wma',
    // Compactados
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar', 'application/x-compressed', 
    'application/x-zip-compressed', 'application/x-gzip', 'application/x-bzip2',
    'application/x-lzma', 'application/x-xz', 'application/vnd.rar',
    // Executáveis e aplicações
    'application/x-msdownload', 'application/vnd.microsoft.portable-executable',
    'application/x-dosexec', 'application/vnd.android.package-archive',
    'application/java-archive', 'application/x-java-archive',
    'application/x-shockwave-flash', 'application/x-silverlight-app',
    // Outros
    'application/json', 'application/xml', 'text/html', 'text/css', 'text/javascript',
    'application/octet-stream' // Tipo genérico para arquivos binários
];

// Função para criar upload dinâmico baseado no usuário
function createDynamicUpload(req, res, next) {
    // Verificar se o usuário é admin para definir limites
    const isAdmin = req.user && req.user.is_admin;
    
    const uploadLimits = {
        fileSize: isAdmin ? Number.MAX_SAFE_INTEGER : 200 * 1024 * 1024, // Ilimitado para admin, 200MB para usuário
        files: isAdmin ? Number.MAX_SAFE_INTEGER : 50, // Ilimitado para admin, 50 para usuário
        fieldSize: isAdmin ? Number.MAX_SAFE_INTEGER : 100 * 1024 * 1024 // Ilimitado para admin, 100MB para usuário
    };
    
    const dynamicUpload = multer({ 
        storage: storage,
        limits: uploadLimits,
        fileFilter: (req, file, cb) => {
            // Aceitar qualquer tipo de arquivo
            console.log(`📁 Upload: ${file.originalname} (${file.mimetype})`);
            cb(null, true);
        }
    });
    
    return dynamicUpload.array('files', uploadLimits.files)(req, res, next);
}

// Função para sanitizar nomes de arquivo
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 100); // Limitar tamanho
}

// Função para gerar hash do arquivo
function generateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// Função para gerar fingerprint único do dispositivo/navegador
function generateDeviceFingerprint(req) {
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    
    // Criar fingerprint baseado em múltiplos fatores
    const fingerprintData = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

// Função para gerar token único de exclusão
function generateDeleteToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Função para verificar quota do usuário
async function checkUserQuota(userId, fileSize) {
    try {
        // Se não há userId, é usuário anônimo - sempre permitir (com limite global)
        if (!userId) {
            return true;
        }

        const result = await db.query(
            'SELECT storage_quota, storage_used, is_admin, is_premium FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            // Usuário não encontrado - tratar como anônimo
            return true;
        }
        
        const user = result.rows[0];
        
        // Admins têm quota ilimitada
        if (user.is_admin) {
            return true;
        }

        // Definir quota baseada no tipo de usuário
        let quotaLimit;
        if (user.is_premium) {
            quotaLimit = 50 * 1024 * 1024 * 1024; // 50GB para premium
        } else {
            quotaLimit = 6 * 1024 * 1024 * 1024; // 6GB para usuário padrão
        }

        const currentUsed = parseInt(user.storage_used) || 0;
        const newUsedSpace = currentUsed + fileSize;
        
        return newUsedSpace <= quotaLimit;
    } catch (error) {
        console.error('Erro ao verificar quota:', error);
        return false;
    }
}

// Funções para gerenciamento de pastas (compatibilidade)
async function createFolderEntry(folderName, folderPath, userId, isPublic = false) {
    try {
        // Verificar se as colunas de pasta existem
        let hasFolderColumns = false;
        try {
            await db.query('SELECT folder_path FROM files LIMIT 1');
            hasFolderColumns = true;
        } catch (error) {
            // Colunas não existem, pular criação de pasta
            console.log('⚠️ Colunas de pasta não existem, pulando criação de entrada de pasta');
            return null;
        }

        if (!hasFolderColumns) return null;

        const deviceFingerprint = generateDeviceFingerprint({ 
            headers: {}, 
            connection: { remoteAddress: '127.0.0.1' },
            get: () => null 
        });
        
        const result = await db.query(`
            INSERT INTO files (
                original_name, filename, path, size, mimetype, 
                user_id, is_public, is_folder, folder_path,
                uploader_ip, uploader_user_agent, uploader_fingerprint,
                delete_token, hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            RETURNING *
        `, [
            folderName,
            folderName,
            folderPath,
            0, // Tamanho da pasta é 0
            'folder',
            userId,
            isPublic,
            true, // is_folder
            folderPath,
            '127.0.0.1',
            'server',
            deviceFingerprint,
            generateDeleteToken(),
            '',
        ]);

        return result.rows[0];
    } catch (error) {
        console.error('Erro ao criar entrada de pasta:', error);
        return null;
    }
}

async function getFolderStructure(userId, folderPath = '') {
    try {
        // Verificar se as colunas de pasta existem
        try {
            await db.query('SELECT folder_path FROM files LIMIT 1');
        } catch (error) {
            // Sem colunas de pasta, retornar todos os arquivos
            let query = `
                SELECT * FROM files 
                WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL))
                ORDER BY original_name ASC
            `;
            const result = await db.query(query, [userId]);
            return result.rows;
        }

        let query, params;
        
        if (userId) {
            query = `
                SELECT * FROM files 
                WHERE user_id = $1 AND folder_path LIKE $2
                ORDER BY is_folder DESC, original_name ASC
            `;
            params = [userId, folderPath + '%'];
        } else {
            query = `
                SELECT * FROM files 
                WHERE user_id IS NULL AND folder_path LIKE $1
                ORDER BY is_folder DESC, original_name ASC
            `;
            params = [folderPath + '%'];
        }

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Erro ao obter estrutura de pastas:', error);
        return [];
    }
}

// Função para atualizar usage do usuário
async function updateUserStorage(userId, sizeChange) {
    try {
        await db.query(
            'UPDATE users SET storage_used = storage_used + $1 WHERE id = $2',
            [sizeChange, userId]
        );
    } catch (error) {
        console.error('Erro ao atualizar storage:', error);
    }
}

// Função para categorizar arquivos
function getFileCategory(extension) {
    const categories = {
        image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
        document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'],
        video: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
        audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
        archive: ['zip', 'rar', '7z', 'tar', 'gz'],
        code: ['html', 'css', 'js', 'php', 'py', 'java', 'cpp', 'c', 'sql'],
        executable: ['exe', 'msi', 'deb', 'rpm', 'dmg', 'app', 'apk'],
        macro: ['macro', 'vbs', 'bat', 'cmd', 'ps1'],
        other: []
    };

    const ext = extension.toLowerCase();
    for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(ext)) {
            return category;
        }
    }
    return 'other';
}

// ===========================================
// ROTAS DE AUTENTICAÇÃO
// ===========================================

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username e senha são obrigatórios'
            });
        }

        const result = await auth.login(username, password);
        
        // Salvar na sessão
        req.session.userId = result.user.id;
        req.session.user = result.user;

        // Criar token JWT com duração de 3 dias
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                userId: result.user.id, 
                username: result.user.username,
                is_admin: result.user.is_admin 
            }, 
            'cloudshare_jwt_secret_2025', 
            { expiresIn: '3d' }
        );

        // Log da atividade
        await auth.logActivity(result.user.id, 'login', null, null, null, req);

        res.json({
            ...result,
            token: token,
            expiresIn: 3 * 24 * 60 * 60 * 1000 // 3 dias em ms
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Registro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email e senha são obrigatórios'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }

        const result = await auth.register({ username, email, password, fullName });
        
        // Salvar na sessão
        req.session.userId = result.user.id;
        req.session.user = result.user;

        // Criar token JWT com duração de 3 dias
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                userId: result.user.id, 
                username: result.user.username,
                is_admin: result.user.is_admin 
            }, 
            'cloudshare_jwt_secret_2025', 
            { expiresIn: '3d' }
        );

        // Log da atividade
        await auth.logActivity(result.user.id, 'register', null, null, null, req);

        res.json({
            ...result,
            token: token,
            expiresIn: 3 * 24 * 60 * 60 * 1000 // 3 dias em ms
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao fazer logout'
            });
        }
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
});

// Sistema de Recuperação de Senha via Email
const emailService = require('./email-service');

// Solicitar código de recuperação (envia email)
app.post('/api/auth/request-reset', loginLimiter, async (req, res) => {
    try {
        const { identifier } = req.body; // email ou username

        if (!identifier) {
            return res.status(400).json({
                success: false,
                message: 'Email ou usuário é obrigatório'
            });
        }

        // Verificar se o usuário existe
        const userResult = await db.query(
            'SELECT id, username, email FROM users WHERE email = $1 OR username = $1',
            [identifier]
        );

        if (userResult.rows.length === 0) {
            // Por segurança, não revelar se o usuário existe ou não
            return res.json({
                success: true,
                message: 'Se este email estiver cadastrado, você receberá um código de recuperação.'
            });
        }

        const user = userResult.rows[0];

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: 'Este usuário não possui email cadastrado'
            });
        }

        // Gerar código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        console.log(`🔑 Gerando código de recuperação:`, {
            code: code,
            user_id: user.id,
            username: user.username,
            email: user.email,
            expires_in_minutes: 10
        });

        // Salvar código no banco - usar NOW() do PostgreSQL para evitar diferença de timezone
        const insertResult = await db.query(
            `INSERT INTO password_reset_codes (user_id, code, email, expires_at, ip_address, user_agent)
             VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', $4, $5)
             RETURNING id, code, created_at, expires_at`,
            [user.id, code, user.email, req.ip, req.headers['user-agent']]
        );
        
        console.log(`✅ Código salvo no banco:`, insertResult.rows[0]);

        // Enviar email
        const emailResult = await emailService.sendPasswordResetEmail(user.email, code, user.username);

        if (emailResult.success) {
            console.log(`📧 Código de recuperação enviado para ${user.email}`);
            res.json({
                success: true,
                message: `Código de recuperação enviado para ${user.email.replace(/(.{2}).*(@.*)/, '$1***$2')}`
            });
        } else {
            // Mesmo com falha no email, informar que o código foi gerado
            console.error('❌ Erro ao enviar email:', emailResult.error);
            console.log(`🔑 CÓDIGO DE RECUPERAÇÃO GERADO: ${code} (válido por 10 minutos)`);
            console.log(`👤 Para usuário: ${user.username} (${user.email})`);
            
            // Retornar sucesso com aviso
            res.json({
                success: true,
                message: `Código gerado com sucesso. (Email não enviado - verifique o console do servidor)`,
                debug: process.env.NODE_ENV === 'development' ? { code } : undefined
            });
        }

    } catch (error) {
        console.error('Erro ao solicitar recuperação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar solicitação: ' + error.message
        });
    }
});

// Verificar código de recuperação
app.post('/api/auth/verify-reset-code', loginLimiter, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Código inválido'
            });
        }

        // Buscar código válido
        const codeResult = await db.query(
            `SELECT prc.id, prc.user_id, prc.expires_at, u.username, u.email
             FROM password_reset_codes prc
             JOIN users u ON prc.user_id = u.id
             WHERE prc.code = $1 AND prc.used = FALSE AND prc.expires_at > NOW()
             ORDER BY prc.created_at DESC
             LIMIT 1`,
            [code]
        );

        if (codeResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        const resetCode = codeResult.rows[0];

        res.json({
            success: true,
            message: 'Código válido',
            username: resetCode.username,
            resetCodeId: resetCode.id
        });

    } catch (error) {
        console.error('Erro ao verificar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar código: ' + error.message
        });
    }
});

// Resetar senha com código válido
app.post('/api/auth/reset-password-with-code', loginLimiter, async (req, res) => {
    try {
        const { code, newPassword } = req.body;

        if (!code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Código e nova senha são obrigatórios'
            });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'A senha deve ter pelo menos 4 caracteres'
            });
        }

        // Buscar e validar código
        console.log(`🔍 Buscando código: "${code}" (tipo: ${typeof code})`);
        
        const codeResult = await db.query(
            `SELECT prc.id, prc.user_id, prc.code, prc.expires_at, prc.used, 
                    u.username, NOW() as current_time
             FROM password_reset_codes prc
             JOIN users u ON prc.user_id = u.id
             WHERE prc.code = $1 AND prc.used = FALSE AND prc.expires_at > NOW()
             ORDER BY prc.created_at DESC
             LIMIT 1`,
            [code]
        );
        
        console.log(`📊 Resultado da busca:`, {
            rows_found: codeResult.rows.length,
            code_searched: code
        });

        if (codeResult.rows.length === 0) {
            // Debug: buscar todos os códigos para este código sem filtros
            const debugResult = await db.query(
                `SELECT prc.id, prc.code, prc.expires_at, prc.used, 
                        NOW() as current_time, u.username
                 FROM password_reset_codes prc
                 JOIN users u ON prc.user_id = u.id
                 WHERE prc.code = $1
                 ORDER BY prc.created_at DESC
                 LIMIT 1`,
                [code]
            );
            
            if (debugResult.rows.length > 0) {
                const dbCode = debugResult.rows[0];
                console.log(`🐛 DEBUG - Código encontrado mas inválido:`, {
                    code_db: dbCode.code,
                    expires_at: dbCode.expires_at,
                    current_time: dbCode.current_time,
                    used: dbCode.used,
                    expired: new Date(dbCode.expires_at) < new Date(dbCode.current_time)
                });
                
                if (dbCode.used) {
                    return res.status(400).json({
                        success: false,
                        message: 'Este código já foi utilizado'
                    });
                }
                
                if (new Date(dbCode.expires_at) < new Date(dbCode.current_time)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Código expirado. Solicite um novo código.'
                    });
                }
            }
            
            return res.status(400).json({
                success: false,
                message: 'Código inválido ou expirado'
            });
        }

        const resetData = codeResult.rows[0];

        // Gerar novo hash da senha
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Atualizar senha
        await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, resetData.user_id]
        );

        // Marcar código como usado
        await db.query(
            'UPDATE password_reset_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
            [resetData.id]
        );

        // Log da atividade
        await auth.logActivity(resetData.user_id, 'password_reset_email', null, null, null, req);

        console.log(`✅ Senha resetada para usuário: ${resetData.username}`);

        res.json({
            success: true,
            message: 'Senha atualizada com sucesso! Você já pode fazer login.',
            username: resetData.username
        });

    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao resetar senha: ' + error.message
        });
    }
});

// Verificar status da autenticação
app.get('/api/auth/me', auth.optionalAuth, async (req, res) => {
    if (req.user) {
        // Obter estatísticas do usuário
        const statsResult = await db.query(
            'SELECT storage_quota, storage_used FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const filesResult = await db.query(
            'SELECT COUNT(*) as file_count FROM files WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            user: {
                ...req.user,
                storage_quota: statsResult.rows[0]?.storage_quota || 0,
                storage_used: statsResult.rows[0]?.storage_used || 0,
                file_count: parseInt(filesResult.rows[0]?.file_count || 0)
            }
        });
    } else {
        res.json({ success: false, user: null });
    }
});

// ===========================================
// ROTAS DE USUÁRIO
// ===========================================

// Obter informações do usuário logado
app.get('/api/user', auth.authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, is_admin, is_premium, storage_quota, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: user.is_admin,
                isPremium: user.is_premium,
                storageQuota: user.storage_quota,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar informações do usuário'
        });
    }
});

// Atualizar perfil do usuário
app.put('/api/user/profile', auth.authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }

        // Verificar se email já está em uso por outro usuário
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, req.user.id]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Este email já está em uso'
            });
        }

        // Atualizar email
        await db.query(
            'UPDATE users SET email = $1 WHERE id = $2',
            [email, req.user.id]
        );

        console.log(`✅ Perfil atualizado: usuário ${req.user.username}`);

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar perfil'
        });
    }
});

// Alterar senha do usuário logado
app.post('/api/user/change-password', auth.authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Preencha todos os campos'
            });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'A nova senha deve ter pelo menos 4 caracteres'
            });
        }

        // Buscar senha atual do usuário
        const userResult = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // Verificar senha atual
        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Senha atual incorreta'
            });
        }

        // Hash da nova senha
        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        // Atualizar senha
        await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, req.user.id]
        );

        // Log da atividade
        await auth.logActivity(req.user.id, 'password_change', null, null, null, req);

        console.log(`✅ Senha alterada: usuário ${req.user.username}`);

        res.json({
            success: true,
            message: 'Senha alterada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao alterar senha'
        });
    }
});

// ===========================================
// ROTAS DE UPLOAD
// ===========================================

// Upload de arquivos com segurança aprimorada
app.post('/api/upload', uploadLimiter, auth.optionalAuth, createDynamicUpload, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo foi enviado'
            });
        }

        // Verificar quota antes de processar arquivos
        if (req.user && !req.user.is_admin) {
            const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
            const hasSpace = await checkUserQuota(req.user.id, totalSize);
            
            if (!hasSpace) {
                // Remover arquivos temporários
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
                
                return res.status(413).json({
                    success: false,
                    message: 'Quota de armazenamento excedida'
                });
            }
        }

        const uploadedFiles = [];
        const isFolder = req.body.isFolder === 'true';
        const folderName = req.body.folderName;
        const relativePaths = req.body.relativePaths;
        const createdFolders = new Set(); // Para evitar criar a mesma pasta múltiplas vezes
        
        // Processar cada arquivo
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            let targetPath = file.path;
            let displayPath = file.originalname;
            let folderPath = '';
            
            // Se for upload de pasta, organizar estrutura
            if (isFolder && relativePaths) {
                const relativePath = Array.isArray(relativePaths) ? relativePaths[i] : relativePaths;
                if (relativePath) {
                    // Extrair caminho da pasta
                    const pathParts = relativePath.split('/');
                    if (pathParts.length > 1) {
                        folderPath = pathParts.slice(0, -1).join('/');
                        displayPath = relativePath;
                        
                        // Criar estrutura de diretórios no sistema de arquivos
                        if (req.user) {
                            const userDir = getUserDirectory(req.user.id);
                            const fullDirPath = path.join(userDir, folderPath);
                            fs.ensureDirSync(fullDirPath);
                            
                            // Mover arquivo para a pasta correta
                            const newTargetPath = path.join(userDir, relativePath);
                            fs.ensureDirSync(path.dirname(newTargetPath));
                            fs.moveSync(targetPath, newTargetPath);
                            targetPath = newTargetPath;
                        } else {
                            // Para usuários anônimos, usar pasta pública
                            const fullDirPath = path.join(PUBLIC_DIR, folderPath);
                            fs.ensureDirSync(fullDirPath);
                            
                            const newTargetPath = path.join(PUBLIC_DIR, relativePath);
                            fs.ensureDirSync(path.dirname(newTargetPath));
                            fs.moveSync(targetPath, newTargetPath);
                            targetPath = newTargetPath;
                        }
                        
                        // Criar entradas de pasta no banco se ainda não existem
                        const folderSegments = folderPath.split('/');
                        let currentPath = '';
                        
                        for (const segment of folderSegments) {
                            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
                            const folderKey = `${req.user?.id || 'public'}_${currentPath}`;
                            
                            if (!createdFolders.has(folderKey)) {
                                // Verificar se a pasta já existe no banco
                                const existingFolder = await db.query(
                                    'SELECT id FROM files WHERE folder_path = $1 AND is_folder = true AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL))',
                                    [currentPath, req.user?.id || null]
                                );
                                
                                if (existingFolder.rows.length === 0) {
                                    await createFolderEntry(
                                        segment,
                                        req.user ? path.join(getUserDirectory(req.user.id), currentPath) : path.join(PUBLIC_DIR, currentPath),
                                        req.user?.id || null,
                                        !req.user
                                    );
                                }
                                
                                createdFolders.add(folderKey);
                            }
                        }
                    }
                }
            }
            
            const fileExtension = path.extname(file.originalname).substring(1);
            const category = getFileCategory(fileExtension);
            
            // Gerar hash do arquivo para detecção de duplicatas
            const fileHash = await generateFileHash(targetPath);
            
            // Verificar se arquivo já existe (mesmo hash) apenas se não for pasta
            let finalOriginalName = file.originalname;
            if (!isFolder) {
                const duplicateCheck = await db.query(
                    'SELECT id, original_name, user_id FROM files WHERE file_hash = $1',
                    [fileHash]
                );

                if (duplicateCheck.rows.length > 0) {
                    const existingFile = duplicateCheck.rows[0];
                    const currentUserId = req.user ? req.user.id : null;
                    
                    // Verificar se o arquivo duplicado pertence ao MESMO usuário
                    if (existingFile.user_id === currentUserId) {
                        // MESMA CONTA: retornar erro pedindo confirmação para substituir
                        fs.unlinkSync(targetPath);
                        return res.status(409).json({
                            success: false,
                            message: `Você já tem um arquivo idêntico chamado "${existingFile.original_name}". Deseja substituir?`,
                            error_code: 'DUPLICATE_SAME_USER',
                            existing_file: {
                                id: existingFile.id,
                                name: existingFile.original_name
                            }
                        });
                    } else {
                        // OUTRA CONTA: renomear automaticamente e fazer upload
                        console.log(`⚠️ Arquivo duplicado de outro usuário: ${file.originalname}`);
                        
                        // Extrair nome e extensão
                        const ext = path.extname(file.originalname);
                        const nameWithoutExt = path.basename(file.originalname, ext);
                        
                        // Encontrar próximo número disponível
                        let counter = 1;
                        let newName;
                        let nameExists = true;
                        
                        while (nameExists) {
                            newName = `${nameWithoutExt} (${counter})${ext}`;
                            const checkName = await db.query(
                                'SELECT id FROM files WHERE original_name = $1 AND user_id = $2',
                                [newName, currentUserId]
                            );
                            if (checkName.rows.length === 0) {
                                nameExists = false;
                            } else {
                                counter++;
                            }
                        }
                        
                        finalOriginalName = newName;
                        console.log(`✅ Arquivo de outro usuário - renomeado para: ${finalOriginalName}`);
                    }
                }
            }
            
            // Gerar informações de identificação
            const deviceFingerprint = generateDeviceFingerprint(req);
            const deleteToken = generateDeleteToken();
            const uploaderIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
            const uploaderUserAgent = req.get('User-Agent') || 'unknown';
            
            // Atualizar displayPath se o arquivo foi renomeado
            if (finalOriginalName !== file.originalname) {
                displayPath = finalOriginalName;
            }
            
            // Salvar no banco de dados com informações de identificação
            // Verificar se colunas de pasta existem
            let hasFolderColumns = false;
            try {
                await db.query('SELECT folder_path FROM files LIMIT 1');
                hasFolderColumns = true;
            } catch (error) {
                // Colunas não existem
            }

            let insertQuery, insertParams;
            
            if (hasFolderColumns) {
                insertQuery = `
                    INSERT INTO files (user_id, original_name, filename, mimetype, size, path, file_hash, is_public, folder_path, 
                                      uploader_ip, uploader_user_agent, uploader_fingerprint, delete_token)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING id, created_at
                `;
                // Se não logado: sempre público. Se logado: usa escolha do usuário (padrão: privado)
                const isPublicFlag = req.user ? (req.body.isPublic === 'true') : true;
                insertParams = [
                    req.user ? req.user.id : null,
                    displayPath,
                    path.basename(targetPath),
                    file.mimetype,
                    file.size,
                    targetPath,
                    fileHash,
                    isPublicFlag,
                    folderPath,
                    uploaderIp,
                    uploaderUserAgent,
                    deviceFingerprint,
                    deleteToken
                ];
            } else {
                // Versão sem colunas de pasta
                insertQuery = `
                    INSERT INTO files (user_id, original_name, filename, mimetype, size, path, file_hash, is_public, 
                                      uploader_ip, uploader_user_agent, uploader_fingerprint, delete_token)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id, created_at
                `;
                const isPublicFlagAlt = req.user ? (req.body.isPublic === 'true') : true;
                insertParams = [
                    req.user ? req.user.id : null,
                    displayPath,
                    path.basename(targetPath),
                    file.mimetype,
                    file.size,
                    targetPath,
                    fileHash,
                    isPublicFlagAlt,
                    uploaderIp,
                    uploaderUserAgent,
                    deviceFingerprint,
                    deleteToken
                ];
            }

            const fileResult = await db.query(insertQuery, insertParams);

            // Atualizar storage do usuário se logado
            if (req.user) {
                await updateUserStorage(req.user.id, file.size);
            }

            const uploadedFile = {
                id: fileResult.rows[0].id,
                originalName: displayPath,
                filename: path.basename(targetPath),
                size: file.size,
                type: file.mimetype,
                category: category,
                hash: fileHash.substring(0, 8),
                uploadedAt: fileResult.rows[0].created_at,
                isPublic: req.user ? (req.body.isPublic === 'true') : true,
                folderPath: folderPath,
                deleteToken: deleteToken
            };

            uploadedFiles.push(uploadedFile);

            // Log da atividade
            await auth.logActivity(
                req.user ? req.user.id : null,
                isFolder ? 'upload_folder' : 'upload',
                'file',
                fileResult.rows[0].id,
                { 
                    originalName: displayPath, 
                    size: file.size, 
                    category, 
                    hash: fileHash.substring(0, 8),
                    folderName: isFolder ? folderName : null
                },
                req
            );
        }

        const message = isFolder 
            ? `Pasta "${folderName}" com ${uploadedFiles.length} arquivo(s) enviada com sucesso`
            : `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`;

        res.json({
            success: true,
            message: message,
            files: uploadedFiles
        });

    } catch (error) {
        console.error('Erro no upload:', error);
        
        // Limpar arquivos se houver erro
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor: ' + error.message
        });
    }
});

// Middleware para tratar erros do Multer
app.use((error, req, res, next) => {
    console.error('❌ Erro capturado pelo middleware:', {
        error: error.message,
        code: error.code,
        type: error.constructor.name,
        url: req.url,
        method: req.method
    });

    if (error instanceof multer.MulterError) {
        let message = 'Erro no upload: ';
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                const userType = req.user && req.user.is_admin ? 'admin' : 'usuário';
                message += userType === 'admin' ? 
                    `Arquivo muito grande. Como admin, você tem upload ilimitado - verifique se o arquivo não está corrompido.` :
                    `Arquivo muito grande. Tamanho máximo: 200MB para usuários`;
                break;
            case 'LIMIT_FILE_COUNT':
                message += `Muitos arquivos. Máximo: ilimitado para admins, 50 para usuários`;
                break;
            case 'LIMIT_FIELD_COUNT':
                message += `Muitos campos no formulário`;
                break;
            case 'LIMIT_FIELD_KEY':
                message += `Nome do campo muito longo`;
                break;
            case 'LIMIT_FIELD_VALUE':
                message += `Valor do campo muito longo`;
                break;
            case 'LIMIT_PART_COUNT':
                message += `Muitas partes no upload`;
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message += `Campo de arquivo não esperado`;
                break;
            default:
                message += error.message;
        }
        
        return res.status(400).json({
            success: false,
            message: message,
            errorCode: error.code
        });
    }
    
    // Para outros tipos de erro relacionados ao upload
    if (error.message && error.message.includes('Tipo de arquivo não permitido')) {
        console.error('❌ Tipo de arquivo não permitido:', error.message);
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    if (error.message && error.message.includes('Quota excedida')) {
        console.error('❌ Quota excedida:', error.message);
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    if (error.message && error.message.includes('muito grande')) {
        console.error('❌ Arquivo muito grande:', error.message);
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    // Tratar erros específicos de parsing multipart
    if (error.message && (error.message.includes('Malformed part header') || 
                          error.message.includes('Unexpected end of form') ||
                          error.message.includes('Bad boundary'))) {
        console.error('❌ Erro de parsing multipart:', error.message);
        return res.status(400).json({
            success: false,
            message: 'Erro no formato do upload. Tente novamente ou use arquivos menores.'
        });
    }
    
    // Para erros não tratados, evitar crash do servidor
    console.error('❌ Erro não tratado:', error);
    
    // Se a resposta ainda não foi enviada, enviar resposta de erro genérico
    if (!res.headersSent) {
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor durante o upload'
        });
    }
    
    // Se já enviou headers, não chamar next() para evitar crash
});

// ===========================================
// ROTAS DE LISTAGEM
// ===========================================

// Listar arquivos
// ─── Alternar visibilidade público/privado ───────────────────────────────────
app.patch('/api/files/:id/visibility', auth.authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        
        // Buscar arquivo
        const fileResult = await db.query(
            'SELECT id, user_id, is_public, original_name FROM files WHERE id = $1',
            [fileId]
        );
        
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
        }
        
        const file = fileResult.rows[0];
        
        // Verificar propriedade
        if (file.user_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ success: false, message: 'Sem permissão para alterar este arquivo' });
        }
        
        const newVisibility = !file.is_public;
        
        await db.query('UPDATE files SET is_public = $1 WHERE id = $2', [newVisibility, fileId]);
        
        res.json({
            success: true,
            message: newVisibility ? 'Arquivo tornado público' : 'Arquivo tornado privado',
            isPublic: newVisibility
        });
    } catch (error) {
        console.error('Erro ao alterar visibilidade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/files', auth.optionalAuth, async (req, res) => {
    try {
        const { search, category, sort = 'created_at', order = 'DESC', public_only, folder = '' } = req.query;
        
        // Primeiro verificar se as colunas de pasta existem
        let hasFolderColumns = false;
        try {
            await db.query('SELECT folder_path FROM files LIMIT 1');
            hasFolderColumns = true;
        } catch (error) {
            console.log('⚠️ Colunas de pasta não existem ainda, funcionando sem suporte a pastas');
        }
        
        let query = `
            SELECT f.*, u.username as owner_username,
                   CASE WHEN u.username = 'public' THEN true ELSE false END as is_from_public_folder
            FROM files f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramCount = 0;

        // Filtrar por pasta específica (apenas se as colunas existirem)
        if (hasFolderColumns && folder !== undefined && folder !== '') {
            paramCount++;
            query += ` AND f.folder_path = $${paramCount}`;
            queryParams.push(folder);
        } else if (hasFolderColumns && folder === '') {
            // Para pasta raiz, mostrar arquivos com folder_path vazio, NULL, ou "."
            query += ` AND (f.folder_path = '' OR f.folder_path IS NULL OR f.folder_path = '.')`;
        }

        // Filtrar por visibilidade
        if (public_only === 'true' || !req.user) {
            // Apenas arquivos públicos
            query += ' AND f.is_public = true';
        } else {
            // Arquivos do usuário + arquivos públicos
            query += ` AND (f.user_id = $${++paramCount} OR f.is_public = true)`;
            queryParams.push(req.user.id);
        }

        // Filtro de busca
        if (search) {
            query += ` AND f.original_name ILIKE $${++paramCount}`;
            queryParams.push(`%${search}%`);
        }

        // Filtro de categoria
        if (category && category !== 'all') {
            // Será implementado com base na extensão
            const categoryExtensions = {
                image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
                document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
                video: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
                audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
                archive: ['zip', 'rar', '7z', 'tar', 'gz'],
                executable: ['exe', 'msi', 'apk', 'dmg', 'app']
            };
            
            if (categoryExtensions[category]) {
                const extensions = categoryExtensions[category].map(ext => `%${ext}`).join('%\' OR f.original_name ILIKE \'%');
                query += ` AND (f.original_name ILIKE '%${extensions}%')`;
            }
        }

        // Ordenação
        const validSorts = ['created_at', 'original_name', 'size'];
        const validOrders = ['ASC', 'DESC'];
        
        if (validSorts.includes(sort) && validOrders.includes(order.toUpperCase())) {
            query += ` ORDER BY f.${sort} ${order.toUpperCase()}`;
        }

        const result = await db.query(query, queryParams);
        
        // Gerar fingerprint do dispositivo atual para verificar permissões
        const currentFingerprint = generateDeviceFingerprint(req);
        
        const files = result.rows.map(file => {
            let canDelete = false;
            let deleteToken = null;
            
            // Verificar se pode excluir
            if (req.user) {
                // Usuário logado: pode excluir se for o dono ou admin
                if (file.user_id === req.user.id || req.user.is_admin) {
                    canDelete = true;
                }
            } else {
                // Usuário não logado: pode excluir se for arquivo público do mesmo dispositivo
                if (file.is_public && file.uploader_fingerprint === currentFingerprint) {
                    canDelete = true;
                    deleteToken = file.delete_token; // Incluir token para exclusão
                }
            }
            
            return {
                id: file.id,
                originalName: file.original_name,
                filename: file.filename,
                size: file.size,
                type: file.mimetype,
                category: getFileCategory(path.extname(file.original_name).substring(1)),
                uploadedAt: file.created_at,
                downloadCount: file.download_count,
                isPublic: file.is_public,
                owner: file.owner_username,
                isOwner: req.user && file.user_id === req.user.id,
                canDelete: canDelete,
                deleteToken: deleteToken // Só incluir se necessário para exclusão
            };
        });

        res.json({
            success: true,
            files: files,
            total: files.length
        });

    } catch (error) {
        console.error('Erro ao listar arquivos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ===========================================
// ROTAS DE DOWNLOAD
// ===========================================

// Download de arquivo
app.get('/api/download/:id', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        let result;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            result = await db.query(
                'SELECT * FROM files WHERE id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            result = await db.query(
                'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
                [decodedFilename]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        const file = result.rows[0];

        // Verificar permissões
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        const filePath = file.path;

        // Verificar se arquivo existe no sistema
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado no sistema'
            });
        }

        // Incrementar contador de downloads
        await db.query(
            'UPDATE files SET download_count = download_count + 1 WHERE id = $1',
            [fileId]
        );

        // Log da atividade
        await auth.logActivity(
            req.user ? req.user.id : null,
            'download',
            'file',
            fileId,
            { filename: file.original_name },
            req
        );

        // Definir headers para download
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        
        // Enviar arquivo
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('Erro no download:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Download de pasta como ZIP
app.get('/api/download-folder', auth.optionalAuth, async (req, res) => {
    try {
        const { folder = '', userId } = req.query;
        
        // Verificar permissões
        const targetUserId = req.user ? req.user.id : null;
        if (userId && userId !== String(targetUserId) && !req.user?.is_admin) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        // Buscar arquivos da pasta
        const filesResult = await db.query(`
            SELECT * FROM files 
            WHERE folder_path LIKE $1 AND is_folder = false AND (
                (user_id = $2) OR 
                (user_id IS NULL AND is_public = true) OR
                ($2 IS NULL AND is_public = true)
            )
            ORDER BY folder_path, original_name
        `, [`${folder}%`, targetUserId]);

        if (filesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum arquivo encontrado na pasta'
            });
        }

        const archiver = require('archiver');
        const archive = archiver('zip', {
            zlib: { level: 9 } // Máxima compressão
        });

        // Configurar headers para download
        const folderName = folder || 'arquivos';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);

        // Pipe do archive para a resposta
        archive.pipe(res);

        // Adicionar arquivos ao ZIP
        for (const file of filesResult.rows) {
            if (fs.existsSync(file.path)) {
                const relativePath = file.original_name;
                archive.file(file.path, { name: relativePath });
            }
        }

        // Finalizar o ZIP
        await archive.finalize();

    } catch (error) {
        console.error('Erro no download de pasta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ===========================================
// ROTAS DE EXCLUSÃO
// ===========================================

// Excluir arquivo (suporta usuários logados e anônimos com token)
app.delete('/api/files/:id', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        const deleteToken = req.body.deleteToken || req.query.deleteToken;
        let result;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            result = await db.query(
                'SELECT * FROM files WHERE id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            result = await db.query(
                'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
                [decodedFilename]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        const file = result.rows[0];
        let canDelete = false;
        let deleteReason = '';

        // Verificar permissões
        if (req.user) {
            // Usuário logado: pode excluir se for o dono ou admin
            if (file.user_id === req.user.id) {
                canDelete = true;
                deleteReason = 'owner';
            } else if (req.user.is_admin) {
                canDelete = true;
                deleteReason = 'admin';
            }
        }

        // Se não pode excluir por estar logado, verificar token de exclusão
        if (!canDelete && deleteToken) {
            if (file.delete_token === deleteToken) {
                canDelete = true;
                deleteReason = 'delete_token';
            }
        }

        // Se ainda não pode excluir, verificar fingerprint para arquivos públicos
        if (!canDelete && !file.user_id) {
            const currentFingerprint = generateDeviceFingerprint(req);
            if (file.uploader_fingerprint === currentFingerprint) {
                canDelete = true;
                deleteReason = 'device_fingerprint';
            }
        }

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Você só pode excluir arquivos que enviou.'
            });
        }

        // Excluir arquivo do sistema de arquivos
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Excluir registro do banco
        await db.query('DELETE FROM files WHERE id = $1', [fileId]);

        // Atualizar storage do usuário se logado
        if (file.user_id) {
            await updateUserStorage(file.user_id, -file.size);
        }

        // Log da atividade
        await auth.logActivity(
            req.user ? req.user.id : null,
            'delete',
            'file',
            fileId,
            { 
                filename: file.original_name, 
                size: file.size, 
                deleteReason: deleteReason,
                deleteToken: deleteToken ? 'provided' : 'not_provided'
            },
            req
        );

        res.json({
            success: true,
            message: 'Arquivo excluído com sucesso'
        });

    } catch (error) {
        console.error('Erro na exclusão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ===========================================
// ROTAS ADMINISTRATIVAS
// ===========================================

// Listar todos os usuários (admin only)
app.get('/api/admin/users', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.full_name, u.is_admin, u.is_active,
                   u.storage_quota, u.storage_used, u.created_at, u.last_login,
                   COUNT(f.id) as file_count
            FROM users u
            LEFT JOIN files f ON u.id = f.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Estatísticas do sistema (admin only)
app.get('/api/admin/stats', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const [usersResult, filesResult, storageResult, downloadsResult] = await Promise.all([
            db.query('SELECT COUNT(*) as total_users FROM users WHERE is_active = true'),
            db.query('SELECT COUNT(*) as total_files FROM files'),
            db.query('SELECT SUM(size) as total_storage FROM files'),
            db.query('SELECT SUM(download_count) as total_downloads FROM files')
        ]);

        const totalStorage = Math.round((parseInt(storageResult.rows[0].total_storage || 0)) / (1024 * 1024 * 1024) * 100) / 100;

        res.json({
            success: true,
            totalUsers: parseInt(usersResult.rows[0].total_users),
            totalFiles: parseInt(filesResult.rows[0].total_files),
            totalStorage: totalStorage,
            totalDownloads: parseInt(downloadsResult.rows[0].total_downloads || 0)
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Listar usuários (admin only)
app.get('/api/admin/users', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.user_type, 
                u.upload_limit, 
                u.storage_quota, 
                u.is_active, 
                u.created_at,
                COALESCE(SUM(f.size), 0) / (1024 * 1024 * 1024) as used_storage
            FROM users u
            LEFT JOIN files f ON u.id = f.user_id
            GROUP BY u.id, u.username, u.email, u.user_type, u.upload_limit, u.storage_quota, u.is_active, u.created_at
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows.map(user => ({
            ...user,
            used_storage: Math.round(user.used_storage * 100) / 100
        })));
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar usuário (admin only)
app.post('/api/admin/users', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const { username, email, password, userType, uploadLimit, storageQuota, isActive } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
        }
        
        // Verificar se usuário já existe
        const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Nome de usuário já existe' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(`
            INSERT INTO users (username, email, password, user_type, upload_limit, storage_quota, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, username, email, user_type, upload_limit, storage_quota, is_active, created_at
        `, [username, email, hashedPassword, userType, uploadLimit, storageQuota, isActive]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Editar usuário (admin only)
app.put('/api/admin/users/:id', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, password, userType, uploadLimit, storageQuota, isActive } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
        }
        
        // Verificar se usuário existe
        const userExists = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        let updateQuery = `
            UPDATE users 
            SET username = $1, email = $2, user_type = $3, upload_limit = $4, storage_quota = $5, is_active = $6
            WHERE id = $7
            RETURNING id, username, email, user_type, upload_limit, storage_quota, is_active, created_at
        `;
        let queryParams = [username, email, userType, uploadLimit, storageQuota, isActive, userId];
        
        // Se senha foi fornecida, incluir na atualização
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = `
                UPDATE users 
                SET username = $1, email = $2, password = $3, user_type = $4, upload_limit = $5, storage_quota = $6, is_active = $7
                WHERE id = $8
                RETURNING id, username, email, user_type, upload_limit, storage_quota, is_active, created_at
            `;
            queryParams = [username, email, hashedPassword, userType, uploadLimit, storageQuota, isActive, userId];
        }
        
        const result = await db.query(updateQuery, queryParams);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Ativar/desativar usuário (admin only)
app.put('/api/admin/users/:id/toggle', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const result = await db.query(`
            UPDATE users 
            SET is_active = NOT is_active
            WHERE id = $1
            RETURNING is_active
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json({ success: true, is_active: result.rows[0].is_active });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Excluir usuário (admin only)
app.delete('/api/admin/users/:id', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Não permitir que admin exclua a si mesmo
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
        }
        
        // Excluir arquivos do usuário primeiro
        await db.query('DELETE FROM files WHERE user_id = $1', [userId]);
        
        // Excluir usuário
        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ===========================================
// INICIALIZAÇÃO DO SERVIDOR
// ===========================================

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CloudShare Server está funcionando',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// ===========================================
// ROTAS DE PREVIEW
// ===========================================

// Preview de arquivo (para imagens, vídeos, PDFs)
app.get('/api/preview/:id', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        let result;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            result = await db.query(
                'SELECT * FROM files WHERE id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            result = await db.query(
                'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
                [decodedFilename]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        const file = result.rows[0];

        // Verificar permissões
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        const filePath = file.path;

        // Verificar se arquivo existe no sistema
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado no sistema'
            });
        }

        // Verificar se o tipo de arquivo permite preview
        const previewableMimes = [
            // Imagens
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
            // Vídeos
            'video/mp4', 'video/webm', 'video/ogg',
            // PDFs
            'application/pdf',
            // Textos
            'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv',
            'application/json', 'application/xml'
        ];

        if (!previewableMimes.includes(file.mimetype)) {
            return res.status(415).json({
                success: false,
                message: 'Tipo de arquivo não suporta preview'
            });
        }

        // Log da atividade de preview
        await auth.logActivity(
            req.user ? req.user.id : null,
            'preview',
            'file',
            fileId,
            { filename: file.original_name },
            req
        );

        // Definir headers apropriados
        res.setHeader('Content-Type', file.mimetype);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
        
        // Enviar arquivo para preview
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('Erro no preview:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para gerar thumbnail
app.get('/api/files/:id/thumbnail', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        let fileResult;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            fileResult = await db.query(
                'SELECT * FROM files WHERE id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            fileResult = await db.query(
                'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
                [decodedFilename]
            );
        }
        
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
        }
        
        const file = fileResult.rows[0];
        
        // Verificar permissões
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({ success: false, message: 'Acesso negado' });
        }
        
        // Gerar thumbnail
        const thumbnailUrl = await thumbnailGenerator.generateThumbnail(
            file.path, 
            file.id, 
            file.mimetype
        );
        
        if (thumbnailUrl) {
            res.json({ success: true, thumbnailUrl });
        } else {
            res.json({ 
                success: false, 
                icon: thumbnailGenerator.getDefaultIcon(file.mimetype)
            });
        }
    } catch (error) {
        console.error('Erro ao gerar thumbnail:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

// Obter informações detalhadas do arquivo (metadados)
app.get('/api/files/:id/info', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        let result;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            result = await db.query(
                'SELECT f.*, u.username as owner_username FROM files f LEFT JOIN users u ON f.user_id = u.id WHERE f.id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            result = await db.query(
                'SELECT f.*, u.username as owner_username FROM files f LEFT JOIN users u ON f.user_id = u.id WHERE f.filename = $1 OR f.original_name = $1',
                [decodedFilename]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        const file = result.rows[0];

        // Verificar permissões
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        const filePath = file.path;
        const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        const fileExtension = path.extname(file.original_name).substring(1);
        
        // Verificar se suporta preview
        const previewableMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
            'video/mp4', 'video/webm', 'video/ogg',
            'application/pdf',
            'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv',
            'application/json', 'application/xml'
        ];

        const fileInfo = {
            id: file.id,
            originalName: file.original_name,
            filename: file.filename,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.mimetype,
            extension: fileExtension,
            category: getFileCategory(fileExtension),
            uploadedAt: file.created_at,
            downloadCount: file.download_count,
            isPublic: file.is_public,
            owner: file.owner_username,
            isOwner: req.user && file.user_id === req.user.id,
            canPreview: previewableMimes.includes(file.mimetype),
            fileExists: fileStats !== null,
            lastModified: fileStats ? fileStats.mtime : null,
            hash: file.file_hash ? file.file_hash.substring(0, 8) : null,
            folderPath: file.folder_path
        };

        res.json({
            success: true,
            file: fileInfo
        });

    } catch (error) {
        console.error('Erro ao obter info do arquivo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota temporária para criar admin se não existir
app.get('/debug/create-admin', async (req, res) => {
    try {
        // Verificar se já existe um admin
        const adminExists = await db.query('SELECT id FROM users WHERE is_admin = true LIMIT 1');
        
        if (adminExists.rows.length > 0) {
            return res.json({ message: 'Admin já existe', admin: adminExists.rows[0] });
        }
        
        // Criar admin
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const newAdmin = await db.query(`
            INSERT INTO users (username, email, password, is_admin, user_type, upload_limit, storage_quota, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id, username, email, is_admin, user_type
        `, ['admin', 'admin@cloudshare.com', hashedPassword, true, 'admin', 5120, 1000, true]);
        
        res.json({ message: 'Admin criado com sucesso', admin: newAdmin.rows[0] });
    } catch (error) {
        console.error('Erro ao criar admin:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para resetar rate limiting (desenvolvimento)
app.get('/debug/reset-limits', (req, res) => {
    try {
        res.json({
            message: 'Rate limits resetados (reinicie o servidor para efeito completo)',
            ip: req.ip,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            message: 'Erro ao resetar limits',
            error: error.message
        });
    }
});

// Rota temporária para debug de schema (sem autenticação)
app.get('/debug/schema-check', async (req, res) => {
    try {
        const filesSchema = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'files'
            ORDER BY ordinal_position;
        `);
        
        const usersSchema = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        res.json({
            files: filesSchema.rows,
            users: usersSchema.rows
        });
    } catch (error) {
        console.error('Erro ao verificar schema:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota temporária para debug de schema
app.get('/debug/schema', auth.authenticateToken, auth.requireAdmin, async (req, res) => {
    try {
        const filesSchema = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'files'
            ORDER BY ordinal_position;
        `);
        
        const usersSchema = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        res.json({
            files: filesSchema.rows,
            users: usersSchema.rows
        });
    } catch (error) {
        console.error('Erro ao verificar schema:', error);
        res.status(500).json({ error: error.message });
    }
});

// =================================
// ROTAS PARA NOVA INTERFACE PROFISSIONAL
// =================================

// Servir nova interface profissional
app.get('/pro', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-new.html'));
});

// Rota para download direto de arquivo
app.get('/api/files/:id/download', auth.optionalAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        let result;
        
        // Verificar se é um ID numérico ou filename
        if (/^\d+$/.test(fileId)) {
            // É um ID numérico
            result = await db.query(
                'SELECT * FROM files WHERE id = $1',
                [parseInt(fileId)]
            );
        } else {
            // É um filename
            const decodedFilename = decodeURIComponent(fileId);
            result = await db.query(
                'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
                [decodedFilename]
            );
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }
        
        const file = result.rows[0];
        console.log('Arquivo encontrado:', {
            id: file.id,
            original_name: file.original_name,
            filename: file.filename,
            path: file.path,
            folder_path: file.folder_path,
            size: file.size,
            mimetype: file.mimetype
        });
        
        // Verificar permissões
        if (!file.is_public && (!req.user || (req.user.id !== file.user_id && !req.user.is_admin))) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }
        
        // Determinar o caminho correto do arquivo
        let fileRelativePath;
        if (file.path) {
            fileRelativePath = file.path;
        } else if (file.filename) {
            fileRelativePath = file.filename;
        } else if (file.folder_path) {
            fileRelativePath = file.folder_path;
        } else {
            console.error('Nenhum campo de caminho encontrado para o arquivo:', file);
            return res.status(500).json({
                success: false,
                message: 'Caminho do arquivo não encontrado'
            });
        }
        
        const filePath = path.join(__dirname, 'uploads', fileRelativePath);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo físico não encontrado'
            });
        }
        
        // Definir cabeçalhos para download
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
        res.setHeader('Content-Type', file.mimetype);
        res.setHeader('Content-Length', file.size);
        
        // Stream do arquivo
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Erro no download:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota aprimorada para busca de arquivos com filtros
app.get('/api/files/search', auth.optionalAuth, async (req, res) => {
    try {
        const {
            q: searchTerm,
            type,
            date_filter,
            sort = 'created_at',
            order = 'DESC',
            limit = 50,
            offset = 0,
            public_only
        } = req.query;
        
        let query = `
            SELECT f.*, u.username as uploaded_by
            FROM files f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;
        
        // Filtro de visibilidade
        if (public_only === 'true') {
            query += ` AND f.is_public = true`;
        } else if (req.user) {
            query += ` AND (f.is_public = true OR f.user_id = $${++paramCount})`;
            params.push(req.user.id);
        } else {
            query += ` AND f.is_public = true`;
        }
        
        // Filtro de busca
        if (searchTerm) {
            query += ` AND LOWER(f.original_name) LIKE LOWER($${++paramCount})`;
            params.push(`%${searchTerm}%`);
        }
        
        // Filtro de tipo
        if (type && type !== 'all') {
            const typeFilters = {
                image: ['image/%'],
                video: ['video/%'],
                audio: ['audio/%'],
                document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats%', 'text/%'],
                archive: ['application/zip', 'application/x-rar%', 'application/x-7z%', 'application/gzip']
            };
            
            if (typeFilters[type]) {
                const conditions = typeFilters[type].map(() => `f.mimetype LIKE $${++paramCount}`).join(' OR ');
                query += ` AND (${conditions})`;
                params.push(...typeFilters[type]);
            }
        }
        
        // Filtro de data
        if (date_filter && date_filter !== 'all') {
            const now = new Date();
            let dateCondition;
            
            switch (date_filter) {
                case 'today':
                    dateCondition = `f.created_at >= CURRENT_DATE`;
                    break;
                case 'week':
                    dateCondition = `f.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
                    break;
                case 'month':
                    dateCondition = `f.created_at >= CURRENT_DATE - INTERVAL '30 days'`;
                    break;
                case 'year':
                    dateCondition = `f.created_at >= CURRENT_DATE - INTERVAL '1 year'`;
                    break;
            }
            
            if (dateCondition) {
                query += ` AND ${dateCondition}`;
            }
        }
        
        // Ordenação
        const validSorts = ['original_name', 'created_at', 'size'];
        const validOrders = ['ASC', 'DESC'];
        
        if (validSorts.includes(sort) && validOrders.includes(order.toUpperCase())) {
            query += ` ORDER BY f.${sort} ${order.toUpperCase()}`;
        } else {
            query += ` ORDER BY f.created_at DESC`;
        }
        
        // Limite e offset
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            files: result.rows,
            total: result.rows.length,
            hasMore: result.rows.length === parseInt(limit)
        });
        
    } catch (error) {
        console.error('Erro na busca:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota para estatísticas rápidas
app.get('/api/stats/quick', auth.optionalAuth, async (req, res) => {
    try {
        let statsQuery = `
            SELECT 
                COUNT(*) as total_files,
                COUNT(CASE WHEN is_public = true THEN 1 END) as public_files,
                COUNT(CASE WHEN mimetype LIKE 'image/%' THEN 1 END) as images,
                COUNT(CASE WHEN mimetype LIKE 'video/%' THEN 1 END) as videos,
                COUNT(CASE WHEN mimetype LIKE 'audio/%' THEN 1 END) as audios,
                COUNT(CASE WHEN mimetype LIKE 'application/%' OR mimetype LIKE 'text/%' THEN 1 END) as documents,
                SUM(size) as total_size
            FROM files 
            WHERE 1=1
        `;
        
        const params = [];
        
        if (req.user) {
            statsQuery += ` AND (is_public = true OR user_id = $1)`;
            params.push(req.user.id);
        } else {
            statsQuery += ` AND is_public = true`;
        }
        
        const result = await db.query(statsQuery, params);
        const stats = result.rows[0];
        
        // Converter para números
        Object.keys(stats).forEach(key => {
            if (key !== 'total_size') {
                stats[key] = parseInt(stats[key]) || 0;
            } else {
                stats[key] = parseInt(stats[key]) || 0;
            }
        });
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Erro nas estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// =================================
// ROTAS DE COMPARTILHAMENTO DIRETO
// =================================

// Rota para acessar arquivo diretamente pelo nome
app.get('/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Buscar arquivo no banco de dados
        const result = await db.query(
            'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
            [filename]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }
        
        const file = result.rows[0];
        
        // Verificar se o arquivo é público ou se o usuário tem acesso
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }
        
        // Verificar se arquivo existe fisicamente
        let filePath;
        if (file.user_id) {
            // Buscar o usuário para determinar o caminho
            const userResult = await db.query('SELECT username FROM users WHERE id = $1', [file.user_id]);
            if (userResult.rows.length > 0 && userResult.rows[0].username === 'public') {
                filePath = path.join(PUBLIC_DIR, file.filename);
            } else {
                filePath = path.join(getUserDirectory(file.user_id), file.filename);
            }
        } else {
            filePath = path.join(PUBLIC_DIR, file.filename);
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo físico não encontrado'
            });
        }
        
        // Incrementar contador de downloads
        await db.query(
            'UPDATE files SET download_count = download_count + 1 WHERE id = $1',
            [file.id]
        );
        
        // Log da atividade
        if (req.user) {
            await auth.logActivity(req.user.id, 'download', file.id, file.original_name, null, req);
        }
        
        // Configurar headers para download
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Type', file.mimetype);
        res.setHeader('Content-Length', file.size);
        
        // Enviar arquivo
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('Erro no acesso direto ao arquivo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// =================================================================
// NOVA ROTA: Suporte para download/preview por nome de arquivo
// =================================================================

// Rota genérica para servir arquivos por nome (compatibilidade)
app.get('/:filename', auth.optionalAuth, async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        console.log(`🔍 Buscando arquivo por nome: "${filename}"`);
        
        // Buscar arquivo no banco por nome original ou filename
        const result = await db.query(
            'SELECT * FROM files WHERE filename = $1 OR original_name = $1',
            [filename]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Arquivo "${filename}" não encontrado no banco`);
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        const file = result.rows[0];
        console.log('Arquivo encontrado:', {
            id: file.id,
            original_name: file.original_name,
            filename: file.filename,
            path: file.path,
            folder_path: file.folder_path,
            size: file.size,
            mimetype: file.mimetype
        });

        // Verificar permissões
        if (!file.is_public && (!req.user || file.user_id !== req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        // Construir caminho completo do arquivo
        let filePath;
        if (file.path && fs.existsSync(file.path)) {
            filePath = file.path;
        } else {
            // Fallback: tentar construir o caminho
            const userFolder = file.user_id ? `user_${file.user_id}` : 'public';
            filePath = path.join(UPLOAD_DIR, 'users', userFolder, file.filename);
            
            if (!fs.existsSync(filePath)) {
                // Tentar outras localizações
                const alternatives = [
                    path.join(UPLOAD_DIR, 'users', userFolder, file.original_name),
                    path.join(UPLOAD_DIR, 'public', file.filename),
                    path.join(UPLOAD_DIR, 'public', file.original_name),
                    path.join(UPLOAD_DIR, file.filename),
                    path.join(UPLOAD_DIR, file.original_name)
                ];
                
                for (const altPath of alternatives) {
                    if (fs.existsSync(altPath)) {
                        filePath = altPath;
                        break;
                    }
                }
            }
        }

        // Verificar se o arquivo físico existe
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Arquivo físico não encontrado: ${filePath}`);
            return res.status(404).json({
                success: false,
                message: 'Arquivo físico não encontrado'
            });
        }

        // Obter estatísticas do arquivo
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const mimetype = file.mimetype || mimeTypes.lookup(filePath) || 'application/octet-stream';

        // Definir headers para download
        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        
        // Para alguns tipos de arquivo, forçar download
        if (mimetype.includes('application/') && !mimetype.includes('pdf')) {
            res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        }

        // Cache headers
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Last-Modified', stats.mtime.toUTCString());

        console.log(`✅ Servindo arquivo: ${file.original_name} (${fileSize} bytes)`);

        // Stream do arquivo
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('Erro ao fazer stream do arquivo:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erro ao transmitir arquivo'
                });
            }
        });

    } catch (error) {
        console.error('❌ Erro na rota de arquivo por nome:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// =================================
// ROTAS FINAIS
// =================================

// Rota para servir o painel administrativo
app.get('/admin', auth.authenticateToken, auth.requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Função auxiliar para formatar tamanho de arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Iniciar servidor
app.listen(PORT, async () => {
    console.log('🚀 CloudShare Server v2.0 rodando em http://localhost:' + PORT);
    console.log('📁 Diretório de uploads:', UPLOAD_DIR);
    console.log('🔒 Sistema de autenticação ativo');
    console.log('🌐 Acesso externo: http://192.168.0.200:' + PORT);
    console.log('');
    console.log('📋 Funcionalidades:');
    console.log('   ✅ Upload com autenticação');
    console.log('   ✅ Separação por usuário');
    console.log('   ✅ Pasta pública para não logados');
    console.log('   ✅ Sistema de quotas');
    console.log('   ✅ Logs de atividade');
    console.log('   ✅ Interface administrativa');
    
    // Inicializar sincronização da pasta public
    const publicSync = new PublicSync();
    await publicSync.init();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Encerrando servidor...');
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Encerrando servidor...');
    await db.end();
    process.exit(0);
});
