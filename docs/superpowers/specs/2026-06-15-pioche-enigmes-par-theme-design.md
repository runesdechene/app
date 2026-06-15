# Pioche d'énigmes par Thème (+ batch Grèce Antique)

> Spec — 2026-06-15
> Statut : validée (brainstorming), prête pour plan d'implémentation.

## Contexte & problème

Aujourd'hui, un **motif** (= un `title_fragments`, ex. « Motif Hoplite ») pioche ses
énigmes **par faction** : la RPC `get_fragment_enigma` lit `title_fragments.collection`
(un id de faction) et sélectionne `WHERE enigmas.heritage_id = collection`. La
disponibilité affichée (`hasEnigma`) est calculée pareil dans `get_my_fragment_status`.

Ce couplage **ne sait pas servir un thème qui n'est pas une faction**. Les 32 énigmes
grecques existantes (mig 010) ont `heritage_id = NULL` + `theme = 'grecque'` car la Grèce
n'est pas une faction → un futur Motif grec ne peut pas les piocher proprement (il tombe
sur le repli « n'importe quelle daily »).

La colonne `enigmas.theme` (mig 009) a été ajoutée *exactement* pour découpler le thème
culturel de la mécanique faction, mais **aucune logique ne pioche dessus** à ce jour.

## Décisions de design (validées)

1. **Granularité** : pool culturel **partagé**. Un motif pioche dans TOUT le pool d'un
   thème (ex. toutes les énigmes `grecque`). Plusieurs motifs d'un même thème partagent
   le réservoir.
2. **Approche retenue** : la pioche se fait **par thème culturel**, pas par faction. La
   faction (`heritage_id` / Coupe des Héritages) **n'est pas touchée** dans sa mécanique ;
   on la découple seulement de la pioche d'énigmes.
3. **Stockage** : **table de référence dédiée** `enigma_themes` (menu déroulant propre côté
   Hub, zéro faute de frappe).
4. **Nommage Hub** : on appelle ce concept **« Thème »** (et on laisse « Héritage » =
   faction). Pas de fusion faction/thème.
5. **Exclusivité** : les énigmes à thème **restent dans la quotidienne universelle** ET
   sont piochables par le motif. **Aucun changement à `get_daily_enigma`.**
   Conséquence assumée : avec +100 grecques en `type='daily'`, la quotidienne universelle
   devient massivement grecque en volume.

## Architecture

### Schéma DB

**Nouvelle table** :
```sql
CREATE TABLE public.enigma_themes (
  id         text PRIMARY KEY,            -- ex. 'grecque'
  label      text NOT NULL,               -- ex. 'Grèce Antique'
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);
```
Seed depuis les valeurs distinctes déjà présentes dans `enigmas.theme` :
`grecque` (« Grèce Antique »), `celtique`, `nordique`, `romaine`, `byzantine`.

**`enigmas.theme`** (existe déjà, TEXT) : ajout d'une **FK → `enigma_themes(id)`** une fois
les valeurs distinctes seedées. (Reste nullable : une énigme sans thème = générique.)

**`title_fragments.theme`** : **nouvelle colonne** `text REFERENCES enigma_themes(id)` —
le pool de pioche du motif.

### Logique de pioche (les deux RPC à basculer)

Procédure obligatoire (cf. `docs/db/gotchas.md`) : récupérer la **def LIVE** via
`pg_get_functiondef(...)` avant réécriture, copier verbatim, ne modifier que la jointure.

1. **`get_fragment_enigma(p_user_id, p_fragment_id)`** :
   - `v_theme := title_fragments.theme` (au lieu de `collection`).
   - `IF v_theme IS NULL → RETURN error 'no_theme'` (remplace `'no_collection'`).
   - Pioche : `WHERE enigmas.theme = v_theme` (au lieu de `heritage_id = v_collection`),
     aux 3 niveaux de la cascade :
     1. thème exact, actif, non répondu par l'user ;
     2. thème exact, actif (déjà répondu toléré) ;
     3. **repli inchangé** : n'importe quelle daily active.
   - Tout le reste (cooldown via `activity_log`, JSON retourné dont `heritageId`,
     `fragmentId`) **conservé verbatim**.

2. **`get_my_fragment_status(p_user_id)`** :
   - Champ `hasEnigma` : remplacer
     `tf.collection IS NOT NULL AND EXISTS(... e.heritage_id = tf.collection ...)`
     par `tf.theme IS NOT NULL AND EXISTS(... e.theme = tf.theme ...)`.
   - Garder `'collection', tf.collection` dans le JSON (affichage). Tout le reste verbatim
     (cooldown, enigmaNextAt, affinities).

### Backfill (sans rupture)

Les thèmes miroitent déjà les 4 factions 1:1 (cf. backfill mig 009). Mapping trivial :
```sql
UPDATE title_fragments SET theme = CASE collection
  WHEN 'faction-celtique'  THEN 'celtique'
  WHEN 'faction-nordique'  THEN 'nordique'
  WHEN 'faction-romaine'   THEN 'romaine'
  WHEN 'faction-byzantine' THEN 'byzantine'
  ELSE theme END
WHERE theme IS NULL;
```
Les motifs grecs (Hoplite, Hécate, à créer) → `theme = 'grecque'`.

### Hub (back-office)

- **`Enigmas.tsx`** : nouveau menu **« Thème »** alimenté par `enigma_themes` (lié à
  `editForm.theme`). Le champ faction existant (« Heritage » → `heritage_id`) reste,
  optionnel. Ajouter un filtre liste par thème. (Le menu « Heritage » actuel mappé sur
  `factions` peut être renommé « Faction » pour lever la confusion.)
- **`Fragments.tsx`** : nouveau menu **« Thème »** alimenté par `enigma_themes` (lié à
  `frag.theme`), à côté du menu « Collection » existant.

## Nettoyage de l'ancien système

**Périmètre exact** (vérifié par grep `collection` / `heritage_id` sur `supabase/migrations`
+ `apps/explore-web/src`) :

- **À migrer vers `theme` (fonctionnel, obligatoire)** :
  - `get_fragment_enigma` (pioche)
  - `get_my_fragment_status` (flag `hasEnigma`)
  Sans les deux, un motif non-faction calcule `hasEnigma=false` → le joueur ne voit jamais
  son énigme (l'UI `EnigmaChestButton.tsx` l.54 filtre sur `hasEnigma`).
- **Supprimé de fait** : l'erreur `'no_collection'`, les branches `heritage_id = collection`
  de la pioche.
- **À CONSERVER (usages live, ne pas droper)** :
  - `enigmas.heritage_id` — badge faction dans `DailyEnigma.tsx` l.236-237.
  - `title_fragments.collection` — affichage « Découvrir la collection » et
    `get_user_fragments` (l.4047, display-only). Cesse juste de piloter la pioche.
- **Vérification finale** : après bascule, re-grep `heritage_id = .*collection` côté SQL
  pour confirmer qu'aucune autre RPC ne pioche encore par faction.

## Batch des 100 énigmes grecques (livrable B)

- Insert `theme='grecque'`, `heritage_id=NULL`, `type='daily'`, `active=TRUE`.
- Difficultés équilibrées (répartition à caler, ~ proportion mig 010 : very_easy/easy/
  medium/hard), mix QCM (4 choix) / libre.
- **Charte éditoriale = mig 010** : sources Hérodote / Thucydide / Plutarque / Diogène
  Laërce / Pline ; questions courtes ; lore immersif ; explanations laconiques ; angle
  historique avec occulte discret (peu mythologique).
- **Anti-doublon** : ne pas répéter les 32 énigmes de la mig 010.
- **Fact-check historique obligatoire** sur chaque énigme (réponse + explanation + dates).
- Nouvelle migration numérotée `supabase/migrations/` (idempotence non requise pour un
  INSERT de seed, mais entête WHY conforme).
- ⚠️ Volume : 100 énigmes de qualité = gros effort génération + vérification. Cadrage de
  cette étape (potentiellement workflow multi-agents génération → fact-check adversarial)
  à proposer **sur feu vert explicite** d'Uriel au moment du livrable B.

## Ordre de livraison

**A avant B** : la table `enigma_themes` + FK doivent exister avant d'insérer les 100
énigmes (qui référenceront `theme='grecque'` via la FK).

1. Migration schéma : `enigma_themes` + seed + FK `enigmas.theme` + colonne
   `title_fragments.theme` + backfill.
2. Migration RPC : `get_fragment_enigma` + `get_my_fragment_status` (def live verbatim,
   jointure → theme).
3. Hub : menus « Thème » (Enigmas + Fragments) + filtre.
4. (B) Migration batch 100 énigmes grecques.

## Risques / points de vigilance

- **Régression silencieuse RPC** : suivre la procédure « def live verbatim » des gotchas
  pour les deux RPC. Ne retirer aucun champ du JSON sans grep préalable côté front.
- **`handle_new_user`** : non concerné (pas de modif sur `public.users`).
- **FK `enigmas.theme`** : poser la FK seulement après s'être assuré que toutes les valeurs
  `theme` distinctes existantes sont seedées dans `enigma_themes` (sinon l'`ALTER` échoue).
- **Bucket storage** : aucun nouveau bucket. RAS côté storage.
- **Graphify** : la migration SQL déclenche le hook `graphify-sql.py` (post-commit) — OK.
- **Repo voisin Shopify** : les RPC anon impactées par le thème (`get_community_photos…`,
  `get_fragment_unlocks…`) ne sont **pas** touchées ici. RAS cross-repo.
