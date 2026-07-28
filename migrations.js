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

class MigrationManager {
  constructor() {
    this.client = new Client(dbConfig);
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async connect() {
    await this.client.connect();
    await this.ensureMigrationsTable();
  }

  async disconnect() {
    await this.client.end();
  }

  // Criar tabela de controle de migrations
  async ensureMigrationsTable() {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Listar migrations executadas
  async getExecutedMigrations() {
    const result = await this.client.query('SELECT name FROM migrations ORDER BY id');
    return result.rows.map(row => row.name);
  }

  // Listar arquivos de migration
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
      return [];
    }
    
    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  // Executar migrations pendentes
  async runMigrations() {
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    console.log(`📋 ${pendingMigrations.length} migration(s) pendente(s)`);

    for (const migrationFile of pendingMigrations) {
      console.log(`🔄 Executando migration: ${migrationFile}`);
      
      const migrationPath = path.join(this.migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        // Executar migration em transação
        await this.client.query('BEGIN');
        await this.client.query(migrationSQL);
        await this.client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationFile]
        );
        await this.client.query('COMMIT');
        
        console.log(`✅ Migration executada: ${migrationFile}`);
      } catch (error) {
        await this.client.query('ROLLBACK');
        console.error(`❌ Erro na migration ${migrationFile}:`, error.message);
        throw error;
      }
    }

    console.log('🎉 Todas as migrations foram executadas com sucesso!');
  }

  // Criar nova migration
  static createMigration(name) {
    const timestamp = new Date().toISOString()
      .replace(/[-:T.]/g, '')
      .substring(0, 14);
    
    const filename = `${timestamp}_${name}.sql`;
    const filepath = path.join(__dirname, 'migrations', filename);
    
    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Execute migration
BEGIN;

-- Adicione suas queries SQL aqui
-- Exemplo:
-- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

COMMIT;
`;

    fs.writeFileSync(filepath, template);
    console.log(`📝 Migration criada: ${filename}`);
    return filename;
  }
}

// CLI para gerenciar migrations
if (require.main === module) {
  const command = process.argv[2];
  const migrationName = process.argv[3];

  (async () => {
    if (command === 'create' && migrationName) {
      MigrationManager.createMigration(migrationName);
    } else if (command === 'run') {
      const manager = new MigrationManager();
      try {
        await manager.connect();
        await manager.runMigrations();
      } catch (error) {
        console.error('❌ Erro ao executar migrations:', error);
        process.exit(1);
      } finally {
        await manager.disconnect();
      }
    } else {
      console.log(`
🗃️  CloudShare Migration Manager

Comandos:
  node migrations.js create <nome>  - Criar nova migration
  node migrations.js run            - Executar migrations pendentes

Exemplos:
  node migrations.js create add_user_preferences
  node migrations.js run
      `);
    }
  })();
}

module.exports = MigrationManager;
