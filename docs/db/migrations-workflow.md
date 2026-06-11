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

## Application — CANAL UNIQUE : `db push`

Depuis la réconciliation de juin 2026 (voir plus bas), l'historique distant
(`schema_migrations`) est aligné sur les fichiers `NNN`. **On applique donc via
`db push`, qui applique le SQL ET enregistre l'historique de façon atomique** :

```bash
npx supabase db push --linked          # applique tous les NNN en attente + les enregistre
npx supabase db push --dry-run --linked  # vérif AVANT : liste ce qui serait appliqué
```

Workflow : écrire le fichier `NNN_nom.sql` → `db push --dry-run` (contrôle) → `db push`. Point.

**INTERDITS (ils créent la divergence repo/prod qu'on vient de nettoyer)** :
- ❌ MCP `apply_migration` — enregistre sous un nom *timestamp* ≠ `NNN` → orphelins dans l'historique.
- ❌ Dashboard SQL editor pour une migration — applique sans enregistrer le bon `NNN`.
- ❌ `db query -f` — exécute le SQL mais **n'enregistre pas** l'historique → `db push` le re-tentera.

Ces canaux ne sont QUE des secours d'urgence si `db push` est cassé — et dans ce cas,
`migration repair --status applied <NNN>` juste après, sans faute, pour réaligner.

Ne JAMAIS demander à l'humain d'appliquer manuellement (sauf panne totale du CLI).

## Numéros : séquentiels et UNIQUES

Un numéro `NNN` = un seul fichier. **Jamais deux fichiers au même numéro** : le CLI
en marque un « appliqué » et considère l'autre « en attente » à chaque `db push`.
(Cas réel nettoyé en juin 2026 : doublons 175 et 215 → renumérotés 228 et 229.)

## Marquer une migration comme appliquée (réparation d'historique)

```bash
npx supabase migration repair --status applied <version> --linked    # marque appliqué SANS rejouer le SQL
npx supabase migration repair --status reverted <version> --linked   # retire la ligne d'historique
```
`repair` ne touche QUE la table de bookkeeping — jamais le schéma ni les données.

## Réconciliation de l'historique — juin 2026

Contexte : de mi-mai à début juin, des migrations avaient été appliquées via MCP
`apply_migration` / dashboard → 37 enregistrements *timestamp* dans `schema_migrations`
sans contrepartie `NNN`, plus 2 doublons de version (175, 215). `db push` refusait de
tourner (« Remote migration versions not found in local »).

Nettoyage (tout via `migration repair`, zéro impact schéma) :
1. `--status applied` sur tous les `NNN` réellement en prod mais non enregistrés (175→227).
2. `--status reverted` sur les 37 timestamps orphelins.
3. Doublons 175/215 → renumérotés 228 (`gps_radius`) et 229 (`veille_faction_follows`).
4. `db push --dry-run` → **« Remote database is up to date »**. Canal propre.

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

## Graphify-SQL = vue fiable du live (sous invariant)

Le nœud SQL d'une fonction pointe vers sa définition à **numéro de migration le plus haut** (dédup keep-last, depuis le 4 juin — avant, il pointait vers la PLUS VIEILLE, ce qui a causé la régression `get_defis_board`/`tag`). Donc consulter graphify (couche 2) donne bien la **dernière** définition, sans grep.

**Invariant qui garantit "dernière migration == live"** : tout DDL passe par un **fichier de migration numéroté**. Ne JAMAIS faire un `CREATE OR REPLACE FUNCTION` via `execute_sql`/MCP sans créer le fichier correspondant — sinon le live diverge du graphe silencieusement. (`apply_migration` MCP applique au live mais n'écrit PAS le fichier local : écrire le `.sql` numéroté en parallèle.)

Source de vérité ultime en cas de doute : `pg_get_functiondef(...)` sur le live (cf. `gotchas.md`).
