# V0.7 — Plantage de l'étendard (système de Veille)

> Phase 1 du chantier V0.7. Brainstormé en session du 30 avril 2026 (voir mémoire `project_session_30avril.md`). Q1 + Q2 tranchées le 30 avril.
> **Hors scope ici** : Couronnes de Chêne, Coupe des Héritages, Campement — chantiers séparés à venir.

## Contexte

V0.5 distribuait l'influence territoriale via 4 canaux cumulatifs (`placed_points`, `permanent_points`, `content_points`, GPS). Frein psychologique observé : un joueur n'osait pas liker un récit adverse parce que ça donnait de l'influence à la faction adverse. Le like, censé être une appréciation, était devenu un acte stratégique.

V0.7 sépare strictement **veille du lieu** et **gloire personnelle** :
- 1 lieu = **une seule veille active** à un instant T (la dernière en date)
- Une veille peut compter **1 à N veilleurs** : solo (1 personne) ou expédition (groupe ayant planté ensemble)
- Plus d'influence cumulative ; la veille est binaire (présente / absente / supplantée)
- Une nouvelle veille **supplante** entièrement la précédente — l'ancienne expédition reste tracée dans l'historique mais n'est plus active

## Décisions clés (Q1 + Q2)

- **Veilleur initial des lieux existants (Q1=d)** : dernier user à avoir une interaction GPS (visit_gps ou revisit_gps dans `activity_log`, fallback `place_explorers.visited_at`). Faction du veilleur = faction actuelle de ce user (pas historique). Si lieu jamais visité en GPS → vacant.
- **Influence accumulée (Q2=a)** : **gelée**. Tables `place_influence`, `user_place_influence` et leurs RPCs sont marquées DEPRECATES dans le commentaire d'en-tête de la migration `015_v07_veille.sql`. Pas de DROP cette session — cleanup ultérieur scripté via Graphify (Q2 garde la porte ouverte au c, "possible suppression ensuite").

## Vocabulaire

- **Veiller** un lieu (verbe canonique, remplace "conquérir" / "claim")
- **Planter l'étendard** (action UX)
- **Veilleur(s)** (sujet — 1 à N pour une veille donnée)
- **Veille** = l'état actif d'un lieu = une expédition (de 1 à N membres) qui détient le lieu
- **Expédition** = groupe (≥ 1 personne) ayant planté ensemble en un instant T. Solo = expédition de 1.
- **Veille neutre** (couleur brune — quand l'expédition compte des membres de factions différentes)
- **Supplantation** : poser une nouvelle veille par-dessus une précédente (pas d'événement spécial, juste l'expédition courante remplacée par la nouvelle dans `place_veille` ; l'historique reste dans `veille_history`)

## Schema

> **Modèle unifié** : toute veille = une expédition (de 1 à N membres). Le solo est une expédition de 1. Cela évite les branches solo / groupe dans les RPCs et l'UI.

```sql
-- Une expédition = groupe (1+ membres) ayant planté ensemble en un instant T
CREATE TABLE public.expeditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  is_neutral  boolean NOT NULL DEFAULT false,                -- true si membres de plusieurs factions
  faction_id  text REFERENCES public.factions(id),           -- NULL si neutral, sinon faction commune
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Membres de l'expédition (1 ligne par participant, y compris le créateur)
CREATE TABLE public.expedition_members (
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id       text REFERENCES public.users(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),
  PRIMARY KEY (expedition_id, user_id)
);

-- Veille active : 1 ligne par lieu actuellement veillé (pointe vers l'expédition courante)
-- faction_id et is_neutral sont denormalisés depuis expeditions pour les requêtes carte massives
CREATE TABLE public.place_veille (
  place_id      text PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),         -- copie de expeditions.faction_id
  is_neutral    boolean NOT NULL DEFAULT false,              -- copie de expeditions.is_neutral
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX place_veille_faction_idx ON public.place_veille (faction_id) WHERE NOT is_neutral;

-- Historique : chaque membre de chaque expédition planté = 1 ligne (audit + futurs leaderboards)
CREATE TABLE public.veille_history (
  id            bigserial PRIMARY KEY,
  place_id      text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE SET NULL,
  user_id       text REFERENCES public.users(id) ON DELETE SET NULL,
  faction_id    text REFERENCES public.factions(id),
  is_neutral    boolean NOT NULL DEFAULT false,
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX veille_history_place_idx ON public.veille_history (place_id, planted_at DESC);
CREATE INDEX veille_history_user_idx ON public.veille_history (user_id, planted_at DESC);
```

> ⚠️ Tous les IDs en `text` (pas UUID) sauf `expeditions.id` et `veille_history.id` — cohérent avec le schema existant (`places.id`, `users.id`, `factions.id` sont `varchar(255)`).

## Soft transition (incluse dans la migration)

Pour chaque lieu candidat (dernier visiteur GPS connu), on crée une expédition solo de 1 membre puis on lie `place_veille` à cette expédition. Boucle PL/pgSQL pour rester simple et correct.

```sql
DO $$
DECLARE
  c record;
  v_exp_id uuid;
BEGIN
  FOR c IN
    WITH last_gps_per_place AS (
      SELECT place_id, actor_id AS user_id, MAX(created_at) AS last_at
      FROM public.activity_log
      WHERE type IN ('visit_gps', 'revisit_gps')
        AND place_id IS NOT NULL AND actor_id IS NOT NULL
      GROUP BY place_id, actor_id
    ),
    ranked AS (
      SELECT place_id, user_id, last_at,
             ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY last_at DESC) AS rk
      FROM last_gps_per_place
    ),
    fallback_explorers AS (
      SELECT pe.place_id, pe.user_id, pe.visited_at AS last_at
      FROM public.place_explorers pe
      WHERE pe.place_id NOT IN (SELECT place_id FROM ranked)
    )
    SELECT r.place_id, r.user_id, u.faction_id, r.last_at
    FROM ranked r JOIN public.users u ON u.id = r.user_id
    WHERE r.rk = 1 AND u.faction_id IS NOT NULL
    UNION ALL
    SELECT f.place_id, f.user_id, u.faction_id, f.last_at
    FROM fallback_explorers f JOIN public.users u ON u.id = f.user_id
    WHERE u.faction_id IS NOT NULL
  LOOP
    INSERT INTO public.expeditions(place_id, is_neutral, faction_id, created_at)
    VALUES (c.place_id, false, c.faction_id, c.last_at)
    RETURNING id INTO v_exp_id;

    INSERT INTO public.expedition_members(expedition_id, user_id, faction_id)
    VALUES (v_exp_id, c.user_id, c.faction_id);

    INSERT INTO public.place_veille(place_id, expedition_id, faction_id, is_neutral, planted_at)
    VALUES (c.place_id, v_exp_id, c.faction_id, false, c.last_at)
    ON CONFLICT (place_id) DO NOTHING;

    INSERT INTO public.veille_history(place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (c.place_id, v_exp_id, c.user_id, c.faction_id, false, c.last_at);
  END LOOP;
END $$;
```

## RPCs (phase 1)

### `plant_flag(p_user_id, p_place_id, p_user_lat, p_user_lng, p_partners_user_ids)`

- Vérifie `auth.uid()::text = p_user_id`, sinon `unauthorized`
- Vérifie `haversine_km(...) <= 0.1` (100m), sinon `too_far`
- Charge faction du user, sinon `no_faction`
- **Toujours** crée une nouvelle ligne dans `expeditions` (solo = expédition d'1 membre, pas de branche spéciale).
  - `is_neutral` = TRUE si l'union des factions (créateur + partners) compte > 1 faction distincte
  - `faction_id` = NULL si neutral, sinon la faction commune
- Insère `expedition_members` (créateur **+** partners, chacun avec sa faction)
- UPSERT `place_veille` (PRIMARY KEY = place_id, pointe vers la nouvelle expédition, supplante l'expédition précédente du lieu)
- INSERT dans `veille_history` une ligne par membre
- INSERT dans `activity_log` (type = `'plant_flag'`, data = avatars/noms/factions des membres)
- Retour : `{ success, placeId, isNeutral, factionId, expeditionId, members: [{userId, displayName, avatarUrl, factionId}, ...], plantedAt }` — `members` toujours non-vide.

### `get_nearby_planters(p_user_id, p_place_id, p_user_lat, p_user_lng)`

- Vérifie `auth.uid()::text = p_user_id`
- Cherche dans `activity_log` les autres users qui ont fait `visit_gps` ou `revisit_gps` sur ce lieu OU dans un rayon de 200m du lieu (via une jointure GPS sur `users.last_position` si dispo, sinon juste sur le lieu) dans les 5 dernières minutes
- Filtre : exclut p_user_id, exclut users déjà membres de l'expédition active sur le lieu
- Retour : `{ candidates: [{userId, displayName, avatarUrl, factionId, factionColor}] }`

> Note : implémenté V1 uniquement via `activity_log` du lieu (visit_gps/revisit_gps des 5 dernières min). Évolution possible plus tard avec `users.last_position` si pertinent.

### `get_place_veille(p_place_id)`

- Lit `place_veille` JOIN `expedition_members` (modèle unifié, plus de branche solo / expedition).
- Si `place_veille` absent : `{ vacant: true }`
- Sinon : `{ vacant: false, isNeutral, factionId, plantedAt, members: [{userId, displayName, avatarUrl, factionId}, ...] }` — `members` toujours non-vide (1 à N entrées). Solo = `members.length === 1`.

### `get_map_veilles()`

- Retour minimal pour la carte : `[{placeId, factionId, isNeutral}]`
- Lit `place_veille` uniquement. Pas de jointure lourde.

## UX (phase 1)

### Place panel (`PlacePanel.tsx`)

- Nouveau composant `<VeilleFrame placeId={...} />` ajouté **au-dessus** de `<InfluenceFrame>` (qui reste en lecture seule, sera retirée à un chantier ultérieur).
- Si `userPosition` < 100m du lieu ET `userFactionId` set : bouton « 🚩 Planter l'étendard ».
- Au clic :
  1. Appel `get_nearby_planters` ;
  2. Si 0 candidat : appel direct `plant_flag` (solo) ;
  3. Si ≥ 1 candidat : modal `<ExpeditionOptInModal>` avec checkboxes pour chaque candidat (par défaut tous décochés). « Planter seul » ou « Planter ensemble » → appel `plant_flag` avec partners choisis.
- Affichage de la veille actuelle : pile d'avatars (1 à N selon `members.length`) + faction (ou couleur brune si neutre) + label « Veille depuis le {plantedAt} ». Solo et expédition rendus avec le même composant — la seule différence est le nombre de têtes affichées et le label « X veille » (1 membre) vs « X, Y, Z veillent ensemble » (≥ 2 membres).

### Carte (`mapStore` + `territoryWorker`)

- Nouveau pipe `get_map_veilles()` pour le coloriage des lieux.
- `is_neutral === true` → couleur brune `#8A6F4A` (à confirmer en design).
- Sinon, faction color habituelle.
- En phase 1, on **garde** `get_map_places` actuel et on **superpose** la veille (override) sur le coloriage par influence dominante. La couche influence sera retirée à un chantier ultérieur.

## DEPRECATES — à retirer scripté plus tard via Graphify

Ces objets sont **figés** à partir de la migration 015 (plus alimentés, plus utilisés en lecture par le nouveau code). À cleaner dans un chantier de maintenance dédié.

**Tables** :
- `public.place_influence`
- `public.user_place_influence` *(créée par 013, déjà figée)*

**RPCs** :
- `place_influence_action(p_user_id, p_place_id, p_points, p_target_faction_id, [p_user_lat, p_user_lng])`
- `propose_territory_name(...)` *(013)*
- `vote_territory_name(...)` *(013)*
- `get_territory_votes(...)` *(013)*
- `recalc_place_content_points(...)` *(014)*
- `_blob_dominant_faction(...)`, `_user_blob_influence(...)` *(013, helpers)*
- `claim_place(...)` *legacy déjà flaggée*

**Colonnes (cleanup long terme — sortie de scope)** :
- `places.faction_id`, `places.claimed_by`, `places.claimed_at`, `places.fortification_level`, `places.claimed_avatar_url`

**Pourquoi pas DROP maintenant** : l'ancienne UI (`InfluenceFrame.tsx`) lit encore `place_influence` via `get_player_profile` / `get_map_places` en mode lecture seule. Le DROP casserait la lecture des lieux non-encore-veillés. On retire l'UI legacy à un chantier ultérieur.

**Cas particulier `TerritoryPanel.tsx`** (décision Uriel, 1er mai 2026) : le panel de proposition/vote de noms de territoires (`propose_territory_name`, `vote_territory_name` — mig 013) reste **actif** pendant la passation douce, par cohérence avec l'expérience user actuelle. Les RPCs ne sont pas neutralisées comme `place_influence_action`. Elles continueront à écrire dans `territory_proposals` / `territory_votes` jusqu'au chantier **Campement** (V0.7 phase 2+) qui remplacera le nommage par blob via une entité géolocalisée par user. À ce moment-là : neutraliser les RPCs, retirer le UI, supprimer les données.

Le commentaire d'en-tête de `015_v07_veille.sql` listera ces DEPRECATES sous une section `-- DEPRECATES (cleanup ultérieur via Graphify)` pour que `scripts/graphify-sql.py` les indexe et qu'un script futur puisse les énumérer en parsant le graphe.
