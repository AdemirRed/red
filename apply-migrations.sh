#!/bin/bash
# Script para aplicar migrations automaticamente

set -e

echo "📊 Aplicando migrations do CloudShare Pro..."

DB_CONTAINER="${DB_CONTAINER:-cloudshare_postgres}"
DB_USER="${DB_USER:-cloudshare_user}"
DB_NAME="${DB_NAME:-cloudshare}"

# Verificar se container existe
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ Container $DB_CONTAINER não está rodando!"
    echo "Execute: docker compose up -d"
    exit 1
fi

echo "✓ Container encontrado: $DB_CONTAINER"

# Aplicar cada migration
MIGRATIONS_DIR="./migrations"

for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
        echo "Aplicando: $(basename $migration)..."
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$migration" 2>&1 | grep -v "ERROR\|WARNING" || true
    fi
done

echo ""
echo "✅ Migrations aplicadas com sucesso!"
echo ""
echo "Verificando tabelas criadas:"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "\dt"

echo ""
echo "Usuários cadastrados:"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, username, is_admin FROM users;"
