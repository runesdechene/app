# Pioche d'énigmes par Thème (+ batch Grèce Antique)

> Spec — 2026-06-15 (révisée : suppression complète du lien faction sur les énigmes)
> Statut : validée (brainstorming), prête pour plan d'implémentation.

## Contexte & problème

Aujourd'hui, un **motif** (= un `title_fragments`, ex. « Motif Hoplite ») pioche ses
énigmes **par faction** : la RPC `get_fragment_enigma` lit `title_fragments.collection`
(un id de faction) et sélectionne `WHERE enigmas.heritage_id = collection`. La
disponibilité affichée (`hasEnigma`) est calculée pareil dans `get_my_fragment_status`.
La quotidienne affiche un **badge faction** dérivé de `enigma.heritage_id`.

Ce couplage **ne sait pas servir un thème qui n'est pas une faction**. Les 32 énigmes
grecques existantes (mig 010) ont `heritage_id = NULL` + `theme = 'grecque'` car la Grèce
n'est pas une faction → un futur Motif grec ne peut pas les piocher proprement.

La colonne `enigmas.theme` (mig 009) a été ajoutée *exactement* pour découpler le thème
culturel de la mécanique faction, mais **aucune logique ne pioche dessus** à ce jour.

## Décisions de design (validées)

1. **Granularité** : pool culturel **partagé**. Un motif pioche dans TOUT le pool d'un
   thème (ex. toutes les énigmes `grecque`).
2. **Suppression totale du lien faction sur l'énigme.** La pioche ET l'affichage passent
   sur `theme`. La colonne `enigmas.heritage_id` (+ sa FK) est **droppée**. Le badge
   faction de la quotidienne devient un **macaron de thème**.
   - La mécanique faction elle-même (Coupe des Héritages, `factions`, titres) **n'est pas
     touchée** ailleurs. On retire juste le lien énigme→faction.
   - `title_fragments.collection` (faction) **reste** : il sert l'affichage « Découvrir la
     collection » (shop) et `get_user_fragments` (display-only). Il cesse de piloter la
     pioche.
3. **Stockage** : **table de référence dédiée** `enigma_themes` (menu déroulant propre côté
   Hub + métadonnées du macaron : `label`, `color`, `icon`).
4. **Nommage Hub** : on appelle ce concept **« Thème »**. Le menu faction (« Heritage ») de
   l'éditeur d'énigmes est **retiré**.
5. **Exclusivité du pool** : les énigmes à thème **restent dans la quotidienne universelle**
   ET sont piochables par le motif. Le **filtrage du pool de `get_daily_enigma` ne change
   pas** (toujours toutes les `type='daily'` actives, sans filtre de thème). Seul le
   **champ retourné** passe de `heritageId` à `theme` (pour le macaron).
   Conséquence assumée : avec +100 grecques en `type='daily'`, la quotidienne universelle
   devient massivement grecque en volume.

## Architecture

### Schéma DB

**Nouvelle table** :
```sql
CREATE TABLE public.enigma_themes (
  id         text PRIMARY KEY,            -- ex. 'grecque'
  label      text NOT NULL,               -- ex. 'Grèce Antique' (texte du macaron)
  color      text,                        -- ex. '#1d4e89' (couleur pilule), nullable
  icon       text,                        -- url mask-image optionnelle (comme factions.pattern)
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);
```
Seed **dynamique** depuis les valeurs distinctes déjà présentes (garantit que la FK ne
cassera pas) :
```sql
INSERT INTO public.enigma_themes (id, label)
SELECT DISTINCT theme, initcap(theme)
FROM public.enigmas WHERE theme IS NOT NULL
ON CONFLICT (id) DO NOTHING;
```
Puis ajuster les libellés/couleurs lisibles : `grecque` → « Grèce Antique » (+ une couleur),
et backfill `color` des 4 thèmes miroir depuis leur faction homonyme (one-shot, sans
coupling runtime).

**`enigmas.theme`** (existe déjà, TEXT) : ajout d'une **FK → `enigma_themes(id)`** après le
seed. Reste nullable (énigme sans thème = générique, pas de macaron).

**`enigmas.heritage_id`** : **DROP** — d'abord `DROP CONSTRAINT enigmas_heritage_id_fkey`
(baseline l.7675), puis `DROP COLUMN heritage_id`. **Uniquement après** réécriture des RPC
(sinon les fonctions cassent au runtime).

**`title_fragments.theme`** : **nouvelle colonne** `text REFERENCES enigma_themes(id)` —
le pool de pioche du motif.

### Logique : 3 RPC à basculer sur `theme`

Procédure obligatoire (`docs/db/gotchas.md` + `migrations-workflow.md`) : récupérer la
**def LIVE** via `pg_get_functiondef(...)` avant réécriture, copier verbatim, ne modifier
que le delta. **Preview obligatoire** : `node scripts/migration-preview.mjs <fichier>`.

1. **`get_fragment_enigma(p_user_id, p_fragment_id)`** (live = baseline) :
   - `v_theme := title_fragments.theme` (au lieu de `collection`).
   - `IF v_theme IS NULL → RETURN error 'no_theme'` (remplace `'no_collection'`).
   - Pioche : `WHERE enigmas.theme = v_theme` aux 3 niveaux de la cascade (exact non-répondu
     → exact → repli n'importe quelle daily, inchangé).
   - JSON retourné : `'heritageId'` → `'theme'` (= `v_enigma.theme`). Reste verbatim.

2. **`get_my_fragment_status(p_user_id)`** (live = baseline) :
   - `hasEnigma` : `tf.theme IS NOT NULL AND EXISTS(... e.theme = tf.theme ...)`
     (au lieu de `tf.collection` / `e.heritage_id`).
   - Garder `'collection', tf.collection` dans le JSON. Reste verbatim.

3. **`get_daily_enigma(p_user_id)`** (live = mig 129) :
   - **Filtrage du pool inchangé** (aucun filtre de thème ajouté).
   - JSON retourné : `'heritageId', v_enigma.heritage_id` → `'theme', v_enigma.theme`.
   - Reste verbatim (seed quotidien, cascade difficultés, etc.).

### Backfill (sans rupture)

`title_fragments.theme` depuis le miroir faction 1:1 (cf. backfill mig 009) :
```sql
UPDATE title_fragments SET theme = CASE collection
  WHEN 'faction-celtique'  THEN 'celtique'
  WHEN 'faction-nordique'  THEN 'nordique'
  WHEN 'faction-romaine'   THEN 'romaine'
  WHEN 'faction-byzantine' THEN 'byzantine'
  ELSE theme END
WHERE theme IS NULL;
```
Les motifs grecs (à créer) → `theme = 'grecque'`.

### Front (explore-web) — `DailyEnigma.tsx`

- L'interface `Enigma` : `heritageId` → `theme: string | null`.
- Le mapping du retour RPC (l.120) : `heritageId` → `theme`.
- Remplacer le `useState`/fetch `factions` (l.75-87) par un fetch
  `enigma_themes (id, label, color, icon)` → `Map<string, {label,color,icon}>`.
- Remplacer le bloc pilule faction (l.236-253) par un **macaron de thème** :
  pilule colorée (`color` du thème, fallback or parchemin si null) + icône mask optionnelle
  (`icon`) + texte = `label`. Plus de mention « Faction ».

### Hub (back-office)

- **`Enigmas.tsx`** :
  - `Enigma.heritage_id` → `theme` partout (interface, EMPTY_ENIGMA, mapping, payload).
  - **Retirer** le menu « Heritage » (faction) et le fetch `factions`.
  - Ajouter un menu **« Thème »** alimenté par `enigma_themes` (création + édition) + le
    filtre liste « Tous thèmes » (remplace « Tous heritages »).
- **`Fragments.tsx`** : nouveau menu **« Thème »** alimenté par `enigma_themes` (lié à
  `frag.theme`), à côté du menu « Collection » (qui reste).

## Nettoyage de l'ancien système (le « vire le lien faction »)

Périmètre exact (grep `e.heritage_id` / `heritageId` / `collection` sur `supabase/migrations`
+ `apps/*/src`) :

- **Migré vers `theme`** : `get_fragment_enigma`, `get_my_fragment_status`, `get_daily_enigma`.
- **Supprimé** : colonne `enigmas.heritage_id` + FK `enigmas_heritage_id_fkey` ; erreur
  `'no_collection'` ; badge faction + fetch `factions` dans `DailyEnigma.tsx` ; menu faction
  dans le Hub `Enigmas.tsx`.
- **Conservé** : `title_fragments.collection` (shop link + `get_user_fragments`) ; toute la
  mécanique faction/Coupe/titres (non liée aux énigmes).
- **Ordre impératif** : réécrire les 3 RPC AVANT le `DROP COLUMN` (sinon runtime cassé).
- **Vérif finale** : re-grep `heritage_id` côté SQL pour confirmer qu'aucune RPC live ne
  référence plus la colonne droppée. (Défs mortes baseline 2323 / mig 007 = remplacées par
  129, non live — ignorer.)

## Batch des 100 énigmes grecques (livrable B — plan séparé)

- Insert `theme='grecque'`, `type='daily'`, `active=TRUE` (plus de `heritage_id`).
- Difficultés équilibrées (~ proportion mig 010), mix QCM (4 choix) / libre.
- **Charte = mig 010** : sources Hérodote / Thucydide / Plutarque / Diogène Laërce / Pline ;
  questions courtes ; lore immersif ; explanations laconiques ; angle historique + occulte
  discret. **Anti-doublon** avec les 32 existantes. **Fact-check obligatoire** par énigme.
- ⚠️ Cadrage de la génération (potentiellement workflow multi-agents génération → fact-check
  adversarial) à proposer **sur feu vert explicite** d'Uriel.

## Ordre de livraison

**Livrable A d'abord** (ce plan). **B** ensuite (plan dédié), après que la table + FK
existent.

1. Migration schéma : `enigma_themes` + seed + FK `enigmas.theme` + colonne
   `title_fragments.theme` + backfill. (PAS encore le DROP de heritage_id.)
2. Migration RPC : les 3 fonctions → `theme` (def live verbatim + preview).
3. Migration DROP : FK + `enigmas.heritage_id`.
4. Front `DailyEnigma.tsx` : macaron de thème.
5. Hub `Enigmas.tsx` + `Fragments.tsx` : menus « Thème ».
6. (B, plan séparé) Batch 100 énigmes grecques.

## Risques / vigilance

- **Régression silencieuse RPC** : procédure « def live verbatim » + `migration-preview.mjs`
  pour les 3 RPC. Ne retirer aucun champ JSON sans grep front préalable.
- **Ordre DROP** : colonne droppée seulement après bascule des 3 RPC.
- **FK `enigmas.theme`** : poser la FK seulement après seed complet des valeurs distinctes.
- **Application** : canal unique `npx supabase db push --linked` (jamais MCP apply_migration
  ni dashboard). Numéros séquentiels uniques (prochain libre : voir glob au moment du plan).
- **DB = prod alpha** : migrations directes sur prod → tester sur données réelles, prévoir
  rollback. Pas de backfill > 100 lignes sans désactiver triggers (ici les UPDATE backfill
  sont petits).
- **`handle_new_user`** : non concerné (pas de modif sur `public.users`).
- **Graphify** : `python3 scripts/graphify-sql.py` après les migrations (hook post-commit le
  fait aussi). **Repo voisin Shopify** : RAS (RPC anon non touchées).
