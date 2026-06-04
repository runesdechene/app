# Migrations SQL — workflow

## Création

1. **Numérotées** dans `supabase/migrations/`, format `NNN_description.sql`.
2. **Séquentielles** — incrémenter le plus haut numéro existant.
3. **En-tête commenté obligatoire** (rationale "WHY : ...") — Graphify-SQL parse ces commentaires comme description du nœud, donc c'est ce que Claude lira en priorité plus tard.
4. **Avant tout `CREATE OR REPLACE FUNCTION`** : récupérer la définition **LIVE** comme base, JAMAIS reconstruire depuis une migration ancienne.
   ```sql
   select pg_get_functiondef('public.ma_fonction(text)'::regprocedure);
   ```
   La DB live est la seule source de vérité : une fonction est souvent enrichie par plusieurs migrations successives (ex. `get_defis_board` : corps en 192, champ `tag` ajouté en 193). Repartir d'un vieux fichier fait silencieusement sauter les enrichissements ultérieurs. Copier la def live, appliquer UNIQUEMENT le delta voulu, ré-appliquer. (voir `gotchas.md` → "Lire avant de réécrire").

## Preview obligatoire avant apply (RPCs)

Si la migration touche à un `CREATE OR REPLACE FUNCTION`, lancer le preview avant d'apply :

```bash
node scripts/migration-preview.mjs supabase/migrations/XXX_nom.sql
```

Le script affiche pour chaque fonction modifiée :
- Diff côté git (rouge/vert) vs la version actuellement définie dans une migration antérieure
- Liste explicite des valeurs hardcodées, conditions de garde et formes de retour qui ont **changé** (limites, gains, distances, error strings, RETURN shape)

**Si une régression sémantique est repérée** → corriger la migration AVANT `db query`. C'est le garde-fou contre la classe de bug du 9 avril 2026 (migration 081 qui a silencieusement réécrit `revisit_place_gps` en perdant la spec V0.5.7 — perdu jusqu'au 28 avril).

Pour les migrations purement DDL/data (pas de RPC), le script affiche "rien à vérifier" et exit 0.

## Application

Toujours via CLI, jamais manuellement :

```bash
npx supabase db query --linked -f supabase/migrations/XXX_nom.sql
```

Ne JAMAIS demander à l'humain d'appliquer manuellement.

## Marquer une migration comme appliquée (si faite hors CLI)

```bash
npx supabase migration repair <version> --status applied
```

## Avant un backfill massif

Désactiver les triggers concernés (voir `gotchas.md` → "Backfill — toujours désactiver les triggers").

## DB dev = production alpha

On travaille **directement sur la DB de production**. Pas de DB dev séparée pour l'instant (alpha, ROI négatif d'une duplication).

**Implications** :
- Migrations appliquées directement sur prod → **toujours tester** sur données réelles avant
- Bugs de migration impactent les vrais users → rollback plan obligatoire
- Backfills massifs : désactiver triggers d'abord
- Pas de fake users en masse "pour tester" — pollue la prod

URL projet : `https://ukpapqssgsxirsgmcvof.supabase.co`

## Après une modif SQL

Régénérer le graphe pour que les nouveaux nœuds RPC/table apparaissent dans le contexte Claude :

```bash
python3 scripts/graphify-sql.py
```

Idempotent. Voir `CLAUDE.md` racine, section Graphify.
