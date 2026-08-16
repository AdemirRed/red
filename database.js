const { Pool } = require('pg');

// Configuração do banco de dados
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cloudshare_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: parseInt(process.env.DB_PORT || '9000'),
  max: 20, // máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Pool de conexões
const pool = new Pool(dbConfig);

// Event listeners
pool.on('connect', () => {
  console.log('🔌 Nova conexão estabelecida com PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool de conexões PostgreSQL:', err);
  process.exit(-1);
});

// Função para executar queries
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executada', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Erro na query:', error);
    throw error;
  }
}

// Função para obter um cliente do pool
async function getClient() {
  return pool.connect();
}

// Função para fechar o pool
async function end() {
  return pool.end();
}

module.exports = {
  query,
  getClient,
  end,
  pool,
  dbConfig
};
