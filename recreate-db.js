const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco PostgreSQL
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'cloudshare_db',
  password: 'admin123',
  port: 9000,
};

class SimpleMigrationManager {
  constructor() {
    this.client = new Client(dbConfig);
  }

  async connect() {
    await this.client.connect();
    console.log('🔌 Conectado ao PostgreSQL para migrations');
  }

  async disconnect() {
    await this.client.end();
  }

  // Recriar banco com estrutura atual
  async recreateDatabase() {
    try {
      console.log('🔄 Recriando estrutura do banco...');

      // Dropar tabelas existentes se existirem
      await this.client.query('DROP TABLE IF EXISTS activity_logs CASCADE');
      await this.client.query('DROP TABLE IF EXISTS files CASCADE');
      await this.client.query('DROP TABLE IF EXISTS session CASCADE');
      await this.client.query('DROP TABLE IF EXISTS users CASCADE');
      await this.client.query('DROP TABLE IF EXISTS migrations CASCADE');

      // Criar tabela de controle de migrations
      await this.client.query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Criar tabela de usuários
      await this.client.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100),
          is_admin BOOLEAN DEFAULT FALSE,
          is_premium BOOLEAN DEFAULT FALSE,
          storage_quota BIGINT DEFAULT 6442450944,
          storage_used BIGINT DEFAULT 0,
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          two_factor_secret VARCHAR(32)
        )
      `);

      // Criar tabela de arquivos
      await this.client.query(`
        CREATE TABLE files (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          original_name VARCHAR(255) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          mimetype VARCHAR(100),
          size BIGINT NOT NULL,
          path VARCHAR(500) NOT NULL,
          file_hash VARCHAR(64),
          is_public BOOLEAN DEFAULT FALSE,
          download_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          tags VARCHAR(500),
          virus_scanned BOOLEAN DEFAULT FALSE,
          virus_scan_result VARCHAR(50),
          folder_path VARCHAR(255)
        )
      `);

      // Criar tabela de sessões
      await this.client.query(`
        CREATE TABLE session (
          sid VARCHAR PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);

      // Criar tabela de logs
      await this.client.query(`
        CREATE TABLE activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(50) NOT NULL,
          resource_type VARCHAR(50),
          resource_id INTEGER,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Criar índices
      await this.client.query('CREATE INDEX idx_files_user_id ON files(user_id)');
      await this.client.query('CREATE INDEX idx_files_hash ON files(file_hash)');
      await this.client.query('CREATE INDEX idx_files_created_at ON files(created_at)');
      await this.client.query('CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id)');
      await this.client.query('CREATE INDEX idx_users_email ON users(email)');
      await this.client.query('CREATE INDEX idx_users_username ON users(username)');

      // Criar função e triggers
      await this.client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = CURRENT_TIMESTAMP;
           RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await this.client.query(`
        CREATE TRIGGER update_users_updated_at 
          BEFORE UPDATE ON users 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);

      await this.client.query(`
        CREATE TRIGGER update_files_updated_at 
          BEFORE UPDATE ON files 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);

      console.log('✅ Estrutura do banco criada com sucesso');

      // Inserir usuários padrão
      await this.insertDefaultUsers();

      // Registrar migrations como executadas
      await this.client.query(
        "INSERT INTO migrations (name) VALUES ('initial_schema'), ('default_users')"
      );

      console.log('🎉 Migrations executadas com sucesso!');

    } catch (error) {
      console.error('❌ Erro ao recriar banco:', error);
      throw error;
    }
  }

  async insertDefaultUsers() {
    console.log('👥 Inserindo usuários padrão...');

    // Usuário admin
    await this.client.query(`
      INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'admin',
      'admin@cloudshare.local',
      '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG', // admin123
      'Administrador do Sistema',
      true,
      -1, // Quota ilimitada
      true
    ]);

    // Usuário demo
    await this.client.query(`
      INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'demo',
      'demo@cloudshare.local',
      '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG', // demo123
      'Usuário Demonstração',
      false,
      6442450944, // 6GB
      true
    ]);

    // Usuário premium
    await this.client.query(`
      INSERT INTO users (username, email, password_hash, full_name, is_admin, is_premium, storage_quota, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      'premium',
      'premium@cloudshare.local',
      '$2a$12$k8Y1THRE7pHB6tRXEFBhTul.ZL8L1GZMKbE.7E5KGUiPYFIQmKVzG', // premium123
      'Usuário Premium Demo',
      false,
      true,
      53687091200, // 50GB
      true
    ]);

    console.log('✅ Usuários padrão criados');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  (async () => {
    const manager = new SimpleMigrationManager();
    try {
      await manager.connect();
      await manager.recreateDatabase();
      console.log('\n📋 Credenciais:');
      console.log('👨‍💼 Admin: admin / admin123');
      console.log('👤 Demo: demo / demo123');
      console.log('💎 Premium: premium / premium123');
    } catch (error) {
      console.error('❌ Erro:', error);
      process.exit(1);
    } finally {
      await manager.disconnect();
    }
  })();
}

module.exports = SimpleMigrationManager;
