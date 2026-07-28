const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

// Segurança aprimorada - chave secreta mais robusta
const JWT_SECRET = 'cloudshare_jwt_secret_2025';
const JWT_EXPIRES_IN = '3d';
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

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

// Função para fazer login com segurança aprimorada
async function login(username, password) {
  try {
    // Buscar usuário no banco (case-insensitive)
    const userResult = await db.query(
      'SELECT id, username, email, password_hash, full_name, is_admin, is_premium, is_active, failed_login_attempts, locked_until FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [username]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuário ou senha inválidos');
    }

    const user = userResult.rows[0];

    // Verificar se conta está ativa
    if (!user.is_active) {
      throw new Error('Conta desativada');
    }

    // Verificar se conta está bloqueada
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
      throw new Error(`Conta bloqueada. Tente novamente em ${minutesLeft} minutos`);
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      // Incrementar tentativas de login falhadas
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCKOUT_TIME);
      }

      await db.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [newFailedAttempts, lockUntil, user.id]
      );

      if (lockUntil) {
        throw new Error('Muitas tentativas de login. Conta bloqueada por 15 minutos');
      } else {
        throw new Error('Usuário ou senha inválidos');
      }
    }

    // Login bem-sucedido - limpar tentativas falhadas
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Retornar dados do usuário (sem senha)
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      is_admin: user.is_admin,
      is_premium: user.is_premium
    };

    return {
      success: true,
      message: 'Login realizado com sucesso',
      user: userData
    };

  } catch (error) {
    throw error;
  }
}

// Função para registrar novo usuário
async function register({ username, email, password, fullName }) {
  try {
    // Verificar se username já existe (case-insensitive)
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      throw new Error('Nome de usuário já existe');
    }

    // Verificar se email já existe (case-insensitive)
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      throw new Error('Email já cadastrado');
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Inserir usuário no banco
    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, is_admin, is_premium, is_active, created_at)
       VALUES ($1, $2, $3, $4, false, false, true, NOW())
       RETURNING id, username, email, full_name, is_admin, is_premium`,
      [username, email, passwordHash, fullName]
    );

    const user = userResult.rows[0];

    return {
      success: true,
      message: 'Usuário registrado com sucesso',
      user: user
    };

  } catch (error) {
    throw error;
  }
}

// Função para registrar logs de atividade
async function logActivity(userId, action, resourceType = null, resourceId = null, metadata = null, req = null) {
  try {
    const ipAddress = req ? (req.ip || req.connection.remoteAddress || req.socket.remoteAddress) : null;
    const userAgent = req ? req.get('User-Agent') : null;

    await db.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [userId, action, resourceType, resourceId, JSON.stringify(metadata), ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Erro ao registrar log de atividade:', error);
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  login,
  register,
  logActivity,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
