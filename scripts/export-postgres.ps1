# Script PowerShell pour exporter PostgreSQL vers Supabase
# Usage: .\export-postgres.ps1

param(
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$Database = "defaultdb",
    [string]$User = "postgres",
    [string]$Password = $env:PG_PASSWORD
)

Write-Host "🔄 Export PostgreSQL vers Supabase" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups\$timestamp"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Write-Host "`n📁 Dossier de backup: $backupDir" -ForegroundColor Green

$env:PGPASSWORD = $Password

Write-Host "`n1️⃣ Export du schéma complet..." -ForegroundColor Yellow
$schemaFile = "$backupDir\schema.sql"
pg_dump -h $Host -p $Port -U $User -d $Database --schema-only -f $schemaFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Schéma exporté: $schemaFile" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Erreur lors de l'export du schéma" -ForegroundColor Red
    exit 1
}

Write-Host "`n2️⃣ Export des données..." -ForegroundColor Yellow
$dataFile = "$backupDir\data.sql"
pg_dump -h $Host -p $Port -U $User -d $Database --data-only -f $dataFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Données exportées: $dataFile" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Erreur lors de l'export des données" -ForegroundColor Red
    exit 1
}

Write-Host "`n3️⃣ Export complet (backup de sécurité)..." -ForegroundColor Yellow
$fullBackupFile = "$backupDir\full_backup.sql"
pg_dump -h $Host -p $Port -U $User -d $Database -f $fullBackupFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Backup complet: $fullBackupFile" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Erreur lors du backup complet" -ForegroundColor Red
    exit 1
}

Write-Host "`n4️⃣ Statistiques de la base..." -ForegroundColor Yellow
$statsFile = "$backupDir\stats.txt"

$query = @"
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"@

psql -h $Host -p $Port -U $User -d $Database -c "$query" > $statsFile
Write-Host "   ✅ Statistiques: $statsFile" -ForegroundColor Green

$env:PGPASSWORD = ""

Write-Host "`n✅ Export terminé avec succès!" -ForegroundColor Green
Write-Host "`n📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Créer un projet sur https://supabase.com" -ForegroundColor White
Write-Host "   2. Copier l'URL et la clé API dans .env" -ForegroundColor White
Write-Host "   3. Importer le schéma via SQL Editor de Supabase" -ForegroundColor White
Write-Host "   4. Importer les données" -ForegroundColor White
Write-Host "   5. Lancer l'app de test: pnpm dev" -ForegroundColor White
