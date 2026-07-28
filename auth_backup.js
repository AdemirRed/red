const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

// Segurança aprimorada - chave secreta mais robusta
const JWT_SECRET = 'cloudshare_jwt_secret_2025'; // Usar a mesma chave do server.js
const JWT_EXPIRES_IN = '3d'; // 3 dias para consistência
const BCRYPT_ROUNDS = 12; // Aumentado para maior segurança
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

// Middleware para verificar autenticação
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token de acesso requerido' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar se o usuário ainda existe e está ativo
    const userResult = await db.query(
      'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used, failed_login_attempts, locked_until FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não encontrado ou inativo' 
      });
    }

    const user = userResult.rows[0];

    // Verificar se conta está bloqueada
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(423).json({
        success: false,
        message: 'Conta temporariamente bloqueada por excesso de tentativas'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token inválido ou expirado' 
    });
  }
}

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Acesso restrito a administradores' 
    });
  }
  next();
}

// Middleware para autenticação opcional (permite acesso público)
async function optionalAuth(req, res, next) {
  // Primeiro, tentar JWT do header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userResult = await db.query(
        'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
        return next();
      }
    } catch (error) {
      // Token inválido, continuar para verificar sessão
    }
  }

  // Se não há JWT válido, tentar sessão
  if (req.session && req.session.userId) {
    try {
      const userResult = await db.query(
        'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used FROM users WHERE id = $1 AND is_active = true',
        [req.session.userId]
      );
      
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
        return next();
      }
    } catch (error) {
      // Sessão inválida, continuar sem usuário
    }
  }

  // Nenhuma autenticação válida encontrada, mas permite acesso como visitante
  next();
}

// Middleware para autenticação obrigatória
async function authenticateToken(req, res, next) {
  // Primeiro, tentar JWT do header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userResult = await db.query(
        'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
        return next();
      }
    } catch (error) {
      // Token inválido, tentar sessão
    }
  }

  // Se não há JWT válido, tentar sessão
  if (req.session && req.session.userId) {
    try {
      const userResult = await db.query(
        'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used FROM users WHERE id = $1 AND is_active = true',
        [req.session.userId]
      );
      
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
        return next();
      }
    } catch (error) {
      // Sessão inválida
    }
  }

  // Nenhuma autenticação válida
  return res.status(401).json({ 
    success: false, 
    message: 'Token de acesso requerido' 
  });
}
        'SELECT id, username, email, full_name, is_admin, is_active, storage_quota, storage_used FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
      }
    } catch (error) {
      // Token inválido, mas continua sem autenticação
      console.log('Token inválido na autenticação opcional:', error.message);
    }
  }

  next();
}

// Função para fazer login com segurança aprimorada
async function login(username, password) {
  try {
    // Buscar usuário com informações de segurança
    const result = await db.query(
      `SELECT id, username, email, password_hash, full_name, is_admin, is_active, 
              failed_login_attempts, locked_until, last_login
       FROM users 
       WHERE (username = $1 OR email = $1) AND is_active = true`,
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    const user = result.rows[0];

    // Verificar se conta está bloqueada
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const unlockTime = new Date(user.locked_until).toLocaleString('pt-BR');
      throw new Error(`Conta bloqueada até ${unlockTime} por excesso de tentativas`);
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Incrementar tentativas falhadas
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      // Bloquear conta após máximo de tentativas
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCKOUT_TIME);
      }

      await db.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [failedAttempts, lockUntil, user.id]
      );

      if (lockUntil) {
        throw new Error(`Conta bloqueada por 15 minutos devido a ${MAX_LOGIN_ATTEMPTS} tentativas falhadas`);
      }

      throw new Error(`Senha incorreta. Tentativa ${failedAttempts}/${MAX_LOGIN_ATTEMPTS}`);
    }

    // Login bem-sucedido - resetar tentativas e atualizar último login
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Gerar token JWT com informações de segurança
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      loginTime: Date.now()
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isAdmin: user.is_admin
      }
    };

  } catch (error) {
    throw new Error(error.message);
  }
}

// Função para registrar usuário com validações de segurança
async function register(userData) {
  const { username, email, password, fullName } = userData;

  try {
    // Validações de segurança
    if (!isValidUsername(username)) {
      throw new Error('Username deve ter 3-20 caracteres, apenas letras, números e underscore');
    }

    if (!isValidEmail(email)) {
      throw new Error('Email inválido');
    }

    if (!isStrongPassword(password)) {
      throw new Error('Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e símbolo');
    }

    // Verificar se usuário já existe
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Usuário ou email já existe');
    }

    // Hash da senha com salt mais forte
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Inserir novo usuário
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, created_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
       RETURNING id, username, email, full_name`,
      [username, email, passwordHash, fullName || '']
    );

    const newUser = result.rows[0];

    // Gerar token JWT
    const tokenPayload = {
      userId: newUser.id,
      username: newUser.username,
      isAdmin: false,
      loginTime: Date.now()
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        isAdmin: false
      }
    };

  } catch (error) {
    throw new Error(error.message);
  }
}

// Funções de validação de segurança
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isStrongPassword(password) {
  // Pelo menos 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 símbolo
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}

// Função para gerar hash seguro de arquivos
function generateSecureHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Função para log de atividades
async function logActivity(userId, action, resourceType = null, resourceId = null, details = null, req = null) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress) : null;
    const userAgent = req ? req.headers['user-agent'] : null;

    await db.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resourceType, resourceId, details, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Erro ao registrar log de atividade:', error);
  }
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  login,
  register,
  logActivity,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
