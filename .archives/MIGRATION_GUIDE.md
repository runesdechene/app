# 📘 Guide de Migration PostgreSQL → Supabase

## ⚠️ IMPORTANT - Checklist de sécurité

Avant de commencer, assurez-vous de :
- [ ] Avoir un backup complet de votre base PostgreSQL actuelle
- [ ] Avoir testé la restauration du backup
- [ ] Avoir noté tous les utilisateurs et leurs permissions
- [ ] Avoir documenté toutes les connexions externes à la base

## 📋 Étape 1 : Préparation de l'environnement

### 1.1 Installer les dépendances

```powershell
# Avec pnpm (recommandé)
pnpm install

# OU avec npm
npm install
```

### 1.2 Vérifier PostgreSQL

Assurez-vous que PostgreSQL est accessible :

```powershell
# Tester la connexion
psql -h localhost -U postgres -d rune2chain -c "SELECT version();"
```

## 📤 Étape 2 : Export de PostgreSQL

### 2.1 Export automatique (Recommandé)

```powershell
# Windows PowerShell
.\scripts\export-postgres.ps1 -Host "localhost" -Port "5432" -Database "rune2chain" -User "postgres" -Password "votre_mot_de_passe"

# Linux/Mac
chmod +x scripts/export-postgres.sh
./scripts/export-postgres.sh localhost 5432 rune2chain postgres
```

### 2.2 Export manuel

Si vous préférez faire l'export manuellement :

```powershell
# Créer le dossier de backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
mkdir "backups\$timestamp"

# Export du schéma
pg_dump -h localhost -U postgres -d rune2chain --schema-only -f "backups\$timestamp\schema.sql"

# Export des données
pg_dump -h localhost -U postgres -d rune2chain --data-only -f "backups\$timestamp\data.sql"

# Backup complet de sécurité
pg_dump -h localhost -U postgres -d rune2chain -f "backups\$timestamp\full_backup.sql"
```

### 2.3 Vérifier les exports

```powershell
# Vérifier que les fichiers existent et ne sont pas vides
Get-ChildItem "backups\*\*.sql" | Select-Object Name, Length
```

## 🚀 Étape 3 : Configuration Supabase

### 3.1 Créer un projet Supabase

1. Aller sur https://supabase.com
2. Cliquer sur "New Project"
3. Choisir un nom : `rune2chain-explorer`
4. Choisir une région proche de vos utilisateurs
5. Définir un mot de passe fort pour la base de données
6. Attendre la création du projet (2-3 minutes)

### 3.2 Récupérer les credentials

Dans votre projet Supabase :
1. Aller dans **Settings** → **API**
2. Copier :
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public key** (commence par `eyJ...`)

### 3.3 Configurer les variables d'environnement

```powershell
# Copier le fichier d'exemple
Copy-Item .env.example .env

# Éditer .env avec vos credentials
notepad .env
```

Remplir dans `.env` :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📥 Étape 4 : Import dans Supabase

### 4.1 Importer le schéma

1. Dans Supabase, aller dans **SQL Editor**
2. Créer une nouvelle query
3. Ouvrir le fichier `backups\[timestamp]\schema.sql`
4. Copier tout le contenu
5. Coller dans SQL Editor
6. Cliquer sur **Run**

⚠️ **Attention aux erreurs** :
- Ignorer les erreurs sur les extensions déjà installées
- Vérifier que toutes les tables sont créées

### 4.2 Importer les données

1. Dans SQL Editor, créer une nouvelle query
2. Ouvrir le fichier `backups\[timestamp]\data.sql`
3. Copier tout le contenu
4. Coller dans SQL Editor
5. Cliquer sur **Run**

⚠️ **Si le fichier est trop gros** :
- Diviser le fichier en plusieurs parties
- Importer table par table

### 4.3 Vérifier l'import

```sql
-- Compter les lignes dans chaque table
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

Comparer avec les statistiques de l'export dans `backups\[timestamp]\stats.txt`

## 🧪 Étape 5 : Tester la connexion

### 5.1 Lancer l'application de test

```powershell
pnpm dev
```

L'application devrait s'ouvrir sur http://localhost:3000

### 5.2 Vérifier la connexion

L'interface devrait afficher :
- ✅ **Connecté à Supabase**
- Liste des tables détectées
- Nombre d'utilisateurs (si applicable)

### 5.3 Tester les requêtes

Cliquer sur "🧪 Tester une requête" pour vérifier que les données sont accessibles.

## 🔒 Étape 6 : Configurer la sécurité (Row Level Security)

### 6.1 Activer RLS sur toutes les tables

```sql
-- Activer RLS sur toutes les tables
DO $$ 
DECLARE 
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;
```

### 6.2 Créer des policies de base

```sql
-- Exemple : Permettre la lecture publique
CREATE POLICY "Allow public read access" 
ON your_table_name
FOR SELECT 
USING (true);

-- Exemple : Permettre l'écriture aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to insert" 
ON your_table_name
FOR INSERT 
TO authenticated
WITH CHECK (true);
```

## 📱 Étape 7 : Préparer pour PWA/Tauri

### 7.1 Build pour production

```powershell
pnpm build
```

### 7.2 Tester le build

```powershell
pnpm preview
```

### 7.3 Configuration PWA

Les fichiers PWA sont déjà configurés dans `vite.config.ts`.

Pour personnaliser :
1. Ajouter vos icônes dans `public/` (192x192 et 512x512)
2. Modifier le manifest dans `vite.config.ts`

### 7.4 Configuration Tauri (Desktop)

```powershell
# Initialiser Tauri
pnpm tauri init

# Développement desktop
pnpm tauri dev

# Build desktop
pnpm tauri build
```

## ✅ Étape 8 : Validation finale

### 8.1 Checklist de validation

- [ ] Toutes les tables sont présentes dans Supabase
- [ ] Le nombre de lignes correspond entre PostgreSQL et Supabase
- [ ] Les relations (foreign keys) sont intactes
- [ ] Les index sont créés
- [ ] L'application de test se connecte avec succès
- [ ] Les requêtes de lecture fonctionnent
- [ ] Les requêtes d'écriture fonctionnent (si applicable)
- [ ] RLS est configuré correctement
- [ ] Les utilisateurs peuvent s'authentifier (si applicable)

### 8.2 Tests de performance

```sql
-- Tester les requêtes lentes
EXPLAIN ANALYZE
SELECT * FROM your_table WHERE condition;
```

### 8.3 Backup Supabase

Une fois la migration validée, créer un backup Supabase :

1. Aller dans **Database** → **Backups**
2. Activer les backups automatiques
3. Créer un backup manuel

## 🔄 Étape 9 : Migration des connexions

### 9.1 Mettre à jour les applications existantes

Remplacer les connexions PostgreSQL par Supabase :

```typescript
// Ancien (PostgreSQL direct)
import { Pool } from 'pg'
const pool = new Pool({ connectionString: '...' })

// Nouveau (Supabase)
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)
```

### 9.2 Tester progressivement

1. Garder PostgreSQL actif en parallèle
2. Rediriger 10% du trafic vers Supabase
3. Augmenter progressivement
4. Surveiller les erreurs

## 🆘 Dépannage

### Erreur : "Cannot connect to Supabase"

- Vérifier que les variables d'environnement sont correctes
- Vérifier que le projet Supabase est actif
- Vérifier votre connexion internet

### Erreur : "Permission denied"

- Vérifier les policies RLS
- Vérifier que vous utilisez la bonne clé API (anon vs service_role)

### Erreur : "Table does not exist"

- Vérifier que le schéma a été importé correctement
- Vérifier le nom de la table (sensible à la casse)

### Performance lente

- Vérifier que les index sont créés
- Activer la mise en cache
- Utiliser les fonctions PostgreSQL côté serveur

## 📞 Support

- Documentation Supabase : https://supabase.com/docs
- Discord Supabase : https://discord.supabase.com
- GitHub Issues : Créer un ticket si problème avec ce projet

## 🎉 Félicitations !

Votre base de données est maintenant migrée sur Supabase !

Prochaines étapes :
- Développer l'application React Native complète
- Configurer l'authentification
- Ajouter les fonctionnalités métier
- Déployer en production
