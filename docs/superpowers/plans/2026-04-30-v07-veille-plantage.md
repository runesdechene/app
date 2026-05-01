# V0.7 Plantage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système d'influence cumulative V0.5 par un système de Veille (1 expédition active par lieu, 1 à N veilleurs par expédition, supplantation par GPS). Phase 1 : DB + RPCs + UX bouton de plantage. Couronnes / Coupe / Campement = chantiers séparés.

**Architecture:** 4 tables (`expeditions`, `expedition_members`, `place_veille`, `veille_history`). **Modèle unifié** : toute veille = une expédition (solo = expédition de 1 membre). `place_veille` pointe vers l'expédition active du lieu, denormalise `faction_id` + `is_neutral` pour les requêtes carte. 4 RPCs (`plant_flag`, `get_nearby_planters`, `get_place_veille`, `get_map_veilles`). Soft transition via seed depuis `activity_log` (visits GPS) puis fallback `place_explorers`. L'ancien système (`place_influence`, `place_influence_action`, etc.) est **gelé** : RPC `place_influence_action` neutralisée (no-op) en migration 015, tables marquées DEPRECATES dans les commentaires SQL, indexées par Graphify, droppées plus tard. Co-existence UI : `<VeilleFrame>` ajouté au-dessus de `<InfluenceFrame>` qui passe en lecture seule (prop `readOnly`).

**Tech Stack:** Postgres / Supabase RPC `SECURITY DEFINER`, React 18 + TypeScript strict, Zustand (`mapStore`, `playerStore`), MapLibre GL.

**Spec liée :** `../specs/2026-04-30-v07-veille-plantage.md`

**Verification discipline (pas de test runner SQL ni Vitest dans ce projet)** :
- Migrations RPC → `node scripts/migration-preview.mjs <fichier>` avant apply (gate régression)
- Migrations DDL → revue visuelle avant apply
- Apply via `npx supabase db query --linked -f <fichier>` (production-alpha, pas de DB dev)
- Smoke SQL post-apply (queries d'inspection courtes)
- Frontend → `pnpm --filter explore-web build` (type-check) + `pnpm --filter explore-web dev` (manuel browser)
- Commits locaux uniquement (Uriel a demandé "on bosse qu'en local"), pas de push tant que la phase 1 n'est pas validée bout-en-bout

---

## Task 1: Migration `015_v07_veille_tables.sql` — schema + soft transition

**Files:**
- Create: `supabase/migrations/015_v07_veille_tables.sql`

- [ ] **Step 1.1: Écrire la migration**

```sql
-- 015_v07_veille_tables.sql
-- WHY : V0.7 — système de Veille (Plantage de l'étendard) remplace l'influence cumulative.
-- Phase 1 : tables, indexes, soft transition seed depuis activity_log + place_explorers.
-- Q1=d : veilleur initial = dernier user avec interaction GPS sur le lieu.
-- Q2=a : ancien système figé, pas de DROP.
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md
--
-- DEPRECATES (cleanup ultérieur via Graphify, pas dans cette migration) :
--   tables    : public.place_influence, public.user_place_influence
--   RPCs      : place_influence_action, propose_territory_name, vote_territory_name,
--               get_territory_votes, recalc_place_content_points,
--               _blob_dominant_faction, _user_blob_influence, claim_place
--   colonnes  : places.faction_id, places.claimed_by, places.claimed_at,
--               places.fortification_level, places.claimed_avatar_url

-- Modèle unifié : toute veille = une expédition (solo = expédition d'1 membre).

CREATE TABLE IF NOT EXISTS public.expeditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  is_neutral  boolean NOT NULL DEFAULT false,
  faction_id  text REFERENCES public.factions(id),       -- NULL si neutral, sinon faction commune
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expedition_members (
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id       text REFERENCES public.users(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),
  PRIMARY KEY (expedition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.place_veille (
  place_id      text PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),     -- denormalisé depuis expeditions
  is_neutral    boolean NOT NULL DEFAULT false,           -- denormalisé depuis expeditions
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_veille_faction_idx ON public.place_veille (faction_id) WHERE NOT is_neutral;

CREATE TABLE IF NOT EXISTS public.veille_history (
  id            bigserial PRIMARY KEY,
  place_id      text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE SET NULL,
  user_id       text REFERENCES public.users(id) ON DELETE SET NULL,  -- 1 ligne par membre
  faction_id    text REFERENCES public.factions(id),
  is_neutral    boolean NOT NULL DEFAULT false,
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veille_history_place_idx ON public.veille_history (place_id, planted_at DESC);
CREATE INDEX IF NOT EXISTS veille_history_user_idx  ON public.veille_history (user_id, planted_at DESC);

-- Soft transition : pour chaque dernier visiteur GPS connu, créer une expédition solo et la poser sur le lieu
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

GRANT SELECT ON public.place_veille      TO authenticated, anon, service_role;
GRANT SELECT ON public.expeditions       TO authenticated, anon, service_role;
GRANT SELECT ON public.expedition_members TO authenticated, anon, service_role;
GRANT SELECT ON public.veille_history    TO authenticated, anon, service_role;

-- Freeze data : neutraliser place_influence_action (no-op qui rend l'état actuel)
-- Garde le nom (no-op DROP) pour ne pas casser les clients V0.5 encore déployés.
-- DEPRECATES — fonction à droper au cleanup ultérieur.
CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id text,
  p_place_id text,
  p_points integer,
  p_target_faction_id text,
  p_user_lat numeric DEFAULT NULL,
  p_user_lng numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- V0.7 freeze : on ne touche plus place_influence ni user_place_influence.
  -- Retourne un état stable pour que le frontend V0.5 ne crash pas, mais sans modifier la DB.
  RETURN json_build_object(
    'error', 'system_frozen_v07',
    'message', 'Le système d''influence a été remplacé par la Veille (V0.7). Utilisez plant_flag.',
    'remainingStock', NULL,
    'placeInfluence', NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.place_influence_action(text, text, integer, text, numeric, numeric) TO authenticated, anon, service_role;
```

- [ ] **Step 1.2: Preview (DDL pure → preview va exit 0, c'est attendu)**

```bash
node scripts/migration-preview.mjs supabase/migrations/015_v07_veille_tables.sql
```

Expected: `rien à vérifier` (pas de `CREATE OR REPLACE FUNCTION`)

- [ ] **Step 1.3: Apply**

```bash
npx supabase db query --linked -f supabase/migrations/015_v07_veille_tables.sql
```

Expected: pas d'erreur, `INSERT N` lignes pour le seed

- [ ] **Step 1.4: Smoke SQL — vérifier les tables et le seed**

Lance via psql / Supabase SQL editor :

```sql
-- Vérif tables présentes
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('place_veille', 'expeditions', 'expedition_members', 'veille_history');
-- Attendu : 4 lignes

-- Vérif seed cohérent : nb veille = nb places ayant au moins un visit_gps OU un place_explorer avec faction connue
SELECT
  (SELECT COUNT(*) FROM place_veille) AS veille_seedees,
  (SELECT COUNT(DISTINCT place_id) FROM activity_log WHERE type IN ('visit_gps','revisit_gps')) AS places_avec_gps;
-- Attendu : veille_seedees ≤ places_avec_gps + (place_explorers fallback)

-- Échantillon : 3 lieux veillés (avec leur expédition + membre seedé)
SELECT pv.place_id, p.title, u.display_name, f.name AS faction, pv.planted_at
FROM place_veille pv
JOIN places p ON p.id = pv.place_id
JOIN expedition_members em ON em.expedition_id = pv.expedition_id
JOIN users u ON u.id = em.user_id
LEFT JOIN factions f ON f.id = pv.faction_id
ORDER BY pv.planted_at DESC LIMIT 3;
-- Attendu : 3 lignes plausibles (seed = expédition d'1 membre)

-- Vérif cohérence : nb expéditions seedées = nb veille
SELECT
  (SELECT COUNT(*) FROM expeditions) AS expeditions_seedees,
  (SELECT COUNT(*) FROM place_veille) AS veille_seedees;
-- Attendu : égales
```

- [ ] **Step 1.5: Régénérer Graphify SQL**

```bash
python3 scripts/graphify-sql.py
```

Expected: les 4 nouvelles tables + DEPRECATES sont indexés.

- [ ] **Step 1.6: Commit local (pas de push)**

```bash
git add supabase/migrations/015_v07_veille_tables.sql graphify-out/
git commit -m "feat(v0.7): tables Veille + soft transition seed"
```

---

## Task 2: Migration `016_v07_plant_flag_rpc.sql` — RPC d'écriture

**Files:**
- Create: `supabase/migrations/016_v07_plant_flag_rpc.sql`

- [ ] **Step 2.1: Écrire la RPC**

```sql
-- 016_v07_plant_flag_rpc.sql
-- WHY : RPC plant_flag — supplante la veille du lieu, gère solo / expedition.
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md
-- Distance max : 100m (cohérent avec visit_place_gps / revisit_place_gps).

CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id            text,
  p_place_id           text,
  p_user_lat           numeric,
  p_user_lng           numeric,
  p_partners_user_ids  text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction        text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_expedition_id       uuid;
  v_is_neutral          boolean := false;
  v_expedition_faction  text;
  v_factions            text[];
  v_partner_user_id     text;
  v_partner_faction     text;
  v_members_json        jsonb;
  v_now                 timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_user_faction FROM public.users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM public.places WHERE id = p_place_id;
  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  -- Calcule l'ensemble des factions impliquées (créateur + partners éventuels)
  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id)
    AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  -- Toujours créer une expédition (solo = expédition d'1 membre)
  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_now)
  RETURNING id INTO v_expedition_id;

  -- Membre fondateur
  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

  -- Partners (si fournis)
  IF array_length(p_partners_user_ids, 1) > 0 THEN
    FOREACH v_partner_user_id IN ARRAY p_partners_user_ids LOOP
      IF v_partner_user_id = p_user_id THEN CONTINUE; END IF;
      SELECT faction_id INTO v_partner_faction FROM public.users WHERE id = v_partner_user_id;
      IF v_partner_faction IS NOT NULL THEN
        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- UPSERT place_veille (supplante l'expédition précédente)
  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id,
    faction_id    = EXCLUDED.faction_id,
    is_neutral    = EXCLUDED.is_neutral,
    planted_at    = EXCLUDED.planted_at;

  -- Historique : 1 ligne par membre de l'expédition
  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  -- Build members JSON pour retour
  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  -- Activity log
  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
          jsonb_build_object(
            'placeTitle', v_place_title,
            'isNeutral', v_is_neutral,
            'expeditionId', v_expedition_id,
            'memberCount', jsonb_array_length(v_members_json),
            'members', v_members_json
          ));

  RETURN json_build_object(
    'success',      true,
    'placeId',      p_place_id,
    'isNeutral',    v_is_neutral,
    'factionId',    v_expedition_faction,
    'expeditionId', v_expedition_id,
    'members',      v_members_json,
    'plantedAt',    v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO service_role;
```

- [ ] **Step 2.2: Preview (DOIT signaler "nouvelle fonction")**

```bash
node scripts/migration-preview.mjs supabase/migrations/016_v07_plant_flag_rpc.sql
```

Expected: rapport mentionne `plant_flag` comme NOUVELLE fonction (pas de version antérieure).

- [ ] **Step 2.3: Apply**

```bash
npx supabase db query --linked -f supabase/migrations/016_v07_plant_flag_rpc.sql
```

- [ ] **Step 2.4: Smoke SQL — appel solo + UPSERT supplantation**

Choisir un user de test (`SELECT id FROM users WHERE faction_id IS NOT NULL LIMIT 1;`) et un lieu proche d'un point GPS connu. Lancer côté dashboard Supabase (en `service_role` car `auth.uid()` ne match pas en SQL editor) :

```sql
-- TODO Uriel : remplacer p_user_id et coordonnées par un cas réel
SELECT public.plant_flag(
  '<user-id>'::text,
  '<place-id>'::text,
  <lat>::numeric,
  <lng>::numeric,
  '{}'::text[]
);
-- Attendu : { success: true, isNeutral: false, factionId: '...', members: [...] }

-- Vérif dans place_veille (pointe vers la nouvelle expédition)
SELECT * FROM place_veille WHERE place_id = '<place-id>';
-- Attendu : expedition_id à jour, planted_at récent

-- Vérif des membres de l'expédition courante
SELECT em.* FROM expedition_members em
JOIN place_veille pv ON pv.expedition_id = em.expedition_id
WHERE pv.place_id = '<place-id>';
-- Attendu : 1 ligne (solo) ou N lignes (expédition)

-- Vérif dans veille_history (audit complet)
SELECT * FROM veille_history WHERE place_id = '<place-id>' ORDER BY planted_at DESC LIMIT 5;
-- Attendu : ≥ 2 entrées (seed initial + nouveau plantage, 1 ligne par membre)
```

> Note : l'appel SQL direct contourne la garde `auth.uid()`. Pour test bout-en-bout réaliste, valider depuis l'app frontend en Task 7.

- [ ] **Step 2.5: Régénérer Graphify + commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/016_v07_plant_flag_rpc.sql graphify-out/
git commit -m "feat(v0.7): RPC plant_flag (solo + expedition)"
```

---

## Task 3: Migration `017_v07_query_rpcs.sql` — RPCs de lecture

**Files:**
- Create: `supabase/migrations/017_v07_query_rpcs.sql`

- [ ] **Step 3.1: Écrire les 3 RPCs de lecture**

```sql
-- 017_v07_query_rpcs.sql
-- WHY : RPCs de lecture pour la veille (panel place + carte + opt-in expedition).
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md

-- get_nearby_planters : autres users qui ont fait visit_gps/revisit_gps
-- sur le même lieu dans les 5 dernières minutes (candidats opt-in expedition)
CREATE OR REPLACE FUNCTION public.get_nearby_planters(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('candidates', '[]'::json);
  END IF;

  RETURN json_build_object(
    'candidates',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'userId', u.id,
          'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
          'avatarUrl', u.avatar_url,
          'factionId', u.faction_id,
          'factionColor', f.color
        ))
        FROM (
          SELECT DISTINCT actor_id
          FROM public.activity_log
          WHERE place_id = p_place_id
            AND type IN ('visit_gps', 'revisit_gps')
            AND actor_id IS NOT NULL
            AND actor_id <> p_user_id
            AND created_at > now() - interval '5 minutes'
        ) recent
        JOIN public.users u ON u.id = recent.actor_id
        LEFT JOIN public.factions f ON f.id = u.faction_id
        WHERE u.faction_id IS NOT NULL
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_planters(text, text) TO authenticated, service_role;

-- get_place_veille : état actuel pour le panel (modèle unifié, members toujours non-vide)
CREATE OR REPLACE FUNCTION public.get_place_veille(p_place_id text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_row record;
  v_members jsonb;
BEGIN
  SELECT * INTO v_row FROM public.place_veille WHERE place_id = p_place_id;
  IF v_row IS NULL THEN
    RETURN json_build_object('vacant', true);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_row.expedition_id;

  RETURN json_build_object(
    'vacant', false,
    'isNeutral', v_row.is_neutral,
    'factionId', v_row.faction_id,
    'expeditionId', v_row.expedition_id,
    'plantedAt', v_row.planted_at,
    'members', COALESCE(v_members, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_veille(text) TO authenticated, anon, service_role;

-- get_map_veilles : minimal pour coloriage carte
CREATE OR REPLACE FUNCTION public.get_map_veilles() RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId', place_id,
      'factionId', faction_id,
      'isNeutral', is_neutral
    )),
    '[]'::json
  )
  FROM public.place_veille;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_veilles() TO authenticated, anon, service_role;
```

- [ ] **Step 3.2: Preview**

```bash
node scripts/migration-preview.mjs supabase/migrations/017_v07_query_rpcs.sql
```

Expected: 3 nouvelles fonctions.

- [ ] **Step 3.3: Apply + smoke**

```bash
npx supabase db query --linked -f supabase/migrations/017_v07_query_rpcs.sql
```

```sql
-- Vérif rapide
SELECT public.get_map_veilles();
-- Attendu : tableau JSON avec ~N entries (= seed)

SELECT public.get_place_veille('<place-id-veillé>'::text);
-- Attendu : { vacant: false, factionId: '...', veilleur: {...}, plantedAt: '...' }

SELECT public.get_place_veille('<place-id-non-veillé>'::text);
-- Attendu : { vacant: true }
```

- [ ] **Step 3.4: Régénérer Graphify + commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/017_v07_query_rpcs.sql graphify-out/
git commit -m "feat(v0.7): RPCs lecture veille (nearby_planters, place_veille, map_veilles)"
```

---

## Task 4: Hook `useVeille` + types TS

**Files:**
- Create: `apps/explore-web/src/hooks/useVeille.ts`
- Create: `apps/explore-web/src/types/veille.ts`

- [ ] **Step 4.1: Types**

```ts
// apps/explore-web/src/types/veille.ts

export interface VeilleMember {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
}

export type PlaceVeille =
  | { vacant: true }
  | {
      vacant: false
      isNeutral: boolean
      factionId: string | null         // null si neutral
      expeditionId: string
      plantedAt: string
      members: VeilleMember[]          // toujours ≥ 1 entrée (solo = 1, expédition = N)
    }

export interface NearbyPlanter {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
  factionColor: string | null
}

export interface PlantFlagResult {
  success: true
  placeId: string
  isNeutral: boolean
  factionId: string | null
  expeditionId: string | null
  members: VeilleMember[]
  plantedAt: string
}

export interface PlantFlagError {
  error: 'unauthorized' | 'no_faction' | 'place_not_found' | 'too_far'
  distanceKm?: number
}

export interface MapVeille {
  placeId: string
  factionId: string | null
  isNeutral: boolean
}
```

- [ ] **Step 4.2: Hook**

```ts
// apps/explore-web/src/hooks/useVeille.ts
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PlaceVeille, NearbyPlanter, PlantFlagResult, PlantFlagError } from '../types/veille'

export function useVeille(placeId: string) {
  const [veille, setVeille] = useState<PlaceVeille | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_place_veille', { p_place_id: placeId })
    setLoading(false)
    if (error) {
      console.error('get_place_veille error:', error.message, error.details, error.hint)
      return
    }
    setVeille(data as PlaceVeille)
  }, [placeId])

  const fetchNearby = useCallback(async (userId: string): Promise<NearbyPlanter[]> => {
    const { data, error } = await supabase.rpc('get_nearby_planters', {
      p_user_id: userId,
      p_place_id: placeId,
    })
    if (error) {
      console.error('get_nearby_planters error:', error.message)
      return []
    }
    return ((data as { candidates?: NearbyPlanter[] })?.candidates) ?? []
  }, [placeId])

  const plant = useCallback(async (
    userId: string,
    lat: number,
    lng: number,
    partnersIds: string[],
  ): Promise<PlantFlagResult | PlantFlagError> => {
    const { data, error } = await supabase.rpc('plant_flag', {
      p_user_id: userId,
      p_place_id: placeId,
      p_user_lat: lat,
      p_user_lng: lng,
      p_partners_user_ids: partnersIds,
    })
    if (error) {
      console.error('plant_flag error:', error.message, error.details, error.hint)
      return { error: 'unauthorized' }
    }
    return data as PlantFlagResult | PlantFlagError
  }, [placeId])

  return { veille, loading, refresh, fetchNearby, plant }
}
```

- [ ] **Step 4.3: Type-check**

```bash
pnpm --filter explore-web build
```

Expected: pas d'erreur TS.

- [ ] **Step 4.4: Commit**

```bash
git add apps/explore-web/src/hooks/useVeille.ts apps/explore-web/src/types/veille.ts
git commit -m "feat(v0.7): hook useVeille + types"
```

---

## Task 5: Composant `<VeilleFrame>` + bouton Planter (solo seulement)

**Files:**
- Create: `apps/explore-web/src/components/places/VeilleFrame.tsx`
- Create: `apps/explore-web/src/components/places/VeilleFrame.css`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx` (ajouter `<VeilleFrame>` au-dessus de `<InfluenceFrame>`)

> Phase 5a: solo uniquement (`fetchNearby` retourne toujours `[]` pour l'instant). La modal expedition arrive en Task 6.

- [ ] **Step 5.1: VeilleFrame.tsx (squelette + bouton solo)**

```tsx
// apps/explore-web/src/components/places/VeilleFrame.tsx
import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useVeille } from '../../hooks/useVeille'
import './VeilleFrame.css'

interface Props {
  placeId: string
  placeLocation: { latitude: number; longitude: number }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function VeilleFrame({ placeId, placeLocation }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const { veille, refresh, plant } = useVeille(placeId)
  const [planting, setPlanting] = useState(false)

  useEffect(() => { refresh() }, [refresh])

  const distanceKm = userPosition
    ? haversineKm({ lat: userPosition.lat, lng: userPosition.lng },
                  { lat: placeLocation.latitude, lng: placeLocation.longitude })
    : null
  const onSpot = distanceKm !== null && distanceKm <= 0.1
  const canPlant = !!(userId && userFactionId && onSpot && !planting)

  const handlePlant = useCallback(async () => {
    if (!userId || !userPosition) return
    setPlanting(true)
    const result = await plant(userId, userPosition.lat, userPosition.lng, [])
    setPlanting(false)
    if ('error' in result) {
      console.warn('plant_flag failed:', result.error, result.distanceKm)
      return
    }
    await refresh()
  }, [userId, userPosition, plant, refresh])

  return (
    <div className="veille-frame">
      <div className="veille-frame-header">🚩 Veille</div>

      {veille && veille.vacant && (
        <div className="veille-frame-state veille-frame-vacant">Aucun veilleur. À toi de planter le premier étendard.</div>
      )}

      {veille && !veille.vacant && (() => {
        const isSolo = veille.members.length === 1
        const names = veille.members.map(m => m.displayName)
        const label = isSolo
          ? <><strong>{names[0]}</strong> veille ce lieu</>
          : (veille.isNeutral
              ? <><strong>{names.join(', ')}</strong> veillent ensemble (expédition multi-faction)</>
              : <><strong>{names.join(', ')}</strong> veillent ensemble</>)
        return (
          <div className="veille-frame-state">
            <div className="veille-frame-heads">
              {veille.members.map(m => (
                <img key={m.userId}
                     src={m.avatarUrl ?? '/res/default-avatar.png'}
                     alt={m.displayName}
                     title={m.displayName}
                     className="veille-frame-avatar" />
              ))}
            </div>
            <span>{label} — depuis le {new Date(veille.plantedAt).toLocaleDateString()}</span>
          </div>
        )
      })()}

      <button
        className="veille-frame-plant-btn"
        disabled={!canPlant}
        onClick={handlePlant}
        title={onSpot ? 'Planter ton étendard' : 'Approche-toi à moins de 100m du lieu pour planter'}
      >
        {planting ? '...' : '🚩 Planter l’étendard'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5.2: CSS minimal**

```css
/* apps/explore-web/src/components/places/VeilleFrame.css */
.veille-frame {
  background: rgba(48, 38, 28, 0.85);
  color: #f5e9d0;
  border: 1px solid #8a6f4a;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
  font-size: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.veille-frame-header { font-weight: 600; font-size: 18px; }
.veille-frame-state { display: flex; align-items: center; gap: 10px; font-size: 16px; }
.veille-frame-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.veille-frame-heads { display: flex; }
.veille-frame-heads .veille-frame-avatar:not(:first-child) { margin-left: -8px; border: 2px solid #30261c; }
.veille-frame-plant-btn {
  background: #8a6f4a; color: #f5e9d0; border: none; border-radius: 6px;
  padding: 10px 14px; font-size: 17px; font-weight: 600; cursor: pointer;
}
.veille-frame-plant-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.veille-frame-vacant { font-style: italic; opacity: 0.85; }
```

- [ ] **Step 5.3: Patcher InfluenceFrame.tsx pour le rendre lecture seule**

Ajouter une prop `readOnly` au composant ; quand true, ne pas appeler `place_influence_action` (le RPC est déjà no-op côté serveur après mig 015 — ceci est défense en profondeur côté client) et désactiver visuellement les bannières.

```tsx
// Dans InfluenceFrameProps :
interface InfluenceFrameProps {
  placeId: string
  influence: InfluenceEntry[]
  factionColors: Map<string, string>
  factionPatterns: Map<string, string>
  factionNames: Map<string, string>
  placeLocation: { latitude: number; longitude: number }
  onInfluencePlaced: () => void
  readOnly?: boolean   // NEW (V0.7)
}

// Dans le composant, en début de handleClick :
if (readOnly) return

// Dans canClick :
const canClick = !readOnly && userId && userFactionId && influenceStock > 0

// Dans le rendu titre :
<span className="influence-frame-title">🏆 Coupe des Héritages{readOnly ? ' (lecture seule)' : ''}</span>
```

- [ ] **Step 5.4: Intégration dans PlacePanel.tsx**

Modifier `apps/explore-web/src/components/places/PlacePanel.tsx` autour de la ligne 925 — ajouter `<VeilleFrame>` avant `<InfluenceFrame>` et passer `readOnly={true}` à `<InfluenceFrame>` :

```tsx
import { VeilleFrame } from './VeilleFrame'
// ...
{/* V0.7 — Veille (Plantage) */}
<VeilleFrame
  placeId={place.id}
  placeLocation={{ latitude: place.latitude, longitude: place.longitude }}
/>

{/* Zone 3A — Influence Banners (V0.5, lecture seule pendant la transition) */}
{v05 && (
  <InfluenceFrame
    {/* ...props existants... */}
    readOnly={true}
  />
)}
```

- [ ] **Step 5.5: Type-check + smoke browser**

```bash
pnpm --filter explore-web build
pnpm --filter explore-web dev
```

Smoke test :
- Ouvrir un lieu sur la carte
- Vérifier que `VeilleFrame` s'affiche au-dessus de l'influence
- Si non en GPS proche : bouton désactivé, hint visible
- Si veille seedée : nom du veilleur + date affichés
- Si vacant : message "Aucun veilleur"

- [ ] **Step 5.6: Commit**

```bash
git add apps/explore-web/src/components/places/VeilleFrame.tsx \
        apps/explore-web/src/components/places/VeilleFrame.css \
        apps/explore-web/src/components/places/InfluenceFrame.tsx \
        apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat(v0.7): VeilleFrame + Planter solo + InfluenceFrame readOnly"
```

---

## Task 6: Modal opt-in expedition

**Files:**
- Create: `apps/explore-web/src/components/places/ExpeditionOptInModal.tsx`
- Modify: `apps/explore-web/src/components/places/VeilleFrame.tsx` (intégrer la modal)

- [ ] **Step 6.1: Modal**

```tsx
// apps/explore-web/src/components/places/ExpeditionOptInModal.tsx
import { useState } from 'react'
import type { NearbyPlanter } from '../../types/veille'

interface Props {
  candidates: NearbyPlanter[]
  onCancel: () => void
  onConfirm: (selectedIds: string[]) => void
}

export function ExpeditionOptInModal({ candidates, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="expedition-modal-overlay" onClick={onCancel}>
      <div className="expedition-modal" onClick={e => e.stopPropagation()}>
        <h3>Tu n'es pas seul ici</h3>
        <p>{candidates.length} autre{candidates.length > 1 ? 's' : ''} voyageur{candidates.length > 1 ? 's sont' : ' est'} sur place. Planter ensemble ?</p>
        <ul className="expedition-modal-list">
          {candidates.map(c => (
            <li key={c.userId}>
              <label>
                <input type="checkbox" checked={selected.has(c.userId)} onChange={() => toggle(c.userId)} />
                <img src={c.avatarUrl ?? '/res/default-avatar.png'} alt="" />
                <span>{c.displayName}</span>
                <span className="expedition-modal-faction" style={{ color: c.factionColor ?? '#8a6f4a' }}>● {c.factionId}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="expedition-modal-actions">
          <button onClick={() => onConfirm([])}>Planter seul</button>
          <button onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0}>
            Planter ensemble ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: CSS dans VeilleFrame.css** — append :

```css
.expedition-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.expedition-modal {
  background: #30261c; color: #f5e9d0; border: 1px solid #8a6f4a;
  border-radius: 10px; padding: 18px; max-width: 420px; width: 100%;
  font-size: 16px;
}
.expedition-modal h3 { margin-top: 0; font-size: 20px; }
.expedition-modal-list { list-style: none; padding: 0; margin: 12px 0; }
.expedition-modal-list li label { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
.expedition-modal-list img { width: 28px; height: 28px; border-radius: 50%; }
.expedition-modal-faction { font-size: 14px; opacity: 0.8; margin-left: auto; }
.expedition-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.expedition-modal-actions button {
  background: #8a6f4a; color: #f5e9d0; border: none; border-radius: 6px;
  padding: 8px 14px; font-size: 16px; cursor: pointer;
}
.expedition-modal-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 6.3: Intégrer dans VeilleFrame.tsx — remplacer `handlePlant` par un flow en 2 étapes**

```tsx
// Ajouter import + state :
import { ExpeditionOptInModal } from './ExpeditionOptInModal'
import type { NearbyPlanter } from '../../types/veille'
const [optInCandidates, setOptInCandidates] = useState<NearbyPlanter[] | null>(null)

// Récupérer fetchNearby depuis le hook :
const { veille, refresh, plant, fetchNearby } = useVeille(placeId)

// Remplacer handlePlant :
const handlePlant = useCallback(async () => {
  if (!userId || !userPosition) return
  const candidates = await fetchNearby(userId)
  if (candidates.length === 0) {
    await doPlant([])
    return
  }
  setOptInCandidates(candidates)
}, [userId, userPosition, fetchNearby])

const doPlant = useCallback(async (partners: string[]) => {
  if (!userId || !userPosition) return
  setPlanting(true)
  const result = await plant(userId, userPosition.lat, userPosition.lng, partners)
  setPlanting(false)
  setOptInCandidates(null)
  if ('error' in result) {
    console.warn('plant_flag failed:', result.error, result.distanceKm)
    return
  }
  await refresh()
}, [userId, userPosition, plant, refresh])

// JSX — ajouter à la fin du return :
{optInCandidates && (
  <ExpeditionOptInModal
    candidates={optInCandidates}
    onCancel={() => setOptInCandidates(null)}
    onConfirm={(ids) => doPlant(ids)}
  />
)}
```

- [ ] **Step 6.4: Type-check + smoke**

```bash
pnpm --filter explore-web build
pnpm --filter explore-web dev
```

Smoke : se mettre à 2 comptes test (Uriel + un compte secondaire), faire `visit_gps` sur le même lieu en moins de 5min puis cliquer Planter sur le 2e compte → modal apparaît avec le 1er compte.

- [ ] **Step 6.5: Commit**

```bash
git add apps/explore-web/src/components/places/ExpeditionOptInModal.tsx \
        apps/explore-web/src/components/places/VeilleFrame.tsx \
        apps/explore-web/src/components/places/VeilleFrame.css
git commit -m "feat(v0.7): modal opt-in expedition + flow 2 etapes"
```

---

## Task 7: Carte — coloriage par veille (réutilise `setPlaceOverride` existant)

**Files:**
- Modify: `apps/explore-web/src/components/places/VeilleFrame.tsx` (push override après plant)
- Modify: 1 fichier qui boot la carte (boot `loadInitialVeilles`)

> `mapStore.setPlaceOverride(placeId, { factionId, tagColor, ... })` existe déjà (utilisé par `place_influence_action`). On le réutilise tel quel — pas besoin de slice dédiée.

- [ ] **Step 7.1: Loader initial des veilles au boot de la carte**

Repérer où la carte est bootée (probablement dans le composant qui mount `<Map>` ou via un `useEffect` global). Ajouter :

```ts
import { supabase } from '../lib/supabase'
import { useMapStore } from '../stores/mapStore'
import type { MapVeille } from '../types/veille'

// Helper appelé une fois au boot
async function loadInitialVeilles(factionColors: Map<string, string>, factionPatterns: Map<string, string>) {
  const { data, error } = await supabase.rpc('get_map_veilles')
  if (error) { console.error('get_map_veilles error:', error.message); return }
  const list = (data as MapVeille[]) ?? []
  const { setPlaceOverride } = useMapStore.getState()
  for (const v of list) {
    const tagColor = v.isNeutral ? '#8a6f4a' : (v.factionId ? factionColors.get(v.factionId) : undefined)
    const factionPattern = v.isNeutral ? undefined : (v.factionId ? factionPatterns.get(v.factionId) : undefined)
    setPlaceOverride(v.placeId, {
      factionId: v.isNeutral ? undefined : v.factionId ?? undefined,
      tagColor,
      factionPattern,
      claimed: true,
    })
  }
}
```

Appeler `loadInitialVeilles(...)` une fois au mount de la carte (après que `factionColors` est chargé).

- [ ] **Step 7.2: Sync après plant_flag (dans VeilleFrame)**

Dans `VeilleFrame.tsx`, après `await refresh()` dans `doPlant`, pousser l'override carte :

```ts
import { useMapStore } from '../../stores/mapStore'
import { useFactionsStore } from '../../stores/factionsStore'  // ou équivalent existant pour les couleurs

// Dans le composant :
const factionColors = useFactionsStore(s => s.colors)        // <- adapter au store réel
const factionPatterns = useFactionsStore(s => s.patterns)

// Après successful plant :
const tagColor = result.isNeutral ? '#8a6f4a'
                : result.factionId ? factionColors.get(result.factionId)
                : undefined
const factionPattern = result.isNeutral ? undefined
                : result.factionId ? factionPatterns.get(result.factionId)
                : undefined
useMapStore.getState().setPlaceOverride(placeId, {
  factionId: result.isNeutral ? undefined : result.factionId ?? undefined,
  tagColor,
  factionPattern,
  claimed: true,
})
```

> Si le nom du store des factions diffère, l'adapter en lisant `apps/explore-web/src/stores/`.

- [ ] **Step 7.3: Type-check + smoke**

```bash
pnpm --filter explore-web build
pnpm --filter explore-web dev
```

Smoke :
1. Au boot, vérifier sur la carte que les lieux seedés affichent leur couleur de veille (cohérent avec V0.5 jusqu'à preuve du contraire car même faction).
2. Planter un drapeau dans une autre faction → la couleur change instantanément.
3. Planter une expédition multi-faction → couleur brune.

- [ ] **Step 7.4: Commit**

```bash
git add apps/explore-web/src/components/places/VeilleFrame.tsx \
        apps/explore-web/src/<fichier-boot-carte>.tsx
git commit -m "feat(v0.7): override carte par veille (initial + plant)"
```

---

## Task 8: Smoke test bout-en-bout + bilan

- [ ] **Step 8.1: Scénarios à valider en local**

| # | Scénario | Attendu |
|---|----------|---------|
| 1 | Lieu jamais visité GPS, j'arrive sur place, je plante seul | Veille mon avatar, faction = ma faction, carte mise à jour |
| 2 | Lieu déjà veillé par X, j'arrive en GPS et je plante seul | Supplante X, mon avatar visible, X disparaît du panel |
| 3 | Joueur Y a fait `visit_gps` ya 2min, j'arrive et clique Planter | Modal opt-in propose Y, je coche, expedition créée |
| 4 | Modal expedition Y (faction adverse), je coche, je confirme | `is_neutral = true`, couleur brune sur la carte |
| 5 | Lieu loin (>100m) | Bouton désactivé, hint "Approche-toi" |
| 6 | User sans faction | Bouton désactivé |
| 7 | Lieu vacant après seed (jamais visité GPS, jamais explorers) | `vacant: true` dans le panel |
| 8 | InfluenceFrame en lecture seule | Affichée sous VeilleFrame, scores figés (pas de nouveau click possible — déjà l'ancien code, n'a pas changé) |

- [ ] **Step 8.2: Mémoire — note de session**

Sauvegarder le bilan dans la mémoire XO (note `project_session_<date>.md`) : ce qui marche, ce qui restera à faire (couche carte plus propre, retrait `InfluenceFrame`, Couronnes, Coupe, Campement).

- [ ] **Step 8.3: Décision push**

Selon résultats du smoke et selon Uriel : pusher la branche en remote OU rester en local en attendant les chantiers suivants (Couronnes notamment, qui modifieront `plant_flag` pour le multiplicateur d'expédition).

---

## Récap décisions structurantes

- Pas de DROP. Ancien système figé, marqué DEPRECATES, indexé par Graphify.
- Co-existence UI : `<VeilleFrame>` au-dessus, `<InfluenceFrame>` en lecture seule en dessous, retiré au chantier suivant.
- Soft transition : seed depuis `activity_log` (visit_gps/revisit_gps) puis fallback `place_explorers` au moment de la migration 015.
- Distance seuil : 100m (cohérent avec `visit_place_gps` / `revisit_place_gps`).
- Fenêtre opt-in expedition : 5 minutes (sur les `visit_gps` / `revisit_gps` du lieu).
- Couleur veille neutre : `#8a6f4a` (brun) — à confirmer en design.

## Hors scope phase 1 (chantiers à venir)

- **Couronnes de Chêne** : gain quotidien 1/lieu/jour, multiplicateur expedition ×1/×2/×3/×4, plafond 500. Modifie `plant_flag` (ajouter `crowns_multiplier`) + ajoute table `user_crowns` + RPC `claim_daily_crowns`.
- **Coupe des Héritages** : score collectif basé sur actions personnelles (carnets, lieux ajoutés, visites, énigmes). Ajoute table de scoring + recalc périodique.
- **Campement remplace profil** : nouvelle entité géolocalisée par user, donne son nom à la zone si entourée de lieux à sa couleur.
- **Cleanup DEPRECATES** : script Python lit `graphify-out/graph.json`, énumère les nodes flaggés DEPRECATES, génère une migration `999_cleanup_v05.sql` avec les `DROP` correspondants. Dérange uniquement quand on a confirmé qu'aucune RPC active ne référence les vieilles tables.
