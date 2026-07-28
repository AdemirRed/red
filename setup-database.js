const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Configuração do banco PostgreSQL
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'cloudshare_db',
  password: 'admin123',
  port: 9000,
};

async function setupDatabase() {
  const client = new Client({
    user: dbConfig.user,
    host: dbConfig.host,
    password: dbConfig.password,
    port: dbConfig.port,
  });

  try {
    await client.connect();
    console.log('🔌 Conectado ao PostgreSQL');

    // Criar database se não existir
    try {
      await client.query(`CREATE DATABASE ${dbConfig.database}`);
      console.log(`📊 Database '${dbConfig.database}' criado com sucesso`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`📊 Database '${dbConfig.database}' já existe`);
      } else {
        throw error;
      }
    }

    await client.end();

    // Conectar ao database específico
    const dbClient = new Client(dbConfig);
    await dbClient.connect();

    // Criar tabela de usuários com segurança aprimorada
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        is_admin BOOLEAN DEFAULT FALSE,
        is_premium BOOLEAN DEFAULT FALSE,
        storage_quota BIGINT DEFAULT 6442450944, -- 6GB em bytes (padrão)
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
    console.log('👥 Tabela de usuários criada');

    // Criar tabela de arquivos com segurança aprimorada
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100),
        size BIGINT NOT NULL,
        path VARCHAR(500) NOT NULL,
        file_hash VARCHAR(64), -- SHA-256 hash do arquivo
        is_public BOOLEAN DEFAULT FALSE,
        download_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        tags VARCHAR(500),
        virus_scanned BOOLEAN DEFAULT FALSE,
        virus_scan_result VARCHAR(50),
        folder_path VARCHAR(255) -- Caminho da pasta para uploads de diretório
      )
    `);
    console.log('📁 Tabela de arquivos criada');

    // Criar tabela de sessões
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      ) WITH (OIDS=FALSE);
      
      ALTER TABLE session DROP CONSTRAINT IF EXISTS session_pkey;
      ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
      
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
    `);
    console.log('🔐 Tabela de sessões criada');

    // Criar tabela de logs de atividade
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        details JSON,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('📊 Tabela de logs criada');

    // Criar usuário administrador padrão
    const adminPassword = await bcrypt.hash('admin123', 10);
    try {
      await dbClient.query(`
        INSERT INTO users (username, email, password_hash, full_name, is_admin, storage_quota)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['admin', 'admin@cloudshare.com', adminPassword, 'Administrador', true, 10737418240]); // 10GB para admin
      console.log('👤 Usuário administrador criado: admin / admin123');
    } catch (error) {
      if (error.code === '23505') {
        console.log('👤 Usuário administrador já existe');
      } else {
        throw error;
      }
    }

    // Criar usuário público/demo
    const demoPassword = await bcrypt.hash('demo123', 10);
    try {
      await dbClient.query(`
        INSERT INTO users (username, email, password_hash, full_name, storage_quota)
        VALUES ($1, $2, $3, $4, $5)
      `, ['demo', 'demo@cloudshare.com', demoPassword, 'Usuário Demo', 2147483648]); // 2GB para demo
      console.log('👤 Usuário demo criado: demo / demo123');
    } catch (error) {
      if (error.code === '23505') {
        console.log('👤 Usuário demo já existe');
      } else {
        throw error;
      }
    }

    // Criar função para atualizar timestamp
    await dbClient.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Criar triggers para updated_at
    await dbClient.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await dbClient.query(`
      DROP TRIGGER IF EXISTS update_files_updated_at ON files;
      CREATE TRIGGER update_files_updated_at
        BEFORE UPDATE ON files
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('⚙️ Triggers criados');

    await dbClient.end();
    console.log('✅ Setup do banco de dados concluído com sucesso!');
    console.log('');
    console.log('📋 Credenciais criadas:');
    console.log('👨‍💼 Admin: admin / admin123');
    console.log('👤 Demo: demo / demo123');
    console.log('');
    console.log('🔗 Configuração do banco:');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);

  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error.message);
    process.exit(1);
  }
}

// Verificar se PostgreSQL está rodando
async function checkPostgreSQL() {
  const client = new Client({
    user: dbConfig.user,
    host: dbConfig.host,
    password: dbConfig.password,
    port: dbConfig.port,
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando setup do CloudShare Database...');
  console.log('');

  const isRunning = await checkPostgreSQL();
  if (!isRunning) {
    console.log('❌ PostgreSQL não está rodando ou as credenciais estão incorretas');
    console.log('');
    console.log('📋 Verifique se:');
    console.log('   1. PostgreSQL está instalado e rodando');
    console.log('   2. Usuário "postgres" existe');
    console.log('   3. Senha está correta (padrão: admin123)');
    console.log('   4. Porta 5432 está disponível');
    console.log('');
    console.log('💡 Para instalar PostgreSQL:');
    console.log('   Windows: https://www.postgresql.org/download/windows/');
    console.log('   Docker: docker run --name postgres -e POSTGRES_PASSWORD=admin123 -p 5432:5432 -d postgres');
    process.exit(1);
  }

  await setupDatabase();
}

if (require.main === module) {
  main();
}

module.exports = { dbConfig };
