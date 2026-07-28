-- Tabela para códigos de recuperação de senha
CREATE TABLE IF NOT EXISTS password_reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_password_reset_code ON password_reset_codes(code);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_used ON password_reset_codes(used);

-- Limpar códigos expirados automaticamente (opcional - pode ser feito por um job)
CREATE OR REPLACE FUNCTION clean_expired_reset_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_codes
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE password_reset_codes IS 'Armazena códigos de recuperação de senha com expiração';
COMMENT ON COLUMN password_reset_codes.code IS 'Código de 6 dígitos enviado por email';
COMMENT ON COLUMN password_reset_codes.expires_at IS 'Data/hora de expiração do código (10 minutos)';
COMMENT ON COLUMN password_reset_codes.used IS 'Indica se o código já foi utilizado';
