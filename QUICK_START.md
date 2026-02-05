# 🚀 Quick Start - Migration PostgreSQL → Supabase

## 📝 Résumé du projet

Migration de **Rune2Chain Explorer** de PostgreSQL DigitalOcean vers Supabase avec interface React PWA/Desktop (Tauri).

## ⚡ Démarrage rapide (5 étapes)

### 1️⃣ Installer les dépendances

```powershell
pnpm install
```

### 2️⃣ Exporter votre base PostgreSQL

```powershell
# Modifier les paramètres selon votre configuration
.\scripts\export-postgres.ps1 -Host "localhost" -Port "5432" -Database "rune2chain" -User "postgres" -Password "votre_mot_de_passe"
```

Cela créera un dossier `backups\[timestamp]\` avec :
- `schema.sql` - Structure de la base
- `data.sql` - Toutes les données
- `full_backup.sql` - Backup complet de sécurité
- `stats.txt` - Statistiques

### 3️⃣ Créer un projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Copier l'URL et la clé API

### 4️⃣ Configurer l'environnement

```powershell
# Copier le fichier d'exemple
Copy-Item .env.example .env

# Éditer avec vos credentials Supabase
notepad .env
```

Remplir :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5️⃣ Importer dans Supabase

1. Ouvrir **SQL Editor** dans Supabase
2. Copier-coller le contenu de `backups\[timestamp]\schema.sql`
3. Exécuter ▶️
4. Copier-coller le contenu de `backups\[timestamp]\data.sql`
5. Exécuter ▶️

### 6️⃣ Tester la connexion

```powershell
pnpm dev
```

Ouvrir http://localhost:3000 - Vous devriez voir "✅ Connecté à Supabase"

## 📚 Documentation complète

Pour un guide détaillé étape par étape, voir [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md)

## 🛠️ Commandes utiles

```powershell
# Développement
pnpm dev              # Lancer l'app de test

# Build
pnpm build            # Build pour production
pnpm preview          # Prévisualiser le build

# Desktop (Tauri)
pnpm tauri dev        # Lancer en mode desktop
pnpm tauri build      # Build application desktop

# PostgreSQL
pg_dump --help        # Aide sur pg_dump
psql --help           # Aide sur psql
```

## ⚠️ Checklist de sécurité

Avant de migrer en production :

- [ ] Backup complet de PostgreSQL créé et testé
- [ ] Toutes les tables importées dans Supabase
- [ ] Nombre de lignes vérifié (PostgreSQL vs Supabase)
- [ ] Row Level Security (RLS) configuré
- [ ] Variables d'environnement sécurisées
- [ ] Tests de connexion réussis
- [ ] Tests de lecture/écriture réussis
- [ ] Backup Supabase activé

## 🆘 Problèmes courants

### "Cannot connect to Supabase"
→ Vérifier les variables d'environnement dans `.env`

### "pg_dump: command not found"
→ Installer PostgreSQL client tools

### "Permission denied" dans Supabase
→ Configurer les policies RLS dans SQL Editor

### Import échoue (fichier trop gros)
→ Diviser `data.sql` en plusieurs parties

## 📞 Besoin d'aide ?

Consultez le guide complet : [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md)
