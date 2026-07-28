-- Migration: default_users
-- Created: 2025-08-01T23:59:34.000Z

-- Execute migration

-- Inserir usuário administrador padrão
INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota, is_active)
VALUES (
  'admin',
  'admin@cloudshare.local',
  '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG',
  'Administrador do Sistema',
  true,
  -1,
  true
) ON CONFLICT (username) DO NOTHING;

-- Inserir usuário demo
INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota, is_active)
VALUES (
  'demo',
  'demo@cloudshare.local', 
  '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG',
  'Usuário Demonstração',
  false,
  6442450944,
  true
) ON CONFLICT (username) DO NOTHING;

-- Inserir usuário premium demo
INSERT INTO users (username, email, password_hash, full_name, is_admin, is_premium, storage_quota, is_active)
VALUES (
  'premium',
  'premium@cloudshare.local',
  '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG',
  'Usuário Premium Demo',
  false,
  true,
  53687091200,
  true
) ON CONFLICT (username) DO NOTHING;n: default_users
-- Created: 2025-08-01T23:59:34.120Z

-- Execute migration
BEGIN;

-- Adicione suas queries SQL aqui
-- Exemplo:
-- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

COMMIT;
