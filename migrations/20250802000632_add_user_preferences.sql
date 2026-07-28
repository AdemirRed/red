-- Migration: add_user_preferences
-- Created: 2025-08-02T00:06:32.898Z

-- Execute migration

-- Adicionar coluna de preferências do usuário
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Adicionar índice para busca nas preferências
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN(preferences);

-- Adicionar comentário na tabela
COMMENT ON COLUMN users.preferences IS 'Preferências do usuário em formato JSON';
