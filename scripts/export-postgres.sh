#!/bin/bash
# Script Bash pour exporter PostgreSQL vers Supabase
# Usage: ./export-postgres.sh

HOST="${1:-localhost}"
PORT="${2:-5432}"
DATABASE="${3:-rune2chain}"
USER="${4:-postgres}"

echo "🔄 Export PostgreSQL vers Supabase"
echo "================================="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo ""
echo "📁 Dossier de backup: $BACKUP_DIR"

read -sp "Mot de passe PostgreSQL: " PASSWORD
echo ""
export PGPASSWORD="$PASSWORD"

echo ""
echo "1️⃣ Export du schéma complet..."
SCHEMA_FILE="$BACKUP_DIR/schema.sql"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" --schema-only -f "$SCHEMA_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Schéma exporté: $SCHEMA_FILE"
else
    echo "   ❌ Erreur lors de l'export du schéma"
    exit 1
fi

echo ""
echo "2️⃣ Export des données..."
DATA_FILE="$BACKUP_DIR/data.sql"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" --data-only -f "$DATA_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Données exportées: $DATA_FILE"
else
    echo "   ❌ Erreur lors de l'export des données"
    exit 1
fi

echo ""
echo "3️⃣ Export complet (backup de sécurité)..."
FULL_BACKUP_FILE="$BACKUP_DIR/full_backup.sql"
pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -f "$FULL_BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "   ✅ Backup complet: $FULL_BACKUP_FILE"
else
    echo "   ❌ Erreur lors du backup complet"
    exit 1
fi

echo ""
echo "4️⃣ Statistiques de la base..."
STATS_FILE="$BACKUP_DIR/stats.txt"

QUERY="SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -c "$QUERY" > "$STATS_FILE"
echo "   ✅ Statistiques: $STATS_FILE"

unset PGPASSWORD

echo ""
echo "✅ Export terminé avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Créer un projet sur https://supabase.com"
echo "   2. Copier l'URL et la clé API dans .env"
echo "   3. Importer le schéma via SQL Editor de Supabase"
echo "   4. Importer les données"
echo "   5. Lancer l'app de test: pnpm dev"
