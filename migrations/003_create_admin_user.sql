-- Migration: Criar usuário administrador padrão
-- Data: 2025-08-01

-- Inserir usuário administrador (senha: admin123)
-- Hash bcrypt para 'admin123' com 12 rounds: $2b$12$LQv3c1yqBwEHXLAuRMKX.OUo.cg0jQMQXbKCpV5D5pM5kXxN8j8zW
INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota, storage_used, created_at) 
VALUES (
  'admin',
  'admin@cloudshare.local',
  '$2b$12$LQv3c1yqBwEHXLAuRMKX.OUo.cg0jQMQXbKCpV5D5pM5kXxN8j8zW',
  'Administrador do Sistema',
  true,
  9223372036854775807, -- Sem limite (valor máximo BIGINT)
  0,
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- Garantir que existe um admin mesmo se o username já existir
UPDATE users 
SET is_admin = true, 
    email = 'admin@cloudshare.local',
    full_name = 'Administrador do Sistema',
    storage_quota = 9223372036854775807
WHERE username = 'admin';
