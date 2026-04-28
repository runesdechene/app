# Migrations SQL — workflow

## Création

1. **Numérotées** dans `supabase/migrations/`, format `NNN_description.sql`.
2. **Séquentielles** — incrémenter le plus haut numéro existant.
3. **En-tête commenté obligatoire** (rationale "WHY : ...") — Graphify-SQL parse ces commentaires comme description du nœud, donc c'est ce que Claude lira en priorité plus tard.
4. **Avant de réécrire une RPC** : lire la version la plus récente intégralement (voir `gotchas.md` → "Lire avant de réécrire").

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
