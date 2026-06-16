# Marque GPS (brouillon de lieu) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un joueur de poser en un tap une « marque GPS » privée (jeton de présence horodaté) puis de la transformer plus tard en fiche de lieu complète, en récupérant rétroactivement le bonus de visite GPS.

**Architecture:** Une table `place_drafts` (owner-only via RLS) stocke la position GPS + horodatage + photos/titre optionnels, sans rien créditer. Deux RPC : `create_gps_mark` (pose) et `publish_gps_mark` (complétion → délègue à `_create_place_internal` en injectant la position de la marque comme « GPS live », ou fusionne sur un lieu existant). Le front ajoute une entrée au `CreateMenu`, une mini-modale de pose, une couche de marqueurs perso sur la carte, un badge HUD, et un mode « publication » dans `AddPlaceFlow`.

**Tech Stack:** PostgreSQL (Supabase, migrations numérotées), PL/pgSQL `SECURITY DEFINER`, React 18 + TypeScript strict, Zustand, MapLibre GL (`@vis.gl/react-maplibre`), Vitest (Node env, helpers purs).

**Spec de référence :** `apps/explore-web/docs/superpowers/specs/2026-06-16-marque-gps-brouillon-design.md`

---

## Principes de mise en œuvre

- **Discipline B1 (SQL)** : pour modifier une fonction existante, copier sa définition **verbatim du live** puis appliquer le delta ciblé. Ici on ne modifie aucune fonction existante — on en ajoute. Mais `publish_gps_mark` **appelle** `_create_place_internal` (mig 200) ; ne pas le réécrire, juste l'invoquer via `SELECT … INTO`.
- **Anti-pattern à respecter** : pas de `PERFORM` d'une RPC **publique** dans une RPC (`feedback_no_coupling_via_perform_rpcs`). Appeler `_create_place_internal` (helper interne) est OK — c'est exactement ce que fait le wrapper public `create_place`.
- **Pas de `any`**, pas de `console.log` en prod, RPC = logique métier serveur.
- **Vérif SQL** : pas de framework de test SQL dans ce repo. Chaque migration est vérifiée en appliquant puis en lançant des requêtes d'assertion (via le SQL editor Supabase ou le MCP `execute_sql`). Appliquer d'abord sur une **branche Supabase** ou en local, jamais direct en prod.
- **Vérif TS** : TDD Vitest pour les helpers purs (`src/lib/*.test.ts`). Les composants React n'ont pas de setup de test (Node env, pas de jsdom) → vérification manuelle via `pnpm dev`.

## File Structure

**SQL (à créer) :**
- `supabase/migrations/264_place_drafts_table.sql` — table `place_drafts` + RLS + clés `app_settings`
- `supabase/migrations/265_create_gps_mark_rpc.sql` — RPC `create_gps_mark` + `delete_gps_mark`
- `supabase/migrations/266_publish_gps_mark_rpc.sql` — RPC `find_nearby_places` + `publish_gps_mark`

**Front — lib / types / store (à créer) :**
- `apps/explore-web/src/types/gpsMark.ts` — types TS
- `apps/explore-web/src/lib/gpsMarkFreshness.ts` (+ `.test.ts`) — helper pur fraîcheur/distance
- `apps/explore-web/src/lib/gpsMarksApi.ts` — wrappers RPC (create/list/delete/publish/nearby)
- `apps/explore-web/src/stores/gpsMarksStore.ts` — store Zustand (liste + CRUD optimiste)

**Front — composants (à créer) :**
- `apps/explore-web/src/components/places/modals/AddGpsMarkModal.tsx` (+ `.css`) — mini-modale de pose
- `apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx` (+ `.css`) — « Compléter / Supprimer »
- `apps/explore-web/src/components/map/markers/GpsMarkMarkers.tsx` — marqueurs perso sur la carte
- `apps/explore-web/src/components/map/badges/GpsMarksBadge.tsx` (+ CSS dans App.css) — badge HUD

**Front — composants (à modifier) :**
- `apps/explore-web/src/components/map/controls/CreateMenu.tsx` — 3ᵉ entrée
- `apps/explore-web/src/pages/MapPage.tsx` — montage modale pose, badge, action modal, branchement CreateMenu
- `apps/explore-web/src/components/map/core/ExploreMap.tsx` — rendu des marqueurs perso
- `apps/explore-web/src/stores/mapStore.ts` — champs `publishingDraft` + `openGpsMarkId`
- `apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx` — mode « publication de marque »

---

## Phase 1 — Fondations SQL

### Task 1 : Table `place_drafts` + RLS + réglages

**Files:**
- Create: `supabase/migrations/264_place_drafts_table.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 264_place_drafts_table.sql
-- WHY : feature "Marque GPS / brouillon de lieu". Jeton de présence privé posé
-- en un tap (GPS + horodatage), transformé plus tard en fiche de lieu avec bonus
-- visite GPS rétroactif. Aucune récompense à la pose (anti-farming par construction).
-- Spec : apps/explore-web/docs/superpowers/specs/2026-06-16-marque-gps-brouillon-design.md

BEGIN;

CREATE TABLE IF NOT EXISTS public.place_drafts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude           real NOT NULL,
  longitude          real NOT NULL,
  accuracy_m         numeric,
  title              text,
  images             jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'open',          -- 'open' | 'published'
  published_place_id text REFERENCES public.places(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  published_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_place_drafts_user_open
  ON public.place_drafts (user_id) WHERE status = 'open';

ALTER TABLE public.place_drafts ENABLE ROW LEVEL SECURITY;

-- Owner-only : un joueur ne voit / ne touche QUE ses propres marques.
CREATE POLICY "drafts_select_own" ON public.place_drafts
  FOR SELECT USING ((auth.uid())::text = user_id);
CREATE POLICY "drafts_insert_own" ON public.place_drafts
  FOR INSERT TO authenticated WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "drafts_update_own" ON public.place_drafts
  FOR UPDATE USING ((auth.uid())::text = user_id);
CREATE POLICY "drafts_delete_own" ON public.place_drafts
  FOR DELETE USING ((auth.uid())::text = user_id);

-- Réglages configurables (style app_settings existant : key text, value text).
INSERT INTO public.app_settings (key, value) VALUES
  ('place_draft_dedup_radius_m', '30'),   -- rayon "lieu déjà existant" (cf. 2 chapelles à 40 m)
  ('place_draft_freshness_days', '30')    -- fenêtre du privilège GPS rétroactif
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

- [ ] **Step 2 : Appliquer la migration** (branche Supabase ou local — PAS prod)

Via MCP : `apply_migration` avec le contenu ci-dessus. Ou `npx supabase db push` en local.

- [ ] **Step 3 : Vérifier le schéma et la RLS**

Run (SQL editor / `execute_sql`) :
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'place_drafts' ORDER BY ordinal_position;

SELECT polname, cmd FROM pg_policies WHERE tablename = 'place_drafts';

SELECT key, value FROM app_settings
WHERE key IN ('place_draft_dedup_radius_m','place_draft_freshness_days');
```
Expected : 11 colonnes ; 4 policies (`drafts_select_own`/insert/update/delete) ; 2 réglages (30 / 30).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/264_place_drafts_table.sql
git commit -m "feat(drafts): table place_drafts + RLS owner-only + reglages (mig 264)"
```

---

### Task 2 : RPC `create_gps_mark` + `delete_gps_mark`

**Files:**
- Create: `supabase/migrations/265_create_gps_mark_rpc.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 265_create_gps_mark_rpc.sql
-- WHY : pose et suppression d'une marque GPS. La pose ne crédite RIEN (jeton de
-- présence). created_at estampillé serveur = la preuve d'horodatage.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_gps_mark(
  p_user_id   text,
  p_lat       real,
  p_lng       real,
  p_accuracy  numeric DEFAULT NULL,
  p_title     text    DEFAULT NULL,
  p_images    jsonb   DEFAULT '[]'::jsonb
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_created timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN json_build_object('error', 'no_position');
  END IF;

  INSERT INTO public.place_drafts (user_id, latitude, longitude, accuracy_m, title, images)
  VALUES (p_user_id, p_lat, p_lng, p_accuracy, NULLIF(TRIM(COALESCE(p_title,'')), ''), COALESCE(p_images, '[]'::jsonb))
  RETURNING id, created_at INTO v_id, v_created;

  RETURN json_build_object('success', true, 'id', v_id, 'createdAt', v_created);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_gps_mark(
  p_user_id  text,
  p_draft_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  DELETE FROM public.place_drafts
  WHERE id = p_draft_id AND user_id = p_user_id AND status = 'open';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object('success', v_deleted > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_gps_mark(text, real, real, numeric, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_gps_mark(text, uuid)
  TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Appliquer la migration** (branche/local)

- [ ] **Step 3 : Vérifier** (en étant authentifié comme un user de test ; `auth.uid()` doit matcher `p_user_id`)

Run :
```sql
-- Remplacer <UID> par un users.id réel de la base de test.
SELECT public.create_gps_mark('<UID>', 43.7, 7.26, 12.0, 'lavoir test', '[]'::jsonb);
SELECT id, status, title, created_at FROM place_drafts WHERE user_id = '<UID>';
```
Expected : `success:true` + une ligne `status='open'`, `title='lavoir test'`, `created_at` ~ maintenant.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/265_create_gps_mark_rpc.sql
git commit -m "feat(drafts): RPC create_gps_mark + delete_gps_mark (mig 265)"
```

---

### Task 3 : RPC `find_nearby_places` + `publish_gps_mark`

**Files:**
- Create: `supabase/migrations/266_publish_gps_mark_rpc.sql`

**Contexte clé (vérifié dans le code) :**
- `_create_place_internal(p_user_id, p_title, p_latitude real, p_longitude real, p_tag_id, p_images jsonb, p_address, p_text, p_user_lat real, p_user_lng real, p_carnet_title, p_era_id, p_year_exact integer)` (mig 200) calcule `isGps` à partir de `p_user_lat/lng` vs coords du lieu (rayon `app_settings.distance_gps_km`, défaut 0.5). Si GPS → auto-plant étendard + visite + influence. **On injecte les coords de la marque comme `p_user_lat/lng`** ⇒ bonus GPS rétroactif.
- `place_veille.place_id` est PK ⇒ « lieu sans veilleur » = `NOT EXISTS (SELECT 1 FROM place_veille WHERE place_id = …)`.
- `haversine_km(lat1, lng1, lat2, lng2)` existe (utilisé par `plant_flag`).
- Gate publication : 3 découvertes (mig 061). À répliquer ici via `count(places_discovered)`.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 266_publish_gps_mark_rpc.sql
-- WHY : transforme une marque GPS en lieu (ou fusionne sur un lieu existant),
-- avec bonus visite GPS RÉTROACTIF dérivé de la marque. Anti-triche : la marque
-- doit appartenir au caller, le lieu final doit être < 200 m de la marque, et le
-- privilège GPS n'est accordé que si la marque a moins de N jours (fraîcheur).
-- Délègue la création à _create_place_internal (mig 200) en injectant la position
-- de la marque comme "GPS live".

BEGIN;

-- Helper : lieux existants proches d'un point (pour détecter une collision à la
-- publication). distance en mètres ; has_veilleur pour savoir si l'étendard est libre.
CREATE OR REPLACE FUNCTION public.find_nearby_places(
  p_lat      real,
  p_lng      real,
  p_radius_m numeric DEFAULT 30
) RETURNS TABLE (place_id text, title text, distance_m numeric, has_veilleur boolean)
LANGUAGE sql STABLE
AS $$
  SELECT p.id,
         p.title,
         ROUND((haversine_km(p_lat::numeric, p_lng::numeric, p.latitude::numeric, p.longitude::numeric) * 1000)::numeric, 1) AS distance_m,
         EXISTS (SELECT 1 FROM public.place_veille pv WHERE pv.place_id = p.id) AS has_veilleur
  FROM public.places p
  WHERE p.private = false
    AND haversine_km(p_lat::numeric, p_lng::numeric, p.latitude::numeric, p.longitude::numeric) * 1000 <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_places(real, real, numeric)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.publish_gps_mark(
  p_user_id            text,
  p_draft_id           uuid,
  p_title              text,
  p_latitude           real,
  p_longitude          real,
  p_tag_id             text,
  p_images             jsonb   DEFAULT '[]'::jsonb,
  p_address            text    DEFAULT '',
  p_text               text    DEFAULT '',
  p_era_id             text    DEFAULT NULL,
  p_year_exact         integer DEFAULT NULL,
  p_secondary_tag_ids  text[]  DEFAULT '{}',
  p_merge_into_place_id text   DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_draft           public.place_drafts%ROWTYPE;
  v_fresh           boolean;
  v_freshness_days  int;
  v_dist_to_final   numeric;
  v_disc_count      int;
  v_min_disc        int := 3;
  v_user_lat        real;
  v_user_lng        real;
  v_result          json;
  v_place_id        text;
  v_tag             text;
  v_faction_id      text;
  v_exploration_gain int;
  v_target_lat      real;
  v_target_lng      real;
  v_target_dist     numeric;
  v_has_veilleur    boolean;
  v_auto_expedition_id uuid;
  v_solo_bonus      integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_draft FROM public.place_drafts
  WHERE id = p_draft_id AND user_id = p_user_id AND status = 'open';
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'draft_not_found');
  END IF;

  -- Fraîcheur : privilège GPS rétroactif uniquement si la marque est récente.
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'place_draft_freshness_days'), 30)
    INTO v_freshness_days;
  v_fresh := (now() - v_draft.created_at) <= make_interval(days => v_freshness_days);

  -- Anti-triche : le lieu final doit être à < 200 m de la position de la marque.
  v_dist_to_final := haversine_km(v_draft.latitude::numeric, v_draft.longitude::numeric,
                                  p_latitude::numeric, p_longitude::numeric) * 1000;
  IF v_dist_to_final > 200 THEN
    RETURN json_build_object('error', 'place_too_far_from_mark', 'distanceM', ROUND(v_dist_to_final, 0));
  END IF;

  -- GPS effectif injecté dans _create_place_internal : coords de la marque si
  -- fraîche (⇒ isGps + auto-plant + visite), NULL sinon (⇒ ajout à distance).
  IF v_fresh THEN
    v_user_lat := v_draft.latitude;
    v_user_lng := v_draft.longitude;
  ELSE
    v_user_lat := NULL;
    v_user_lng := NULL;
  END IF;

  -- =========================================================================
  -- CAS FUSION : l'utilisateur confirme que le lieu existe déjà (p_merge_into…).
  -- =========================================================================
  IF p_merge_into_place_id IS NOT NULL THEN
    SELECT latitude, longitude INTO v_target_lat, v_target_lng
    FROM public.places WHERE id = p_merge_into_place_id;
    IF v_target_lat IS NULL THEN
      RETURN json_build_object('error', 'merge_target_not_found');
    END IF;

    -- Le lieu cible doit lui aussi être < 200 m de la marque (légitimité visite).
    v_target_dist := haversine_km(v_draft.latitude::numeric, v_draft.longitude::numeric,
                                  v_target_lat::numeric, v_target_lng::numeric) * 1000;
    IF v_target_dist > 200 THEN
      RETURN json_build_object('error', 'merge_target_too_far', 'distanceM', ROUND(v_target_dist, 0));
    END IF;

    -- Découverte (idempotent) — l'utilisateur connaît désormais ce lieu.
    INSERT INTO public.places_discovered (user_id, place_id, method)
    VALUES (p_user_id, p_merge_into_place_id, CASE WHEN v_fresh THEN 'gps' ELSE 'remote' END)
    ON CONFLICT (user_id, place_id) DO NOTHING;

    IF v_fresh THEN
      SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
      SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'exploration_visit_gps'), 10)
        INTO v_exploration_gain;

      -- Visite GPS rétroactive (planter = visiter ; ici on enregistre la visite).
      IF NOT EXISTS (SELECT 1 FROM public.place_explorers WHERE place_id = p_merge_into_place_id AND user_id = p_user_id) THEN
        INSERT INTO public.place_explorers (place_id, user_id) VALUES (p_merge_into_place_id, p_user_id)
        ON CONFLICT DO NOTHING;
        UPDATE public.users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;
        INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
        VALUES ('visit_gps', p_user_id, p_merge_into_place_id, v_faction_id,
          jsonb_build_object('explorationGain', v_exploration_gain, 'fromDraft', true));
      END IF;

      -- Étendard rétroactif si le lieu est SANS veilleur et le user a une faction
      -- (mirroir du bloc auto-plant de _create_place_internal, mig 200).
      v_has_veilleur := EXISTS (SELECT 1 FROM public.place_veille WHERE place_id = p_merge_into_place_id);
      IF NOT v_has_veilleur AND v_faction_id IS NOT NULL THEN
        v_solo_bonus := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'), 50);

        INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
        VALUES (p_merge_into_place_id, false, v_faction_id, NULL, now())
        RETURNING id INTO v_auto_expedition_id;

        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_auto_expedition_id, p_user_id, v_faction_id);

        INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
        VALUES (p_merge_into_place_id, v_auto_expedition_id, v_faction_id, false, now(), false, NULL, p_user_id)
        ON CONFLICT (place_id) DO NOTHING;

        INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
        VALUES (p_merge_into_place_id, p_user_id, v_auto_expedition_id, p_user_id, 'plant_bonus', v_solo_bonus);

        INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
        VALUES (p_merge_into_place_id, v_auto_expedition_id, p_user_id, v_faction_id, false, now());

        INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
        VALUES ('plant_flag', p_user_id, p_merge_into_place_id, v_faction_id,
          jsonb_build_object('isNeutral', false, 'expeditionId', v_auto_expedition_id, 'memberCount', 1, 'fromDraft', true, 'plantBonus', v_solo_bonus));
      END IF;
    END IF;

    UPDATE public.place_drafts
    SET status = 'published', published_place_id = p_merge_into_place_id, published_at = now()
    WHERE id = p_draft_id;

    RETURN json_build_object('success', true, 'mode', 'merged',
      'placeId', p_merge_into_place_id, 'isGps', v_fresh);
  END IF;

  -- =========================================================================
  -- CAS CRÉATION : nouveau lieu.
  -- =========================================================================
  -- Gate publication = 3 découvertes (réplique mig 061 ; le front gate déjà l'UI).
  SELECT count(*) INTO v_disc_count FROM public.places_discovered WHERE user_id = p_user_id;
  IF v_disc_count < v_min_disc THEN
    RETURN json_build_object('error', 'not_enough_discoveries',
      'requiredDiscoveries', v_min_disc, 'currentDiscoveries', v_disc_count);
  END IF;

  SELECT public._create_place_internal(
    p_user_id, p_title, p_latitude, p_longitude, p_tag_id,
    COALESCE(p_images, '[]'::jsonb), p_address, p_text,
    v_user_lat, v_user_lng, NULL, p_era_id, p_year_exact
  ) INTO v_result;

  IF (v_result->>'error') IS NOT NULL THEN
    RETURN v_result;  -- propage l'erreur (tag introuvable, etc.)
  END IF;

  v_place_id := v_result->>'placeId';

  -- Tags secondaires (le 1er est posé par _create_place_internal).
  IF array_length(p_secondary_tag_ids, 1) > 0 THEN
    FOREACH v_tag IN ARRAY p_secondary_tag_ids LOOP
      INSERT INTO public.place_tags (place_id, tag_id, is_primary)
      VALUES (v_place_id, v_tag, false) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.place_drafts
  SET status = 'published', published_place_id = v_place_id, published_at = now()
  WHERE id = p_draft_id;

  -- v_result contient déjà {success, placeId, isGps, rewards, …}. On ajoute mode.
  RETURN (v_result::jsonb || jsonb_build_object('mode', 'created'))::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_gps_mark(text, uuid, text, real, real, text, jsonb, text, text, text, integer, text[], text)
  TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Appliquer la migration** (branche/local)

- [ ] **Step 3 : Vérifier les 3 scénarios clés**

Run (avec `<UID>` authentifié + un `tags.id` valide, ex. `'mega'` ; créer une marque récente d'abord) :
```sql
-- A. Création fraîche (< 30 j) ⇒ isGps:true + auto-plant. La marque doit être au
--    même point que le lieu créé (< 200 m).
SELECT public.create_gps_mark('<UID>', 43.700, 7.260, 10, 'test create', '[]'::jsonb);  -- récupérer l'id
SELECT public.publish_gps_mark('<UID>', '<DRAFT_ID>', 'Lavoir test', 43.7001, 7.2601, 'mega',
  '[]'::jsonb, '', 'Une description.', 'unknown', NULL, '{}', NULL);
-- Expected : success, mode:'created', isGps:true, rewards.isExplorer:true.
SELECT status, published_place_id FROM place_drafts WHERE id = '<DRAFT_ID>';  -- 'published'
SELECT 1 FROM place_veille WHERE place_id = '<PLACE_ID>';  -- 1 ligne (étendard planté)

-- B. Anti-triche : lieu final à > 200 m de la marque ⇒ refus.
SELECT public.create_gps_mark('<UID>', 43.700, 7.260, 10, 'test loin', '[]'::jsonb);
SELECT public.publish_gps_mark('<UID>', '<DRAFT_ID_2>', 'Loin', 44.0, 7.5, 'mega',
  '[]'::jsonb, '', 'x', 'unknown', NULL, '{}', NULL);
-- Expected : error:'place_too_far_from_mark'.

-- C. Marque périmée : forcer created_at à -40 j puis publier ⇒ isGps:false.
UPDATE place_drafts SET created_at = now() - interval '40 days' WHERE id = '<DRAFT_ID_3>';
SELECT public.publish_gps_mark('<UID>', '<DRAFT_ID_3>', 'Vieux', <lat≈marque>, <lng≈marque>, 'mega',
  '[]'::jsonb, '', 'x', 'unknown', NULL, '{}', NULL);
-- Expected : success, mode:'created', isGps:false (pas de place_veille créé).
```

- [ ] **Step 4 : Vérifier les advisors sécurité**

Via MCP `get_advisors` (type `security`) : aucune nouvelle alerte critique sur `place_drafts` / les nouvelles fonctions (RLS active, `SECURITY DEFINER` avec check `auth.uid()`).

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/266_publish_gps_mark_rpc.sql
git commit -m "feat(drafts): RPC find_nearby_places + publish_gps_mark (mig 266)"
```

---

## Phase 2 — Front : types, helper, API, store

### Task 4 : Types + helper de fraîcheur (TDD)

**Files:**
- Create: `apps/explore-web/src/types/gpsMark.ts`
- Create: `apps/explore-web/src/lib/gpsMarkFreshness.ts`
- Test: `apps/explore-web/src/lib/gpsMarkFreshness.test.ts`

- [ ] **Step 1 : Écrire les types**

```typescript
// apps/explore-web/src/types/gpsMark.ts
/** Photo d'une marque, déjà uploadée (mêmes champs que places.images). */
export interface GpsMarkImage {
  id: string
  url: string
  thumb: string
}

/** Marque GPS (brouillon de lieu) telle que lue depuis place_drafts. */
export interface GpsMark {
  id: string
  latitude: number
  longitude: number
  accuracyM: number | null
  title: string | null
  images: GpsMarkImage[]
  createdAt: string // ISO
  status: 'open' | 'published'
}

/** Lieu existant proche, candidat à la fusion (RPC find_nearby_places). */
export interface NearbyPlace {
  placeId: string
  title: string
  distanceM: number
  hasVeilleur: boolean
}
```

- [ ] **Step 2 : Écrire le test (échoue d'abord)**

```typescript
// apps/explore-web/src/lib/gpsMarkFreshness.test.ts
import { describe, it, expect } from 'vitest'
import { isGpsMarkFresh, gpsMarkAgeDays } from './gpsMarkFreshness'

const now = new Date('2026-06-16T12:00:00Z').getTime()

describe('gpsMarkAgeDays', () => {
  it('0 jour pour une marque posée à l\'instant', () => {
    expect(gpsMarkAgeDays('2026-06-16T12:00:00Z', now)).toBe(0)
  })
  it('arrondi bas : 9 jours et demi → 9', () => {
    expect(gpsMarkAgeDays('2026-06-07T00:00:00Z', now)).toBe(9)
  })
})

describe('isGpsMarkFresh', () => {
  it('fraîche à 29 jours (seuil 30)', () => {
    expect(isGpsMarkFresh('2026-05-18T12:00:00Z', now, 30)).toBe(true)
  })
  it('périmée à 31 jours (seuil 30)', () => {
    expect(isGpsMarkFresh('2026-05-16T11:00:00Z', now, 30)).toBe(false)
  })
  it('seuil par défaut = 30 jours', () => {
    expect(isGpsMarkFresh('2026-04-01T12:00:00Z', now)).toBe(false)
  })
})
```

- [ ] **Step 3 : Lancer le test → échoue**

Run: `cd apps/explore-web && pnpm test -- gpsMarkFreshness`
Expected: FAIL (`isGpsMarkFresh is not a function`).

- [ ] **Step 4 : Implémenter le helper**

```typescript
// apps/explore-web/src/lib/gpsMarkFreshness.ts
/** Âge d'une marque en jours pleins (arrondi bas). */
export function gpsMarkAgeDays(createdAt: string, nowMs: number = Date.now()): number {
  const ms = nowMs - new Date(createdAt).getTime()
  return Math.floor(ms / 86_400_000)
}

/** La marque ouvre-t-elle encore droit au bonus GPS rétroactif ?
 *  Vrai tant que l'âge ≤ freshnessDays (défaut 30, cf. app_settings). */
export function isGpsMarkFresh(createdAt: string, nowMs: number = Date.now(), freshnessDays = 30): boolean {
  return gpsMarkAgeDays(createdAt, nowMs) <= freshnessDays
}
```

- [ ] **Step 5 : Lancer le test → passe**

Run: `cd apps/explore-web && pnpm test -- gpsMarkFreshness`
Expected: PASS (5 tests).

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/types/gpsMark.ts apps/explore-web/src/lib/gpsMarkFreshness.ts apps/explore-web/src/lib/gpsMarkFreshness.test.ts
git commit -m "feat(drafts): types GpsMark + helper de fraicheur (TDD)"
```

---

### Task 5 : Wrapper API RPC

**Files:**
- Create: `apps/explore-web/src/lib/gpsMarksApi.ts`

- [ ] **Step 1 : Implémenter les wrappers**

```typescript
// apps/explore-web/src/lib/gpsMarksApi.ts
import { supabase } from './supabase'
import type { GpsMark, GpsMarkImage, NearbyPlace } from '../types/gpsMark'

interface DraftRow {
  id: string
  latitude: number
  longitude: number
  accuracy_m: number | null
  title: string | null
  images: GpsMarkImage[] | null
  created_at: string
  status: 'open' | 'published'
}

function rowToMark(r: DraftRow): GpsMark {
  return {
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracyM: r.accuracy_m,
    title: r.title,
    images: r.images ?? [],
    createdAt: r.created_at,
    status: r.status,
  }
}

/** Liste les marques ouvertes du joueur courant (RLS owner-only). */
export async function fetchMyGpsMarks(): Promise<GpsMark[]> {
  const { data, error } = await supabase
    .from('place_drafts')
    .select('id, latitude, longitude, accuracy_m, title, images, created_at, status')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[gpsMarksApi] fetch failed', error)
    return []
  }
  return (data as DraftRow[]).map(rowToMark)
}

export async function createGpsMark(args: {
  userId: string; lat: number; lng: number; accuracy: number | null
  title: string | null; images: GpsMarkImage[]
}): Promise<{ id: string; createdAt: string } | { error: string }> {
  const { data, error } = await supabase.rpc('create_gps_mark', {
    p_user_id: args.userId, p_lat: args.lat, p_lng: args.lng,
    p_accuracy: args.accuracy, p_title: args.title, p_images: args.images,
  })
  if (error) return { error: error.message }
  if ((data as { error?: string })?.error) return { error: (data as { error: string }).error }
  return { id: (data as { id: string }).id, createdAt: (data as { createdAt: string }).createdAt }
}

export async function deleteGpsMark(userId: string, draftId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_gps_mark', { p_user_id: userId, p_draft_id: draftId })
  if (error) { console.warn('[gpsMarksApi] delete failed', error); return false }
  return !!(data as { success?: boolean })?.success
}

export async function findNearbyPlaces(lat: number, lng: number, radiusM: number): Promise<NearbyPlace[]> {
  const { data, error } = await supabase.rpc('find_nearby_places', { p_lat: lat, p_lng: lng, p_radius_m: radiusM })
  if (error) { console.warn('[gpsMarksApi] nearby failed', error); return [] }
  return (data as { place_id: string; title: string; distance_m: number; has_veilleur: boolean }[])
    .map(r => ({ placeId: r.place_id, title: r.title, distanceM: r.distance_m, hasVeilleur: r.has_veilleur }))
}

export interface PublishMarkArgs {
  userId: string; draftId: string; title: string; latitude: number; longitude: number
  tagId: string; images: GpsMarkImage[]; address: string; text: string
  eraId: string | null; yearExact: number | null; secondaryTagIds: string[]
  mergeIntoPlaceId: string | null
}

export interface PublishMarkResult {
  success?: boolean; error?: string; mode?: 'created' | 'merged'
  placeId?: string; isGps?: boolean; requiredDiscoveries?: number; currentDiscoveries?: number
}

export async function publishGpsMark(args: PublishMarkArgs): Promise<PublishMarkResult> {
  const { data, error } = await supabase.rpc('publish_gps_mark', {
    p_user_id: args.userId, p_draft_id: args.draftId, p_title: args.title,
    p_latitude: args.latitude, p_longitude: args.longitude, p_tag_id: args.tagId,
    p_images: args.images, p_address: args.address, p_text: args.text,
    p_era_id: args.eraId, p_year_exact: args.yearExact,
    p_secondary_tag_ids: args.secondaryTagIds, p_merge_into_place_id: args.mergeIntoPlaceId,
  })
  if (error) return { error: error.message }
  return data as PublishMarkResult
}
```

- [ ] **Step 2 : Vérifier la compilation TS**

Run: `cd apps/explore-web && pnpm build`
Expected: pas d'erreur TS (le `build` lance `tsc`). Si la base de types `database.types.ts` ne connaît pas encore les nouvelles RPC, les appels `supabase.rpc('create_gps_mark', …)` peuvent être typés `never` → caster l'argument via `supabase.rpc('create_gps_mark' as never, … as never)` n'est PAS souhaitable ; à la place, régénérer les types (Step 3).

- [ ] **Step 3 : Régénérer les types Supabase**

Via MCP `generate_typescript_types` → écraser `apps/explore-web/src/types/database.types.ts`. Relancer `pnpm build`.
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/lib/gpsMarksApi.ts apps/explore-web/src/types/database.types.ts
git commit -m "feat(drafts): wrappers RPC gpsMarksApi + regen types"
```

---

### Task 6 : Store Zustand `gpsMarksStore`

**Files:**
- Create: `apps/explore-web/src/stores/gpsMarksStore.ts`

- [ ] **Step 1 : Implémenter le store**

```typescript
// apps/explore-web/src/stores/gpsMarksStore.ts
import { create } from 'zustand'
import type { GpsMark } from '../types/gpsMark'
import { fetchMyGpsMarks } from '../lib/gpsMarksApi'

interface GpsMarksState {
  marks: GpsMark[]
  loaded: boolean
  refresh: () => Promise<void>
  addLocal: (mark: GpsMark) => void
  removeLocal: (id: string) => void
}

export const useGpsMarksStore = create<GpsMarksState>((set) => ({
  marks: [],
  loaded: false,
  refresh: async () => {
    const marks = await fetchMyGpsMarks()
    set({ marks, loaded: true })
  },
  addLocal: (mark) => set((s) => ({ marks: [mark, ...s.marks] })),
  removeLocal: (id) => set((s) => ({ marks: s.marks.filter((m) => m.id !== id) })),
}))
```

- [ ] **Step 2 : Charger les marques au mount de la carte**

Modify: `apps/explore-web/src/pages/MapPage.tsx` — après les autres hooks de chargement (vers la ligne 151, après `useResourceTimers()`), ajouter :

```typescript
// Marques GPS (brouillons) du joueur — chargées une fois pour le rendu carte + badge.
useEffect(() => {
  if (isAuthenticated && userId) void useGpsMarksStore.getState().refresh()
}, [isAuthenticated, userId])
```

Et l'import en tête : `import { useGpsMarksStore } from '../stores/gpsMarksStore'`

- [ ] **Step 3 : Vérifier la compilation**

Run: `cd apps/explore-web && pnpm build`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/stores/gpsMarksStore.ts apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(drafts): gpsMarksStore + chargement au mount carte"
```

---

## Phase 3 — Pose d'une marque

### Task 7 : Entrée « Ajouter une marque GPS » dans le CreateMenu

**Files:**
- Modify: `apps/explore-web/src/components/map/controls/CreateMenu.tsx`
- Modify: `apps/explore-web/src/pages/MapPage.tsx:456-474`

- [ ] **Step 1 : Ajouter la prop + l'entrée dans CreateMenu**

Modify `CreateMenu.tsx` — ajouter `onAddGpsMark: () => void` à l'interface `Props` et au destructuring, puis insérer une 3ᵉ option après l'événement (après la ligne 65) :

```tsx
        <button
          className="create-menu-option"
          onClick={onAddGpsMark}
        >
          <span className="create-menu-icon">📍</span>
          <div className="create-menu-text">
            <div className="create-menu-title">Ajouter une marque GPS</div>
            <div className="create-menu-help">Prouve que tu es passé ici — finis la fiche plus tard</div>
          </div>
        </button>
```

- [ ] **Step 2 : Brancher dans MapPage**

Modify `MapPage.tsx` — ajouter un state `const [showAddGpsMark, setShowAddGpsMark] = useState(false)` (vers la ligne 111), puis passer la prop au `<CreateMenu>` (bloc lignes 456-474) :

```tsx
          onAddGpsMark={() => {
            setShowCreateMenu(false)
            setShowAddGpsMark(true)
          }}
```

- [ ] **Step 3 : Vérifier** (manuel, `pnpm dev`)

Ouvrir le `+` → 3 entrées visibles, la 3ᵉ « Ajouter une marque GPS ». Le clic ferme le menu (la modale arrive Task 8).

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/components/map/controls/CreateMenu.tsx apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(drafts): entree 'Ajouter une marque GPS' dans le CreateMenu"
```

---

### Task 8 : Mini-modale de pose `AddGpsMarkModal`

**Files:**
- Create: `apps/explore-web/src/components/places/modals/AddGpsMarkModal.tsx`
- Create: `apps/explore-web/src/components/places/modals/AddGpsMarkModal.css`
- Modify: `apps/explore-web/src/pages/MapPage.tsx`

**Patterns réutilisés (déjà dans le codebase) :** `getFreshPosition()` et `compressImage()` (cf. `AddPlaceFlow.tsx` lignes 44-53 et import `../../../lib/imageUtils`). Upload Storage bucket `place-images`, chemin `places/${userId}/drafts/${imageId}.webp`.

- [ ] **Step 1 : Implémenter la modale**

```tsx
// apps/explore-web/src/components/places/modals/AddGpsMarkModal.tsx
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { compressImage } from '../../../lib/imageUtils'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { createGpsMark } from '../../../lib/gpsMarksApi'
import type { GpsMarkImage } from '../../../types/gpsMark'
import './AddGpsMarkModal.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function getFreshPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

export function AddGpsMarkModal({ onClose }: { onClose: () => void }) {
  const userId = usePlayerStore(s => s.userId)
  const [title, setTitle] = useState('')
  const [previews, setPreviews] = useState<{ full: File; thumb: File; preview: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE)
    if (!valid.length) return
    setBusy(true); setError(null)
    const prepared: { full: File; thumb: File; preview: string }[] = []
    for (const file of valid) {
      try {
        const [full, thumb] = await Promise.all([compressImage(file), compressImage(file, 400)])
        prepared.push({ full, thumb, preview: URL.createObjectURL(full) })
      } catch { /* photo illisible ignorée */ }
    }
    setPreviews(prev => [...prev, ...prepared])
    setBusy(false)
  }

  async function handleSubmit() {
    if (!userId) return
    setBusy(true); setError(null)
    const pos = await getFreshPosition()
    if (!pos) {
      setError('Position GPS indisponible. Active ta localisation pour poser une marque.')
      setBusy(false); return
    }
    try {
      const images: GpsMarkImage[] = []
      for (const p of previews) {
        const imageId = crypto.randomUUID()
        const fullPath = `places/${userId}/drafts/${imageId}.webp`
        const thumbPath = `places/${userId}/drafts/${imageId}_thumb.webp`
        const [fullUp, thumbUp] = await Promise.all([
          supabase.storage.from('place-images').upload(fullPath, p.full, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from('place-images').upload(thumbPath, p.thumb, { contentType: 'image/webp', upsert: false }),
        ])
        if (fullUp.error) { setError(`Upload: ${fullUp.error.message}`); setBusy(false); return }
        const full = supabase.storage.from('place-images').getPublicUrl(fullPath).data.publicUrl
        const thumb = thumbUp.error ? full : supabase.storage.from('place-images').getPublicUrl(thumbPath).data.publicUrl
        images.push({ id: imageId, url: full, thumb })
      }
      const res = await createGpsMark({
        userId, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy,
        title: title.trim() || null, images,
      })
      if ('error' in res) { setError(res.error); setBusy(false); return }
      useGpsMarksStore.getState().addLocal({
        id: res.id, latitude: pos.lat, longitude: pos.lng, accuracyM: pos.accuracy,
        title: title.trim() || null, images, createdAt: res.createdAt, status: 'open',
      })
      useToastStore.getState().addToast({
        type: 'new_place',
        message: '📍 Marque posée. Reviens finir la fiche quand tu veux pour gagner ta visite GPS.',
        timestamp: Date.now(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setBusy(false)
    }
  }

  return createPortal(
    <div className="gps-mark-overlay" onClick={onClose}>
      <div className="gps-mark-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="gps-mark-title">📍 Marque GPS</h2>
        <p className="gps-mark-help">
          On enregistre ta position actuelle comme preuve de passage. Tu pourras transformer
          cette marque en lieu plus tard — et toucher ton bonus de visite GPS à ce moment-là.
        </p>
        {error && <div className="gps-mark-error">{error}</div>}

        <label className="gps-mark-label">Titre rapide <span className="gps-mark-optional">(optionnel)</span></label>
        <input className="gps-mark-input" type="text" value={title}
          onChange={e => setTitle(e.target.value)} placeholder="Ex : lavoir médiéval sur la colline" maxLength={120} />

        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoChange} />
        {previews.length > 0 && (
          <div className="gps-mark-photos">
            {previews.map((p, i) => <img key={p.preview} src={p.preview} alt={`Photo ${i + 1}`} />)}
          </div>
        )}
        <button className="gps-mark-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          📷 Ajouter une photo (optionnel)
        </button>

        <div className="gps-mark-actions">
          <button className="gps-mark-cancel" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="gps-mark-submit" onClick={handleSubmit} disabled={busy}>
            {busy ? '…' : '📍 Poser la marque'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2 : Écrire le CSS** (s'aligner sur le style parchemin — variables `--color-parchment`, `--color-sepia`, `--color-ink`)

```css
/* apps/explore-web/src/components/places/modals/AddGpsMarkModal.css */
.gps-mark-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 6000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.gps-mark-modal { background: var(--color-parchment); border: 1px solid var(--color-sepia); border-radius: 14px; padding: 20px; width: min(440px, 100%); max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 28px rgba(74,55,40,.3); }
.gps-mark-title { font-family: var(--font-title); margin: 0 0 8px; color: var(--color-ink); }
.gps-mark-help { font-size: 14px; color: var(--color-ink); opacity: .8; margin: 0 0 14px; }
.gps-mark-error { background: #f8d7da; color: #842029; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
.gps-mark-label { display: block; font-family: var(--font-title); font-size: 14px; margin: 10px 0 4px; color: var(--color-ink); }
.gps-mark-optional { font-weight: 400; opacity: .6; }
.gps-mark-input { width: 100%; padding: 10px; border: 1px solid var(--color-sepia); border-radius: 8px; background: #fff; font-size: 15px; box-sizing: border-box; }
.gps-mark-photos { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.gps-mark-photos img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; }
.gps-mark-photo-btn { width: 100%; margin-top: 10px; padding: 10px; border: 1px dashed var(--color-sepia); border-radius: 8px; background: transparent; cursor: pointer; }
.gps-mark-actions { display: flex; gap: 10px; margin-top: 18px; }
.gps-mark-cancel, .gps-mark-submit { flex: 1; padding: 12px; border-radius: 10px; font-family: var(--font-title); cursor: pointer; border: 1px solid var(--color-sepia); }
.gps-mark-cancel { background: transparent; color: var(--color-ink); }
.gps-mark-submit { background: var(--color-ink); color: var(--color-parchment); border-color: var(--color-ink); }
.gps-mark-submit:disabled, .gps-mark-cancel:disabled { opacity: .5; cursor: default; }
```

- [ ] **Step 3 : Monter la modale dans MapPage**

Modify `MapPage.tsx` — import `import { AddGpsMarkModal } from '../components/places/modals/AddGpsMarkModal'`, puis près des autres modales (ex. après le bloc `showAddPlaceInfo`, vers la ligne 488) :

```tsx
      {showAddGpsMark && <AddGpsMarkModal onClose={() => setShowAddGpsMark(false)} />}
```

- [ ] **Step 4 : Vérifier** (manuel, `pnpm dev`, sur un appareil/onglet avec géoloc autorisée)

`+` → « Ajouter une marque GPS » → modale → (option titre/photo) → « Poser la marque ». Toast de confirmation. Vérifier en DB : `SELECT * FROM place_drafts WHERE user_id = '<UID>' ORDER BY created_at DESC LIMIT 1;` → ligne `status='open'` aux bonnes coords.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/AddGpsMarkModal.tsx apps/explore-web/src/components/places/modals/AddGpsMarkModal.css apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(drafts): mini-modale de pose AddGpsMarkModal (one-tap GPS + photo/titre)"
```

---

## Phase 4 — Marques sur la carte + badge HUD

### Task 9 : Marqueurs perso sur la carte

**Files:**
- Create: `apps/explore-web/src/components/map/markers/GpsMarkMarkers.tsx`
- Modify: `apps/explore-web/src/components/map/core/ExploreMap.tsx`
- Modify: `apps/explore-web/src/stores/mapStore.ts`

**Pattern réutilisé :** rendu HTML via `<Marker>` de `@vis.gl/react-maplibre` (cf. `components/map/markers/VeilleurNamePills.tsx`). On veut l'interaction DOM (clic → action modal), donc `<Marker>` plutôt qu'une couche GeoJSON.

- [ ] **Step 1 : Ajouter le champ d'ouverture d'action dans mapStore**

Modify `mapStore.ts` — dans l'interface `MapState` et le `create(...)` :

```typescript
  /** Marque GPS dont l'action "Compléter / Supprimer" est ouverte (null = fermée). */
  openGpsMarkId: string | null
  setOpenGpsMarkId: (id: string | null) => void
```
```typescript
  openGpsMarkId: null,
  setOpenGpsMarkId: (id) => set({ openGpsMarkId: id }),
```

- [ ] **Step 2 : Implémenter le composant de marqueurs**

```tsx
// apps/explore-web/src/components/map/markers/GpsMarkMarkers.tsx
import { memo } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { useMapStore } from '../../../stores/mapStore'
import './GpsMarkMarkers.css'

export const GpsMarkMarkers = memo(function GpsMarkMarkers() {
  const marks = useGpsMarksStore(s => s.marks)
  const setOpenGpsMarkId = useMapStore(s => s.setOpenGpsMarkId)

  return (
    <>
      {marks.map((m) => (
        <Marker key={m.id} longitude={m.longitude} latitude={m.latitude} anchor="bottom">
          <button
            className="gps-mark-pin"
            title={m.title ?? 'Marque GPS à compléter'}
            onClick={(e) => { e.stopPropagation(); setOpenGpsMarkId(m.id) }}
          >📍</button>
        </Marker>
      ))}
    </>
  )
})
```

Et `GpsMarkMarkers.css` :
```css
.gps-mark-pin { background: transparent; border: none; font-size: 26px; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); animation: gps-mark-bob 2s ease-in-out infinite; }
@keyframes gps-mark-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
```

- [ ] **Step 3 : Monter dans ExploreMap**

Modify `ExploreMap.tsx` — import `import { GpsMarkMarkers } from '../markers/GpsMarkMarkers'` puis, à l'intérieur du composant `<Map>` (à côté de `<Source id="places">` / des autres `<Marker>` comme `VeilleurNamePills`), ajouter `<GpsMarkMarkers />`.

- [ ] **Step 4 : Vérifier** (manuel)

Après avoir posé une marque (Task 8), un pin 📍 animé apparaît à l'emplacement. Le clic ne sélectionne pas un lieu (stopPropagation) — il posera `openGpsMarkId` (action modal en Task 10).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/markers/GpsMarkMarkers.tsx apps/explore-web/src/components/map/markers/GpsMarkMarkers.css apps/explore-web/src/components/map/core/ExploreMap.tsx apps/explore-web/src/stores/mapStore.ts
git commit -m "feat(drafts): marqueurs perso des marques GPS sur la carte"
```

---

### Task 10 : Action « Compléter / Supprimer »

**Files:**
- Create: `apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx`
- Create: `apps/explore-web/src/components/places/modals/GpsMarkActionModal.css`
- Modify: `apps/explore-web/src/pages/MapPage.tsx`
- Modify: `apps/explore-web/src/stores/mapStore.ts`

- [ ] **Step 1 : Ajouter le champ `publishingDraft` dans mapStore**

Modify `mapStore.ts` (interface + create), import du type en tête (`import type { GpsMark } from '../types/gpsMark'`) :

```typescript
  /** Marque en cours de publication (pré-remplit AddPlaceFlow). null = aucune. */
  publishingDraft: GpsMark | null
  setPublishingDraft: (d: GpsMark | null) => void
```
```typescript
  publishingDraft: null,
  setPublishingDraft: (d) => set({ publishingDraft: d }),
```

- [ ] **Step 2 : Implémenter la modale d'action**

```tsx
// apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx
import { createPortal } from 'react-dom'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { deleteGpsMark } from '../../../lib/gpsMarksApi'
import { gpsMarkAgeDays, isGpsMarkFresh } from '../../../lib/gpsMarkFreshness'
import type { GpsMark } from '../../../types/gpsMark'
import './GpsMarkActionModal.css'

export function GpsMarkActionModal({ mark }: { mark: GpsMark }) {
  const setOpenGpsMarkId = useMapStore(s => s.setOpenGpsMarkId)
  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const setPublishingDraft = useMapStore(s => s.setPublishingDraft)
  const userId = usePlayerStore(s => s.userId)

  const ageDays = gpsMarkAgeDays(mark.createdAt)
  const fresh = isGpsMarkFresh(mark.createdAt)

  function close() { setOpenGpsMarkId(null) }

  function complete() {
    setPublishingDraft(mark)
    setAddPlaceMode(true) // ouvre AddPlaceFlow (Task 11 gère le pré-remplissage)
    close()
  }

  async function remove() {
    if (!userId) return
    const ok = await deleteGpsMark(userId, mark.id)
    if (ok) useGpsMarksStore.getState().removeLocal(mark.id)
    close()
  }

  return createPortal(
    <div className="gps-action-overlay" onClick={close}>
      <div className="gps-action-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="gps-action-title">{mark.title || 'Marque GPS'}</h3>
        <p className="gps-action-meta">
          Posée il y a {ageDays === 0 ? "aujourd'hui" : `${ageDays} j`}.
          {fresh
            ? ' Bonus visite GPS encore disponible.'
            : ' Bonus visite GPS expiré — publication possible en ajout à distance.'}
        </p>
        {mark.images.length > 0 && (
          <div className="gps-action-photos">
            {mark.images.map(img => <img key={img.id} src={img.thumb} alt="" />)}
          </div>
        )}
        <button className="gps-action-complete" onClick={complete}>✍️ Compléter la fiche</button>
        <button className="gps-action-delete" onClick={remove}>🗑️ Supprimer la marque</button>
        <button className="gps-action-cancel" onClick={close}>Fermer</button>
      </div>
    </div>,
    document.body,
  )
}
```

CSS `GpsMarkActionModal.css` (même famille parchemin que Task 8 — réutiliser les variables) :
```css
.gps-action-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 6000; display: flex; align-items: flex-end; justify-content: center; padding: 16px; }
.gps-action-modal { background: var(--color-parchment); border: 1px solid var(--color-sepia); border-radius: 14px; padding: 18px; width: min(440px, 100%); box-shadow: 0 8px 28px rgba(74,55,40,.3); }
.gps-action-title { font-family: var(--font-title); margin: 0 0 6px; color: var(--color-ink); }
.gps-action-meta { font-size: 13px; opacity: .8; margin: 0 0 12px; color: var(--color-ink); }
.gps-action-photos { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.gps-action-photos img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.gps-action-complete, .gps-action-delete, .gps-action-cancel { width: 100%; padding: 12px; border-radius: 10px; font-family: var(--font-title); cursor: pointer; margin-top: 8px; border: 1px solid var(--color-sepia); }
.gps-action-complete { background: var(--color-ink); color: var(--color-parchment); border-color: var(--color-ink); }
.gps-action-delete { background: transparent; color: #842029; }
.gps-action-cancel { background: transparent; color: var(--color-ink); }
```

- [ ] **Step 3 : Monter dans MapPage**

Modify `MapPage.tsx` — import du composant + du store ; sélectionner la marque ouverte et la rendre :

```tsx
import { GpsMarkActionModal } from '../components/places/modals/GpsMarkActionModal'
import { useGpsMarksStore } from '../stores/gpsMarksStore'
```
Dans le corps (avec les autres hooks de store) :
```tsx
const openGpsMarkId = useMapStore(s => s.openGpsMarkId)
const gpsMarks = useGpsMarksStore(s => s.marks)
const openGpsMark = gpsMarks.find(m => m.id === openGpsMarkId) ?? null
```
Dans le JSX (près des autres modales) :
```tsx
{openGpsMark && <GpsMarkActionModal mark={openGpsMark} />}
```

- [ ] **Step 4 : Vérifier** (manuel) — clic sur un pin 📍 → action sheet avec âge + fraîcheur, photos, et 3 boutons. « Supprimer » retire le pin. « Compléter » ouvre `AddPlaceFlow` (pré-remplissage Task 11).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx apps/explore-web/src/components/places/modals/GpsMarkActionModal.css apps/explore-web/src/pages/MapPage.tsx apps/explore-web/src/stores/mapStore.ts
git commit -m "feat(drafts): action Completer/Supprimer une marque GPS"
```

---

### Task 11 : Badge HUD « 📍 X marques à compléter »

**Files:**
- Create: `apps/explore-web/src/components/map/badges/GpsMarksBadge.tsx`
- Modify: `apps/explore-web/src/App.css` (classe `.gps-marks-badge`)
- Modify: `apps/explore-web/src/pages/MapPage.tsx` (montage dans la toolbar)

**Pattern réutilisé :** `CrownsBadge.tsx` (classe de base `.notoriety-badge`). `requestFlyTo` existe dans mapStore. Position du joueur via `usePlayerStore.userPosition`.

- [ ] **Step 1 : Implémenter le badge**

```tsx
// apps/explore-web/src/components/map/badges/GpsMarksBadge.tsx
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function GpsMarksBadge() {
  const marks = useGpsMarksStore(s => s.marks)
  const userPosition = usePlayerStore(s => s.userPosition)
  if (marks.length === 0) return null

  function flyToNearest() {
    if (marks.length === 0) return
    const target = userPosition
      ? [...marks].sort((a, b) =>
          haversineM(userPosition.lat, userPosition.lng, a.latitude, a.longitude) -
          haversineM(userPosition.lat, userPosition.lng, b.latitude, b.longitude))[0]
      : marks[0]
    useMapStore.getState().requestFlyTo({ lng: target.longitude, lat: target.latitude })
  }

  return (
    <div className="notoriety-badge gps-marks-badge" onClick={(e) => { e.stopPropagation(); flyToNearest() }}
      style={{ cursor: 'pointer' }} title="Marques GPS à compléter — voler à la plus proche">
      <span className="notoriety-icon" aria-hidden>📍</span>
      <span className="notoriety-value">{marks.length}</span>
    </div>
  )
}
```

- [ ] **Step 2 : CSS** (App.css) — réutilise `.notoriety-badge` ; un léger accent :

```css
.gps-marks-badge { border-color: var(--color-sepia); }
.gps-marks-badge .notoriety-icon { font-size: 15px; }
```

- [ ] **Step 3 : Monter dans la toolbar de MapPage**

Modify `MapPage.tsx` — import, puis dans le bloc toolbar (lignes 421-430, après `<EnergyIndicator />`) :
```tsx
<GpsMarksBadge />
```

- [ ] **Step 4 : Vérifier** (manuel) — avec ≥1 marque, le badge `📍 N` apparaît ; clic → la carte vole à la marque la plus proche ; à 0 marque le badge disparaît.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/badges/GpsMarksBadge.tsx apps/explore-web/src/App.css apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(drafts): badge HUD 'marques a completer' + fly-to plus proche"
```

---

## Phase 5 — Complétion (publication) avec collision

### Task 12 : Mode « publication de marque » dans AddPlaceFlow

**Files:**
- Modify: `apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx`

**Objectif :** quand `mapStore.publishingDraft` est posé, `AddPlaceFlow` (a) saute l'étape `location` en pré-remplissant les coords/photos/titre de la marque, (b) à la soumission, détecte une collision via `findNearbyPlaces` et demande confirmation, puis (c) appelle `publishGpsMark` au lieu de `create_place`.

- [ ] **Step 1 : Pré-remplir depuis la marque au mount**

Dans `AddPlaceFlow.tsx`, ajouter en tête des hooks :
```typescript
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { findNearbyPlaces, publishGpsMark } from '../../../lib/gpsMarksApi'
import { isGpsMarkFresh } from '../../../lib/gpsMarkFreshness'
import type { NearbyPlace } from '../../../types/gpsMark'
```
```typescript
const publishingDraft = useMapStore(s => s.publishingDraft)
const setPublishingDraft = useMapStore(s => s.setPublishingDraft)
const [nearby, setNearby] = useState<NearbyPlace[]>([])
const [mergeChoice, setMergeChoice] = useState<string | null>(null) // placeId choisi, ou 'new'
```
Effet de pré-remplissage (une seule fois) — saute directement à l'étape `form` :
```typescript
const draftPrefillDoneRef = useRef(false)
useEffect(() => {
  if (draftPrefillDoneRef.current || !publishingDraft) return
  draftPrefillDoneRef.current = true
  setConfirmedCoords({ lat: publishingDraft.latitude, lng: publishingDraft.longitude })
  if (publishingDraft.title) setTitle(publishingDraft.title)
  // Photos déjà uploadées : on les garde comme "déjà en ligne" (cf. Step 2).
  setStep('form')
  useMapStore.getState().requestFlyTo({ lng: publishingDraft.longitude, lat: publishingDraft.latitude })
}, [publishingDraft])
```

- [ ] **Step 2 : Gérer les photos déjà uploadées de la marque**

Les photos de la marque sont déjà des `GpsMarkImage` (URLs). Ajouter un state séparé pour ne pas les ré-uploader :
```typescript
const [draftImages, setDraftImages] = useState<{ id: string; url: string; thumb: string }[]>([])
```
Dans l'effet de pré-remplissage : `setDraftImages(publishingDraft.images)`.
Dans le rendu de la grille photos, afficher `draftImages` (via `img.thumb`) en plus des `photos` fraîches, avec une croix de suppression qui retire de `draftImages`. La validation `canSubmit` doit accepter `photos.length + draftImages.length > 0` au lieu de `photos.length > 0`.

- [ ] **Step 3 : Détecter la collision avant soumission**

Quand on entre dans l'étape `form` en mode draft, lancer la détection :
```typescript
useEffect(() => {
  if (!publishingDraft || step !== 'form') return
  let cancelled = false
  void (async () => {
    const r = await findNearbyPlaces(publishingDraft.latitude, publishingDraft.longitude, 30)
    if (!cancelled) setNearby(r)
  })()
  return () => { cancelled = true }
}, [publishingDraft, step])
```
Si `nearby.length > 0`, afficher au-dessus du footer un encart : « Ce lieu existe peut-être déjà » listant chaque candidat (`{title} — {distanceM} m`) avec un bouton radio « C'est ce lieu » (pose `mergeChoice = placeId`) + une option « Non, créer un nouveau lieu » (`mergeChoice = 'new'`). Tant que `nearby.length > 0 && mergeChoice === null`, désactiver le bouton de soumission (forcer un choix conscient — respecte « 2 chapelles à 40 m »).

- [ ] **Step 4 : Brancher la soumission sur `publishGpsMark`**

Dans `handleSubmit`, au tout début, ajouter une branche draft AVANT la logique `create_place` existante :
```typescript
if (publishingDraft) {
  if (!userId || !confirmedCoords || !title.trim() || selectedTagIds.length === 0) return
  if ((photos.length + draftImages.length) === 0) return
  setStep('submitting'); setError(null)
  try {
    // 1. Upload uniquement les NOUVELLES photos (les draftImages sont déjà en ligne).
    const newImages: { id: string; url: string; thumb: string }[] = []
    for (const photo of photos) {
      const imageId = crypto.randomUUID()
      const fullPath = `places/${userId}/${imageId}.webp`
      const thumbPath = `places/${userId}/${imageId}_thumb.webp`
      const [fullUp, thumbUp] = await Promise.all([
        supabase.storage.from('place-images').upload(fullPath, photo.full, { contentType: 'image/webp', upsert: false }),
        supabase.storage.from('place-images').upload(thumbPath, photo.thumb, { contentType: 'image/webp', upsert: false }),
      ])
      if (fullUp.error) { setError(`Upload: ${fullUp.error.message}`); setStep('form'); return }
      const full = supabase.storage.from('place-images').getPublicUrl(fullPath).data.publicUrl
      const thumb = thumbUp.error ? full : supabase.storage.from('place-images').getPublicUrl(thumbPath).data.publicUrl
      newImages.push({ id: imageId, url: full, thumb })
    }
    const allImages = [...draftImages, ...newImages]

    const res = await publishGpsMark({
      userId, draftId: publishingDraft.id, title: title.trim(),
      latitude: confirmedCoords.lat, longitude: confirmedCoords.lng,
      tagId: selectedTagIds[0], images: allImages, address: address.trim(), text: description.trim(),
      eraId, yearExact, secondaryTagIds: selectedTagIds.slice(1),
      mergeIntoPlaceId: mergeChoice && mergeChoice !== 'new' ? mergeChoice : null,
    })
    if (res.error === 'not_enough_discoveries') {
      setError(`Tu dois avoir découvert au moins ${res.requiredDiscoveries} lieux pour publier (tu en as ${res.currentDiscoveries}).`)
      setStep('form'); return
    }
    if (res.error) { setError(res.error); setStep('form'); return }

    // Succès : nettoyer la marque côté store + carte, refresh état joueur.
    useGpsMarksStore.getState().removeLocal(publishingDraft.id)
    setPublishingDraft(null)
    void refreshLevelStateGlobal(userId)
    refreshGloryGlobal()
    if (res.placeId) {
      setNewPlaceId(res.placeId)
      usePlayerStore.getState().addDiscoveredId(res.placeId)
      useMapStore.getState().incrementPlacesRefreshKey()
    }
    useDefisStore.getState().refresh(userId)
    useToastStore.getState().addToast({
      type: 'new_place',
      message: res.mode === 'merged'
        ? `📍 Visite enregistrée sur un lieu existant${res.isGps ? ' (+ bonus GPS)' : ''}.`
        : `📜 Tu as cartographié ${title.trim()}${res.isGps ? ' (+ visite GPS)' : ''}`,
      timestamp: Date.now(),
      placeId: res.placeId,
      placeLocation: { latitude: confirmedCoords.lat, longitude: confirmedCoords.lng },
    })
    setStep('success')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erreur inconnue'); setStep('form')
  }
  return
}
```

- [ ] **Step 5 : Nettoyer `publishingDraft` à la fermeture**

Dans `handleClose()`, ajouter `setPublishingDraft(null)` pour ne pas rester en mode draft si l'utilisateur annule.

- [ ] **Step 6 : Vérifier la compilation + scénario manuel**

Run: `cd apps/explore-web && pnpm build` → PASS.
Manuel (`pnpm dev`) :
1. Poser une marque, cliquer le pin → « Compléter » → `AddPlaceFlow` s'ouvre directement à l'étape formulaire, coords + titre + photo pré-remplis.
2. Remplir tags/description/charte/époque → « Créer le lieu » → toast « + visite GPS » → le pin disparaît, le lieu apparaît.
3. Refaire à 20 m d'un lieu existant : l'encart collision liste le lieu ; choisir « C'est ce lieu » → toast « Visite enregistrée sur un lieu existant ».

- [ ] **Step 7 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx
git commit -m "feat(drafts): publication d'une marque via AddPlaceFlow (pre-remplissage + collision + publish_gps_mark)"
```

---

## Phase 6 — Nettoyage des photos (suivi)

### Task 13 : Suppression des photos à la suppression d'une marque

**Files:**
- Modify: `apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx`

**Note :** la suppression manuelle nettoie les photos tout de suite (best-effort). La purge des marques **périmées jamais publiées** (orphelines en storage) est un **suivi optionnel** (edge function planifiée), documenté ci-dessous mais hors V1.

- [ ] **Step 1 : Supprimer les objets storage à la suppression**

Dans `remove()` de `GpsMarkActionModal.tsx`, avant l'appel `deleteGpsMark`, retirer les fichiers :
```typescript
if (mark.images.length > 0) {
  const paths = mark.images.flatMap(img => {
    // url publique → chemin relatif au bucket (après '/place-images/')
    const rel = (u: string) => u.split('/place-images/')[1]
    return [rel(img.url), rel(img.thumb)].filter(Boolean) as string[]
  })
  if (paths.length) await supabase.storage.from('place-images').remove(paths)
}
```
(Ajouter l'import `import { supabase } from '../../../lib/supabase'`.)

- [ ] **Step 2 : Vérifier** (manuel) — supprimer une marque avec photo → la ligne `place_drafts` disparaît et les objets storage `places/<uid>/drafts/...` ne sont plus accessibles (404 sur l'URL publique).

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/GpsMarkActionModal.tsx
git commit -m "feat(drafts): nettoyage des photos a la suppression d'une marque"
```

- [ ] **Step 4 : Documenter le suivi orphelins (pas d'implémentation V1)**

Ajouter une note dans `docs/db/tech-debt.md` (ou créer une entrée) : « Marques GPS périmées non publiées → photos orphelines dans `place-images/.../drafts/`. Purge à planifier via edge function + pg_cron (lister `place_drafts` avec `status='open'` et `created_at < now() - interval '90 days'`, supprimer storage + ligne). » Commit doc séparé.

---

## Self-Review (couverture spec)

| Exigence spec | Tâche(s) |
|---------------|----------|
| Jeton de présence privé (RLS owner-only) | Task 1 |
| Pose one-tap GPS, photo/titre optionnels, aucune récompense | Task 2, 8 |
| Position = GPS réel (pas viseur libre) | Task 8 (`getFreshPosition`) |
| Entry point CreateMenu | Task 7 |
| Marqueurs perso carte + badge HUD fly-to | Task 9, 11 |
| Compléter → AddPlaceFlow pré-rempli | Task 10, 12 |
| Récompense (visite GPS + étendard) à la publication uniquement | Task 3, 12 |
| Bonus GPS rétroactif dérivé de la marque | Task 3 (`v_user_lat/lng` ← marque) |
| Péremption douce 30 j (privilège GPS éteint, publication possible) | Task 3 (`v_fresh`), 10, 12 |
| Anti-triche : owner + lieu < 200 m + fraîcheur | Task 3 |
| Anti-farming (zéro crédit à la pose) | Task 2, 3 |
| Collision = fusion intelligente (visite sur lieu existant + étendard si libre) | Task 3 (`p_merge_into_place_id`), 12 |
| Étendard rétroactif sur lieu existant non gardé | Task 3 (bloc fusion) |
| Accès pose ouvert à tous ; gate 3 découvertes à la publication | Task 8 (pas de gate), Task 3 (gate `not_enough_discoveries`) |
| Rayon dé-doublonnage configurable (2 chapelles à 40 m) | Task 1 (`place_draft_dedup_radius_m=30`), Task 12 (confirmation user) |
| Nettoyage photos | Task 13 |

**Notes de cohérence :** types (`GpsMark`, `GpsMarkImage`, `NearbyPlace`) définis Task 4, utilisés tels quels Tasks 5/6/10/12. Champs mapStore (`openGpsMarkId`, `publishingDraft`) définis Tasks 9/10, consommés Tasks 10/12. RPC noms/params (`create_gps_mark`, `delete_gps_mark`, `find_nearby_places`, `publish_gps_mark`) identiques entre SQL (Tasks 2/3) et wrappers (Task 5).

**Point à confirmer en implémentation :** le seuil de gate (3 découvertes) est répliqué en dur dans `publish_gps_mark` — vérifier qu'il correspond bien à `mig 061_v07_gating_create_place_by_discoveries.sql` au moment de coder (lire la migration ; ajuster si la logique live diffère).
