-- Migration: add_device_identification
-- Created: 2025-08-02

-- Adicionar campos para identificação de dispositivo/navegador
ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_ip VARCHAR(45);
ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_user_agent TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_fingerprint VARCHAR(64);
ALTER TABLE files ADD COLUMN IF NOT EXISTS delete_token VARCHAR(64);

-- Criar índice para otimizar buscas por token de exclusão
CREATE INDEX IF NOT EXISTS idx_files_delete_token ON files(delete_token);
CREATE INDEX IF NOT EXISTS idx_files_fingerprint ON files(uploader_fingerprint);
