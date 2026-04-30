-- 013_user_place_influence_v05.sql
--
-- Décision (30 avril 2026, Uriel + XO)
-- ====================================
--
-- Bug : "Bonne faction sur le territoire mais impossible de proposer/voter un nom"
--
-- Cause — désynchro V0.4 / V0.5 :
--   * get_map_places (côté client) renvoie la faction DOMINANTE PAR INFLUENCE
--     (joinure place_influence ORDER BY placed+content DESC)
--   * get_territory_votes / propose_territory_name / vote_territory_name lisaient
--     places.faction_id (legacy V0.4 — retiré en V0.5 avec le claim system)
--   => Un user de la faction dominante par influence voit le territoire à sa
--      couleur mais la RPC le rejette (places.faction_id natif ≠ users.faction_id).
--
-- Fix : aligner les 3 RPCs voting sur le même calcul que get_map_places, et
--       introduire une table user_place_influence (granularité user × lieu ×
--       faction). Cette table sert deux features :
--         a) vote_power des territoires (1 vote de base + 1/10 pts perso)
--         b) future "afficher les contributeurs d'un lieu par faction"
--
-- DROP decay_placed_influence : la décroissance hebdomadaire est remplacée par
-- les Coupes des Héritages (reboot saisonnier manuel — décision 30/04).
--
-- Backfill best-effort depuis activity_log (placed + revisit) et via recalc
-- complet pour content_points. Le bonus GPS create_place n'était pas tracé
-- avec data.influenceGain avant cette migration : perte légère sur les places
-- ajoutées en GPS uniquement.

-- ============================================================================
-- 1. Table user_place_influence
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_place_influence (
    user_id          character varying(255) NOT NULL,
    place_id         character varying(255) NOT NULL,
    faction_id       character varying(255) NOT NULL,
    placed_points    integer NOT NULL DEFAULT 0,
    content_points   integer NOT NULL DEFAULT 0,
    permanent_points integer NOT NULL DEFAULT 0,
    updated_at       timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, place_id, faction_id)
);

CREATE INDEX IF NOT EXISTS idx_user_place_influence_place_faction
  ON public.user_place_influence (place_id, faction_id);

ALTER TABLE public.user_place_influence ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.user_place_influence TO anon, authenticated, service_role;

COMMENT ON TABLE public.user_place_influence IS
  'V0.5 — Granularité user x lieu x faction de l''influence. SUM par (place_id, faction_id) = place_influence agrégé. Source d''autorité pour : vote_power des territoires (get_territory_votes) et future feature contributeurs par faction.';

-- Seuil d'influence personnelle = 1 vote bonus, ajustable sans migration.
-- Sémantique : vote_power = 1 + (influence_perso / seuil). Voir get_territory_votes.
INSERT INTO public.app_settings (key, value)
VALUES ('territory_vote_per_influence', '10')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. _place_influence_action_internal — double-écriture user_place_influence
-- ============================================================================

CREATE OR REPLACE FUNCTION public._place_influence_action_internal(
  p_user_id text,
  p_place_id text,
  p_points integer,
  p_user_lat numeric DEFAULT NULL,
  p_user_lng numeric DEFAULT NULL,
  p_target_faction_id text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction_id TEXT;
  v_target_faction TEXT;
  v_stock INT;
  v_is_gps BOOLEAN := FALSE;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_actual_points INT;
  v_place_title TEXT;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_faction_title TEXT;
BEGIN
  SELECT faction_id, influence_stock INTO v_user_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_user_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  v_target_faction := COALESCE(p_target_faction_id, v_user_faction_id);

  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = v_target_faction) THEN
    RETURN json_build_object('error', 'invalid_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.2;
  END IF;

  v_actual_points := p_points;

  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  -- Agrégat par lieu × faction
  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  -- V0.5 : granularité user × lieu × faction (pour vote_power et feature contributeurs)
  INSERT INTO user_place_influence (user_id, place_id, faction_id, placed_points, updated_at)
  VALUES (p_user_id, p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (user_id, place_id, faction_id)
  DO UPDATE SET placed_points = user_place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern, title INTO v_faction_color, v_faction_pattern, v_faction_title
  FROM factions WHERE id = v_target_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_target_faction,
    jsonb_build_object(
      'points', v_actual_points,
      'remote', NOT v_is_gps,
      'gps', v_is_gps,
      'target_faction', v_target_faction,
      'own_faction', v_user_faction_id,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'factionTitle', v_faction_title
    ));

  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'placeInfluence', (
      SELECT json_agg(json_build_object(
        'factionId', pi.faction_id,
        'placed', pi.placed_points,
        'permanent', pi.permanent_points,
        'content', pi.content_points,
        'total', pi.placed_points + pi.content_points + pi.permanent_points
      ))
      FROM place_influence pi WHERE pi.place_id = p_place_id
    )
  );
END;
$$;

-- ============================================================================
-- 3. _revisit_place_gps_internal — double-écriture user_place_influence
-- ============================================================================

CREATE OR REPLACE FUNCTION public._revisit_place_gps_internal(
  p_user_id text,
  p_place_id text,
  p_user_lat numeric,
  p_user_lng numeric
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_visit_count INT;
  v_base_influence INT;
  v_actual_influence INT;
  v_exploration_gain INT;
  v_actor_name TEXT;
  v_actor_avatar TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un'), avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM users WHERE id = p_user_id;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_visited_yet');
  END IF;

  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
    AND created_at::DATE = CURRENT_DATE;

  IF v_visit_count >= 3 THEN
    RETURN json_build_object('error', 'daily_revisit_limit');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10) INTO v_base_influence;
  v_actual_influence := GREATEST(1, v_base_influence / (1 << v_visit_count));
  v_exploration_gain := GREATEST(1, v_actual_influence / 2);

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id;

  -- Agrégat par lieu × faction
  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_actual_influence,
               updated_at = NOW();

  -- V0.5 : granularité user × lieu × faction
  INSERT INTO user_place_influence (user_id, place_id, faction_id, permanent_points, updated_at)
  VALUES (p_user_id, p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (user_id, place_id, faction_id)
  DO UPDATE SET permanent_points = user_place_influence.permanent_points + v_actual_influence,
               updated_at = NOW();

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'influenceGain', v_actual_influence,
      'explorationGain', v_exploration_gain,
      'visitCount', v_visit_count + 1,
      'permanent', true,
      'actorName', v_actor_name,
      'actorAvatarUrl', v_actor_avatar,
      'placeTitle', v_place_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern
    ));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_actual_influence,
    'explorationGain', v_exploration_gain,
    'visitCount', v_visit_count + 1,
    'permanent', true
  );
END;
$$;

-- ============================================================================
-- 4. create_place — double-écriture pour le bonus GPS permanent (+30)
-- ============================================================================
-- Signature unifiée depuis migration 005 (p_images jsonb).
-- content_points seront alimentés via recalc_place_content_points (modifiée
-- en section 5) qui est déjà appelée plus bas dans la fonction.

CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id      text,
  p_title        text,
  p_latitude     real,
  p_longitude    real,
  p_tag_id       text,
  p_images       jsonb   DEFAULT '[]'::jsonb,
  p_address      text    DEFAULT '',
  p_text         text    DEFAULT '',
  p_user_lat     real    DEFAULT NULL,
  p_user_lng     real    DEFAULT NULL,
  p_carnet_title text    DEFAULT NULL,
  p_era_id       text    DEFAULT NULL,
  p_year_exact   integer DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id         text;
  v_actor_name     text;
  v_faction_id     text;
  v_influence_gain int := 0;
  v_content_pts    int;
  v_is_gps         boolean := FALSE;
  v_distance_km    numeric;
  v_gps_radius     numeric;
  v_images         jsonb;
  v_carnet_urls    jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  v_images := COALESCE(p_images, '[]'::jsonb);

  SELECT COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'distance_gps_km'), 0.5)
  INTO v_gps_radius;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := 6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_user_lat)) * cos(radians(p_latitude))
        * cos(radians(p_longitude) - radians(p_user_lng))
        + sin(radians(p_user_lat)) * sin(radians(p_latitude))
      ))
    );
    v_is_gps := v_distance_km <= v_gps_radius;
  END IF;

  v_new_id := gen_random_uuid()::text;

  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    era_id, year_exact
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    p_era_id, p_year_exact
  );

  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  UPDATE users SET exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  IF v_is_gps THEN
    v_influence_gain := 30;
    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;

    -- Agrégat par lieu × faction
    INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
    VALUES (v_new_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_gain,
                 updated_at = NOW();

    -- V0.5 : granularité user × lieu × faction (bonus GPS create_place)
    IF v_faction_id IS NOT NULL THEN
      INSERT INTO user_place_influence (user_id, place_id, faction_id, permanent_points, updated_at)
      VALUES (p_user_id, v_new_id, v_faction_id, v_influence_gain, NOW())
      ON CONFLICT (user_id, place_id, faction_id)
      DO UPDATE SET permanent_points = user_place_influence.permanent_points + v_influence_gain,
                   updated_at = NOW();
    END IF;

    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  v_carnet_urls := COALESCE(
    (SELECT jsonb_agg(img->>'url')
       FROM jsonb_array_elements(v_images) AS img
       WHERE img->>'url' IS NOT NULL),
    '[]'::jsonb
  );

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, title, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    NULLIF(TRIM(COALESCE(p_carnet_title, '')), ''),
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    v_carnet_urls,
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  -- recalc_place_content_points alimente content_points dans place_influence
  -- ET user_place_influence (voir section 5)
  PERFORM recalc_place_content_points(v_new_id);

  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name,
      'isGps', v_is_gps,
      'permanent', v_is_gps
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps
    )
  );
END;
$$;

-- ============================================================================
-- 5. recalc_place_content_points — alimente aussi user_place_influence
-- ============================================================================
-- Le recalc parcourt les place_contributions du lieu, attribue des points par
-- rang (20/10/5/2…) et somme par faction. On garde la même logique pour
-- place_influence et on ajoute la même logique au niveau user_place_influence
-- (avec pc.user_id) — l'invariant SUM(user_place_influence) = place_influence
-- est ainsi préservé.

CREATE OR REPLACE FUNCTION public.recalc_place_content_points(p_place_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INT := 0;
  v_pts INT;
  v_faction_totals JSONB := '{}'::JSONB;
  v_user_faction_totals JSONB := '{}'::JSONB; -- key = "user_id|faction_id" → pts
  v_user_faction_key TEXT;
  v_current INT;
  v_user_id TEXT;
  v_faction_id TEXT;
BEGIN
  -- Reset agrégats et granulaire pour ce lieu
  UPDATE place_influence      SET content_points = 0 WHERE place_id = p_place_id;
  UPDATE user_place_influence SET content_points = 0 WHERE place_id = p_place_id;

  FOR r IN
    SELECT pc.user_id, pc.faction_id, (pc.votes_up - pc.votes_down) AS net_votes
    FROM place_contributions pc
    WHERE pc.place_id = p_place_id
      AND pc.type = 'carnet'
      AND pc.faction_id IS NOT NULL
      AND pc.votes_up > 0
    ORDER BY (pc.votes_up - pc.votes_down) DESC, pc.created_at ASC
  LOOP
    v_rank := v_rank + 1;
    v_pts := CASE
      WHEN v_rank = 1 THEN 20
      WHEN v_rank = 2 THEN 10
      WHEN v_rank = 3 THEN 5
      ELSE 2
    END;

    -- Total par faction (pour place_influence)
    v_current := COALESCE((v_faction_totals->>r.faction_id)::INT, 0);
    v_faction_totals := jsonb_set(v_faction_totals, ARRAY[r.faction_id], to_jsonb(v_current + v_pts));

    -- Total par (user, faction) pour user_place_influence
    v_user_faction_key := r.user_id || '|' || r.faction_id;
    v_current := COALESCE((v_user_faction_totals->>v_user_faction_key)::INT, 0);
    v_user_faction_totals := jsonb_set(v_user_faction_totals, ARRAY[v_user_faction_key], to_jsonb(v_current + v_pts));
  END LOOP;

  -- Insert / update agrégats par faction
  FOR r IN SELECT key AS faction_id, value::INT AS pts FROM jsonb_each_text(v_faction_totals)
  LOOP
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, r.faction_id, r.pts, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;

  -- Insert / update granulaire user × faction
  FOR r IN SELECT key AS user_faction_key, value::INT AS pts FROM jsonb_each_text(v_user_faction_totals)
  LOOP
    v_user_id := split_part(r.user_faction_key, '|', 1);
    v_faction_id := split_part(r.user_faction_key, '|', 2);

    INSERT INTO user_place_influence (user_id, place_id, faction_id, content_points, updated_at)
    VALUES (v_user_id, p_place_id, v_faction_id, r.pts, NOW())
    ON CONFLICT (user_id, place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. DROP decay_placed_influence
-- ============================================================================
-- Remplacé par les Coupes des Héritages (reboot saisonnier manuel).

DROP FUNCTION IF EXISTS public.decay_placed_influence();
DELETE FROM public.app_settings WHERE key = 'influence_decay_per_week';

-- ============================================================================
-- 7. Backfill best-effort
-- ============================================================================

-- 7.1 placed_points depuis activity_log (type='place_influence')
INSERT INTO public.user_place_influence (user_id, place_id, faction_id, placed_points, updated_at)
SELECT
  al.actor_id,
  al.place_id,
  al.faction_id,
  SUM((al.data->>'points')::INT)::INT,
  NOW()
FROM public.activity_log al
WHERE al.type = 'place_influence'
  AND al.actor_id IS NOT NULL
  AND al.place_id IS NOT NULL
  AND al.faction_id IS NOT NULL
  AND (al.data->>'points') IS NOT NULL
GROUP BY al.actor_id, al.place_id, al.faction_id
ON CONFLICT (user_id, place_id, faction_id)
DO UPDATE SET placed_points = user_place_influence.placed_points + EXCLUDED.placed_points,
              updated_at = NOW();

-- 7.2 permanent_points depuis activity_log (type='revisit_gps')
INSERT INTO public.user_place_influence (user_id, place_id, faction_id, permanent_points, updated_at)
SELECT
  al.actor_id,
  al.place_id,
  al.faction_id,
  SUM((al.data->>'influenceGain')::INT)::INT,
  NOW()
FROM public.activity_log al
WHERE al.type = 'revisit_gps'
  AND al.actor_id IS NOT NULL
  AND al.place_id IS NOT NULL
  AND al.faction_id IS NOT NULL
  AND (al.data->>'influenceGain') IS NOT NULL
GROUP BY al.actor_id, al.place_id, al.faction_id
ON CONFLICT (user_id, place_id, faction_id)
DO UPDATE SET permanent_points = user_place_influence.permanent_points + EXCLUDED.permanent_points,
              updated_at = NOW();

-- 7.3 content_points : recalc complet par lieu (alimente les 2 tables)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.places WHERE place_type_id = 'lieu' LOOP
    PERFORM public.recalc_place_content_points(rec.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- 8. Helper : faction dominante par influence sur un blob
-- ============================================================================

CREATE OR REPLACE FUNCTION public._blob_dominant_faction(p_blob_place_ids text[])
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_faction TEXT;
BEGIN
  IF p_blob_place_ids IS NULL OR array_length(p_blob_place_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pi.faction_id INTO v_faction
  FROM place_influence pi
  WHERE pi.place_id = ANY(p_blob_place_ids)
    AND (pi.placed_points + pi.content_points + pi.permanent_points) > 0
  GROUP BY pi.faction_id
  ORDER BY SUM(pi.placed_points + pi.content_points + pi.permanent_points) DESC,
           pi.faction_id ASC
  LIMIT 1;

  RETURN v_faction;
END;
$$;

GRANT ALL ON FUNCTION public._blob_dominant_faction(text[]) TO anon, authenticated, service_role;

-- ============================================================================
-- 9. Helper : influence personnelle d'un user sur un blob × faction
-- ============================================================================

CREATE OR REPLACE FUNCTION public._user_blob_influence(
  p_user_id text,
  p_blob_place_ids text[],
  p_faction_id text
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
BEGIN
  IF p_user_id IS NULL OR p_faction_id IS NULL OR p_blob_place_ids IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(upi.placed_points + upi.content_points + upi.permanent_points), 0)
  INTO v_total
  FROM user_place_influence upi
  WHERE upi.user_id = p_user_id
    AND upi.place_id = ANY(p_blob_place_ids)
    AND upi.faction_id = p_faction_id;

  RETURN v_total;
END;
$$;

GRANT ALL ON FUNCTION public._user_blob_influence(text, text[], text) TO anon, authenticated, service_role;

-- ============================================================================
-- 10. get_territory_votes — fix V0.4 → V0.5
-- ============================================================================
-- Changements vs version baseline :
--   - v_territory_faction = _blob_dominant_faction (place_influence dominant) au
--     lieu de places.faction_id (legacy V0.4)
--   - v_vote_power = 1 + (_user_blob_influence / seuil) au lieu de 1 + claimed_count

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id text,
  p_user_id text,
  p_blob_place_ids text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction      TEXT;
  v_territory_faction TEXT;
  v_personal_inf      INT;
  v_threshold         INT;
  v_vote_power        INT;
  v_proposals         JSON;
  v_used_votes        INT;
  v_proposals_count   INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- V0.5 : faction dominante par influence (cohérent avec get_map_places)
  v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);

  -- 1. Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- 2. Supprimer les votes sur des propositions orphelines
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u_proposer
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- 3. Supprimer les propositions orphelines
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- V0.5 : éligibilité = même faction que le dominant. Vote_power = 1 + influence_perso/seuil.
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 10)
      INTO v_threshold;
    v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions (auteurs encore de la bonne faction uniquement)
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
      AND u_proposer.faction_id = v_territory_faction
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilisés
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',         v_vote_power,
    'usedVotes',         v_used_votes,
    'proposalsCount',    v_proposals_count,
    'proposals',         COALESCE(v_proposals, '[]'::json),
    'personalInfluence', COALESCE(v_personal_inf, 0),
    'threshold',         COALESCE(v_threshold, 10)
  );
END;
$$;

-- ============================================================================
-- 11. propose_territory_name — fix V0.4 → V0.5
-- ============================================================================

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id text,
  p_anchor_place_id text,
  p_name text,
  p_blob_place_ids text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_user_faction TEXT;
  v_territory_faction TEXT;
BEGIN
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- V0.5 : faction dominante par influence
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);
  ELSE
    -- Fallback : faction dominante du seul anchor
    v_territory_faction := public._blob_dominant_faction(ARRAY[p_anchor_place_id]);
  END IF;

  -- Edge case : v_territory_faction NULL (blob sans place_influence) = personne éligible
  IF v_user_faction IS NULL OR v_territory_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si nécessaire
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    UPDATE territory_name_proposals
    SET anchor_place_id = p_anchor_place_id
    WHERE anchor_place_id = ANY(p_blob_place_ids)
      AND anchor_place_id != p_anchor_place_id;
  END IF;

  -- Rate limit : max 2 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 2 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;

-- ============================================================================
-- 12. vote_territory_name — fix V0.4 → V0.5 + retire claimed_count obsolète
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id text,
  p_proposal_id uuid,
  p_value smallint,
  p_blob_place_ids text[],
  p_anchor_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction      TEXT;
  v_territory_faction TEXT;
  v_personal_inf      INT;
  v_threshold         INT;
  v_vote_power        INT;
  v_total_used        INT;
  v_winning           TEXT;
  v_tied              BOOLEAN;
  v_net               INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- V0.5 : faction dominante par influence
  v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);

  -- Edge case : v_territory_faction NULL (blob sans place_influence) = personne éligible
  IF v_user_faction IS NULL OR v_territory_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- V0.5 : vote_power = 1 + influence_perso / seuil (remplace claimed_count V0.4)
  v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 10)
    INTO v_threshold;
  v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Valider que le total utilisé ne dépasse pas le vote power
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_total_used
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  IF v_total_used > v_vote_power THEN
    -- Rollback
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;

    RETURN json_build_object('error', 'not_enough_votes', 'votePower', v_vote_power, 'usedVotes', v_total_used - ABS(p_value));
  END IF;

  -- Recalculer le gagnant pour ce territoire
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners  AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votée
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$$;
