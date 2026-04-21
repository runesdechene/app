-- 094_restore_all_latest_rpcs.sql
-- 2026-04-21 : restauration massive suite à re-exécution accidentelle de vieilles migrations
-- Ce fichier re-pose les dernières versions de 32 RPCs + re-drop les obsolètes V0.5
-- 100% idempotent : uniquement CREATE OR REPLACE, DROP IF EXISTS, GRANT, REVOKE

BEGIN;

-- ============================================================
-- SECTION 1 : DROPs d'obsolètes V0.5 (copiés de 083 et 084)
-- ============================================================

-- 083 : Fonction orpheline (trigger déjà droppé)
DROP FUNCTION IF EXISTS public.log_fortify_activity() CASCADE;

-- 083 : RPCs mortes — anciens systèmes Claim / Fortify / Explore
DROP FUNCTION IF EXISTS public.claim_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.claim_place(TEXT, INT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, INT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.explore_place(TEXT, INT) CASCADE;

-- 083 : RPCs mortes — anciens getters non utilisés
DROP FUNCTION IF EXISTS public.get_banner_feed(TEXT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_banner_feed(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners() CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(TEXT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_explorers(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_likers(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_reviews(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_review_by_id(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_places(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_profile(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_composed_title(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_abilities(TEXT) CASCADE;

-- 083 : RPCs mortes — fragments / abilities non utilisés
DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[]) CASCADE;
DROP FUNCTION IF EXISTS public.like_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.unlike_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.reset_user_energy(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.claim_daily_fragment_bonus(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.use_fragment_ability(TEXT, INT) CASCADE;

-- 083 : RPC morte — ancien get_submission_tags non-batch
DROP FUNCTION IF EXISTS public.get_submission_tags(TEXT) CASCADE;

-- 083 : RPC morte — get_place_gauge
DROP FUNCTION IF EXISTS public.get_place_gauge(INT) CASCADE;

-- 084 : DROPs avec signatures corrigées
DROP FUNCTION IF EXISTS public.claim_place(text, text, numeric, numeric, boolean, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(text, text, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.explore_place(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_banner_feed(text, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners(double precision, double precision, double precision, double precision, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(text, double precision, double precision, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety() CASCADE;
DROP FUNCTION IF EXISTS public.get_place_explorers(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_likers(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_reviews(text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_review_by_id(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_places(text, text, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.like_place(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.unlike_place(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_submission_tags(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_gauge(text) CASCADE;

-- 086 : overloads morts de update_my_profile
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT);


-- ============================================================
-- SECTION 2 : Fonctions standalone (dernière version)
-- ============================================================

-- ------------------------------------------------------------
-- create_place (074)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id    TEXT,
  p_title      TEXT,
  p_latitude   REAL,
  p_longitude  REAL,
  p_tag_id     TEXT,
  p_image_url  TEXT DEFAULT NULL,
  p_thumb_url  TEXT DEFAULT NULL,
  p_address    TEXT DEFAULT '',
  p_text       TEXT DEFAULT '',
  p_user_lat   REAL DEFAULT NULL,
  p_user_lng   REAL DEFAULT NULL,
  p_carnet_title TEXT DEFAULT NULL,
  p_era_id       TEXT DEFAULT NULL,
  p_year_exact   INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
  v_faction_id TEXT;
  v_influence_gain INT := 0;
  v_content_pts INT;
  v_is_gps     BOOLEAN := FALSE;
  v_distance_km NUMERIC;
  v_gps_radius  NUMERIC;
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

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_gps_km'), 0.5)
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

  v_new_id := gen_random_uuid()::TEXT;

  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

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
    INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
    VALUES (v_new_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_gain,
                 updated_at = NOW();
    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, title, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    NULLIF(TRIM(COALESCE(p_carnet_title, '')), ''),
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    COALESCE(
      (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(v_images) AS img WHERE img->>'url' IS NOT NULL),
      '[]'::jsonb
    ),
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

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

GRANT EXECUTE ON FUNCTION public.create_place(TEXT, TEXT, REAL, REAL, TEXT, TEXT, TEXT, TEXT, TEXT, REAL, REAL, TEXT, TEXT, INTEGER) TO authenticated;

-- ------------------------------------------------------------
-- decay_placed_influence (051)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decay_placed_influence()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay INT;
  v_affected INT;
BEGIN
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_decay_per_week'), 1) INTO v_decay;

  UPDATE place_influence
  SET placed_points = GREATEST(0, placed_points - v_decay),
      updated_at = NOW()
  WHERE placed_points > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  DELETE FROM place_influence WHERE placed_points = 0 AND content_points = 0 AND permanent_points = 0;

  RETURN json_build_object('decayed', v_affected, 'decayAmount', v_decay);
END;
$$;

-- ------------------------------------------------------------
-- get_all_fragments (047)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY owned DESC, name) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.description, tf.icon, tf.image_url, tf.link_url,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned,
      (
        SELECT json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'tagIcon', t.icon,
          'tagColor', t.color,
          'bonusPoints', fta.bonus_points
        ))
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      ) AS affinities
    FROM title_fragments tf
    WHERE tf.visible = true
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;

-- ------------------------------------------------------------
-- get_daily_enigma (058)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_day_seed INT;
  v_answered_difficulties TEXT[];
  v_answered_count INT;
  v_diff TEXT;
  v_enigma RECORD;
  v_result JSON[] := '{}';
  v_candidates INT[];
  v_pick_idx INT;
  v_reward_influence INT;
  v_reward_erudition INT;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;
  v_day_seed := (EXTRACT(EPOCH FROM v_today)::INT / 86400);

  SELECT COALESCE(ARRAY_AGG(DISTINCT e.difficulty), '{}'), COUNT(*)
  INTO v_answered_difficulties, v_answered_count
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  IF v_answered_count >= 3 OR ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  FOREACH v_diff IN ARRAY ARRAY['very_easy', 'easy', 'medium']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
    FROM enigmas
    WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff;

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      CONTINUE;
    END IF;

    v_pick_idx := (v_day_seed % array_length(v_candidates, 1)) + 1;
    SELECT * INTO v_enigma FROM enigmas WHERE id = v_candidates[v_pick_idx];

    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff), 3) INTO v_reward_influence;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff), 1) INTO v_reward_erudition;

    IF v_enigma.id IS NOT NULL THEN
      v_result := array_append(v_result, json_build_object(
        'id', v_enigma.id,
        'difficulty', v_enigma.difficulty,
        'loreText', v_enigma.lore_text,
        'question', v_enigma.question,
        'format', v_enigma.format,
        'choices', v_enigma.choices,
        'heritageId', v_enigma.heritage_id,
        'rewardInfluence', v_reward_influence,
        'rewardErudition', v_reward_erudition
      ));
    END IF;
  END LOOP;

  IF array_length(v_result, 1) IS NULL OR array_length(v_result, 1) = 0 THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  RETURN json_build_object(
    'enigmas', (SELECT json_agg(elem) FROM unnest(v_result) AS elem),
    'answeredToday', v_answered_difficulties
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- get_faction_members (033)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(member), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'profileImage', u.avatar_url,
      'glory', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0),
      'influencePlaced', COALESCE((
        SELECT SUM((al.data->>'points')::INT)
        FROM activity_log al
        WHERE al.actor_id = u.id
          AND al.type = 'place_influence'
      ), 0),
      'influenceContent', COALESCE((
        SELECT
          COUNT(*) FILTER (WHERE pc.type = 'carnet') * COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_carnet'), 10)
          + COUNT(*) FILTER (WHERE pc.type = 'photo') * COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_photo'), 5)
        FROM place_contributions pc
        WHERE pc.user_id = u.id
      ), 0),
      'displayedGeneralTitles', (
        SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
        ), '[]'::json)
        FROM titles t
        WHERE t.id = ANY(COALESCE(u.displayed_general_title_ids, '{}'))
          AND t.type = 'general'
      ),
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member
    FROM users u
    WHERE u.faction_id = p_faction_id
    ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC NULLS LAST
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_members TO anon;

-- ------------------------------------------------------------
-- get_fragment_enigma (041)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fragment_enigma(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_collection TEXT;
  v_enigma RECORD;
  v_already_today BOOLEAN;
  v_today DATE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  SELECT collection INTO v_collection FROM title_fragments WHERE id = p_fragment_id;
  IF v_collection IS NULL THEN
    RETURN json_build_object('error', 'no_collection');
  END IF;

  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    WHERE er.user_id = p_user_id
      AND er.enigma_id IN (
        SELECT e.id FROM enigmas e
        WHERE e.type = 'daily' AND e.heritage_id = v_collection AND e.active = TRUE
      )
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today
      AND er.erudition_gained = -1 * p_fragment_id
  ) INTO v_already_today;

  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'fragment_enigma'
      AND (data->>'fragmentId')::INT = p_fragment_id
      AND created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'daily'
    AND e.heritage_id = v_collection
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily'
      AND e.heritage_id = v_collection
      AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily' AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'id', v_enigma.id,
    'difficulty', v_enigma.difficulty,
    'loreText', v_enigma.lore_text,
    'question', v_enigma.question,
    'format', v_enigma.format,
    'choices', v_enigma.choices,
    'heritageId', v_enigma.heritage_id,
    'fragmentId', p_fragment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fragment_enigma(TEXT, INT) TO authenticated;

-- ------------------------------------------------------------
-- get_leaderboard (027)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_leaderboard(TEXT, INT);
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_type TEXT, p_limit INT DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) > 0
      ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'exploration' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.exploration_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.exploration_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.exploration_points, 0) > 0
      ORDER BY COALESCE(u.exploration_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'erudition' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.erudition_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.erudition_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.erudition_points, 0) > 0
      ORDER BY COALESCE(u.erudition_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon;

-- ------------------------------------------------------------
-- get_map_places (022)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id,
            'title', dom.faction_title,
            'color', dom.faction_color,
            'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi
        JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC
        LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi
        WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, dom.faction_id, dom.faction_title, dom.faction_color, dom.faction_pattern,
        inf.total_influence, inf.by_faction, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO anon;

-- ------------------------------------------------------------
-- get_my_fragment_status (041)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_fragment_status(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'fragmentId', tf.id,
      'name', tf.name,
      'icon', tf.icon,
      'iconUrl', tf.icon_url,
      'imageUrl', tf.image_url,
      'collection', tf.collection,
      'hasEnigma', tf.collection IS NOT NULL AND EXISTS(
        SELECT 1 FROM enigmas e WHERE e.type = 'daily' AND e.heritage_id = tf.collection AND e.active = TRUE
      ),
      'enigmaCooldown', EXISTS(
        SELECT 1 FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
          AND al.created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
      ),
      'enigmaNextAt', (
        SELECT al.created_at + (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
        FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
        ORDER BY al.created_at DESC LIMIT 1
      ),
      'affinities', (
        SELECT COALESCE(json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'bonusPoints', fta.bonus_points
        )), '[]'::json)
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      )
    ) ORDER BY tf.name)
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_fragment_status(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- get_my_informations (017)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_informations(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF v_user.avatar_url IS NOT NULL THEN
    v_profile_image := json_build_object('url', v_user.avatar_url);
  ELSIF v_user.profile_image_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', im.id,
      'url', COALESCE(
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
        (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
      )
    ) INTO v_profile_image
    FROM image_media im
    WHERE im.id = v_user.profile_image_id;
  ELSE
    v_profile_image := NULL;
  END IF;

  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', COALESCE(v_user.display_name, v_user.first_name, 'Aventurier'),
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction,
    'gameMode', COALESCE(v_user.game_mode, 'exploration'),
    'notorietyPoints', COALESCE(v_user.notoriety_points, 0),
    'explorationPoints', COALESCE(v_user.exploration_points, 0),
    'eruditionPoints', COALESCE(v_user.erudition_points, 0),
    'influenceStock', COALESCE(v_user.influence_stock, 0),
    'glory', COALESCE(v_user.exploration_points, 0) + COALESCE(v_user.erudition_points, 0)
  );
END;
$$;

-- ------------------------------------------------------------
-- get_place_by_id (093)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', u.avatar_url
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND sqrt(pow((p2.latitude - v_place.latitude) * 111, 2) + pow((p2.longitude - v_place.longitude) * 79, 2)) <= v_radius_km;
  END IF;

  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'slug', v_place.slug,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author.avatar_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at,
    'eraId', v_place.era_id,
    'eraName', (SELECT e.name FROM eras e WHERE e.id = v_place.era_id),
    'yearExact', v_place.year_exact
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_by_id(TEXT, TEXT) TO anon;

-- ------------------------------------------------------------
-- get_place_detail_v05 (085)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_influence JSON;
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_dominant_faction TEXT;
  v_dominant_score INT := 0;
  v_guardian RECORD;
BEGIN
  SELECT json_agg(
    json_build_object(
      'factionId', pi.faction_id,
      'placed', pi.placed_points,
      'permanent', pi.permanent_points,
      'content', pi.content_points,
      'total', pi.placed_points + pi.content_points + pi.permanent_points
    ) ORDER BY (pi.placed_points + pi.content_points + pi.permanent_points) DESC
  ) INTO v_influence
  FROM place_influence pi WHERE pi.place_id = p_place_id;

  SELECT faction_id, (placed_points + content_points + permanent_points)
  INTO v_dominant_faction, v_dominant_score
  FROM place_influence
  WHERE place_id = p_place_id
  ORDER BY (placed_points + content_points + permanent_points) DESC
  LIMIT 1;

  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'title', pc.title,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'images', COALESCE(pc.images, '[]'::jsonb),
      'rating', pr.rating,
      'votesUp', pc.votes_up,
      'votesDown', pc.votes_down,
      'createdAt', pc.created_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  LEFT JOIN place_ratings pr ON pr.place_id = pc.place_id AND pr.user_id = pc.user_id
  WHERE pc.place_id = p_place_id;

  SELECT json_agg(
    json_build_object(
      'userId', pe.user_id,
      'visitedAt', pe.visited_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url,
      'factionId', u.faction_id
    ) ORDER BY pe.visited_at ASC
  ) INTO v_explorers
  FROM place_explorers pe
  JOIN users u ON u.id = pe.user_id
  WHERE pe.place_id = p_place_id;

  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_wishlisted;
    SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_explorer;
    SELECT rating INTO v_user_rating FROM place_ratings WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'influence', COALESCE(v_influence, '[]'::json),
    'dominantFaction', v_dominant_faction,
    'contributions', COALESCE(v_contributions, '[]'::json),
    'explorers', COALESCE(v_explorers, '[]'::json),
    'avgRating', v_avg_rating,
    'ratingCount', v_rating_count,
    'userRating', v_user_rating,
    'isWishlisted', v_is_wishlisted,
    'isExplorer', v_is_explorer,
    'guardian', CASE WHEN v_guardian.user_id IS NOT NULL THEN
      json_build_object('userId', v_guardian.user_id, 'name', v_guardian.name,
        'avatar', v_guardian.avatar_url, 'factionId', v_guardian.faction_id)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO anon;

-- ------------------------------------------------------------
-- get_player_profile (034)
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'get_player_profile' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_influence_placed INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)
        OR (tid < 0 AND EXISTS (
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT COALESCE(SUM((al.data->>'points')::INT), 0) INTO v_influence_placed
  FROM activity_log al
  WHERE al.actor_id = p_user_id AND al.type = 'place_influence';

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'explorationPoints', COALESCE(u.exploration_points, 0),
    'eruditionPoints', COALESCE(u.erudition_points, 0),
    'influenceStock', COALESCE(u.influence_stock, 0),
    'influencePlaced', v_influence_placed,
    'glory', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;

-- ------------------------------------------------------------
-- get_random_ad (003)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_random_ad()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen RECORD;
  v_screen_json JSON;
  v_tip_json JSON;
BEGIN
  SELECT id, image_url, product_url, title, linked_tip_id
  INTO v_screen
  FROM ad_screens
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  IF v_screen IS NULL THEN
    RETURN NULL;
  END IF;

  v_screen_json := json_build_object(
    'id', v_screen.id,
    'imageUrl', v_screen.image_url,
    'productUrl', v_screen.product_url,
    'title', v_screen.title
  );

  IF v_screen.linked_tip_id IS NOT NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE id = v_screen.linked_tip_id AND active = true;
  END IF;

  IF v_tip_json IS NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE active = true
      AND id NOT IN (
        SELECT linked_tip_id FROM ad_screens
        WHERE linked_tip_id IS NOT NULL AND active = true
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_tip_json IS NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE active = true
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_tip_json IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('screen', v_screen_json, 'tip', v_tip_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_ad() TO anon;

-- ------------------------------------------------------------
-- get_recent_activity (044)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT
        a.id,
        a.type,
        a.actor_id,
        a.place_id,
        a.faction_id,
        a.data
          || (CASE WHEN NOT (a.data ? 'actorName') AND u.id IS NOT NULL
              THEN jsonb_build_object('actorName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'))
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'actorAvatarUrl') AND u.id IS NOT NULL AND u.avatar_url IS NOT NULL
              THEN jsonb_build_object('actorAvatarUrl', u.avatar_url)
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'factionColor') AND u.id IS NOT NULL AND u.faction_id IS NOT NULL
              THEN jsonb_build_object('factionColor', (SELECT color FROM factions WHERE id = u.faction_id))
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'placeTitle') AND p.id IS NOT NULL
              THEN jsonb_build_object('placeTitle', p.title, 'placeLatitude', p.latitude, 'placeLongitude', p.longitude)
              ELSE '{}'::jsonb END)
        AS data,
        a.created_at
      FROM activity_log a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN places p ON p.id = a.place_id
      ORDER BY a.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_activity(INT) TO authenticated;

-- ------------------------------------------------------------
-- get_user_fragments (047)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.icon, tf.icon_url, tf.image_url, tf.link_url,
      tf.collection,
      uf.unlocked_at, uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words,
      (
        SELECT json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'tagIcon', t.icon,
          'tagColor', t.color,
          'bonusPoints', fta.bonus_points
        ))
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      ) AS affinities
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id AND tf.visible = true
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- get_user_titles (049)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_glory INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_places_added INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
  v_glory_rank INT;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_glory, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;

  SELECT rk INTO v_glory_rank
  FROM (
    SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk
    FROM users
  ) ranked
  WHERE id = p_user_id;

  -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous — le bouton "ajouter un lieu" en dépend
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN (t.condition->>'rank') IS NOT NULL AND t.condition->>'stat' IN ('notoriety', 'glory')
          THEN v_glory_rank <= (t.condition->>'rank')::INT
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' IN ('notoriety', 'glory') THEN v_glory >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added' THEN v_places_added >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT rk INTO v_player_rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk
      FROM users
      WHERE faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,
      'type', 'faction'
    ) INTO v_faction2
    FROM titles t
    WHERE t.type = 'faction'
      AND t.faction_id = v_faction_id
      AND t.condition IS NOT NULL
      AND (t.condition->>'rank') IS NOT NULL
      AND v_player_rank <= (t.condition->>'rank')::INT
    ORDER BY t."order" DESC
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'glory', v_glory,
      'likes', v_likes,
      'fortifications', v_fortifications,
      'places_added', v_places_added
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO anon;

-- ------------------------------------------------------------
-- handle_new_user (090)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
BEGIN
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    BEGIN
      UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = v_existing.id;

      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        vitalite_points, max_vitalite, vitalite_reset_at,
        notoriety_points, displayed_general_title_ids,
        displayed_title_ids_v3, game_mode,
        shopify_customer_id, account_source,
        is_active, website_url,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        COALESCE(v_existing.rank, 'guest'),
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        COALESCE(v_existing.vitalite_points, 5),
        COALESCE(v_existing.max_vitalite, 5),
        COALESCE(v_existing.vitalite_reset_at, NOW()),
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.displayed_title_ids_v3,
        v_existing.game_mode,
        v_existing.shopify_customer_id,
        v_existing.account_source,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;
      UPDATE territory_name_proposals SET proposed_by = NEW.id::TEXT WHERE proposed_by = v_existing.id;
      UPDATE territory_name_votes SET voter_id = NEW.id::TEXT WHERE voter_id = v_existing.id;
      UPDATE user_fragments SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE fragment_ability_uses SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE purchase_log SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;

      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '__migrated_' || NEW.id::TEXT,
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    SELECT COALESCE(value::NUMERIC, 5)
    INTO v_max_e
    FROM app_settings
    WHERE key = 'default_max_energy';

    v_max_e := COALESCE(v_max_e, 5.0);

    INSERT INTO public.users (
      id, email_address, first_name, rank, role,
      energy_points, max_energy, account_source,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      NEW.raw_user_meta_data->>'first_name',
      'guest',
      'user',
      v_max_e,
      v_max_e,
      'app',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- log_claim_activity (069)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_faction_title TEXT;
  v_actor_name TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_previous_faction TEXT;
  v_previous_claimed_by TEXT;
  v_actor_avatar TEXT;
  v_explorer RECORD;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;

  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un'), avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM users WHERE id = NEW.user_id;

  SELECT faction_id, user_id INTO v_previous_faction, v_previous_claimed_by
  FROM place_claims
  WHERE place_id = NEW.place_id AND id != NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'actorName', v_actor_name,
      'actorAvatarUrl', v_actor_avatar,
      'previousActorId', v_previous_claimed_by,
      'previousFactionId', v_previous_faction
    )
  );

  IF v_previous_faction IS NOT NULL AND v_previous_faction != NEW.faction_id THEN
    FOR v_explorer IN
      SELECT pe.user_id FROM place_explorers pe
      JOIN users u ON u.id = pe.user_id
      WHERE pe.place_id = NEW.place_id
        AND u.faction_id = v_previous_faction
        AND pe.user_id != NEW.user_id
    LOOP
      PERFORM notify(v_explorer.user_id, 'claim_lost', jsonb_build_object(
        'placeId', NEW.place_id
      ));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- log_new_user_activity (046)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.display_name, NEW.first_name, NEW.email_address);

  INSERT INTO activity_log (type, actor_id, data)
  VALUES (
    'new_user',
    NEW.id,
    jsonb_build_object(
      'actorName', v_name,
      'actorAvatarUrl', NEW.avatar_url
    )
  );
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- recalc_place_content_points (052)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_place_content_points(p_place_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INT := 0;
  v_pts INT;
  v_faction_totals JSONB := '{}'::JSONB;
  v_current INT;
BEGIN
  UPDATE place_influence SET content_points = 0 WHERE place_id = p_place_id;

  FOR r IN
    SELECT pc.faction_id, (pc.votes_up - pc.votes_down) AS net_votes
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

    v_current := COALESCE((v_faction_totals->>r.faction_id)::INT, 0);
    v_faction_totals := jsonb_set(v_faction_totals, ARRAY[r.faction_id], to_jsonb(v_current + v_pts));
  END LOOP;

  FOR r IN SELECT key AS faction_id, value::INT AS pts FROM jsonb_each_text(v_faction_totals)
  LOOP
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, r.faction_id, r.pts, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;
END;
$$;


-- ============================================================
-- SECTION 3 : Fonctions wrappées par 086 (auth.uid check inline)
-- ============================================================

-- ------------------------------------------------------------
-- set_user_faction (086)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_last_change TIMESTAMPTZ;
  v_cooldown_days INT;
  v_days_remaining INT;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'faction_not_found');
    END IF;
  END IF;

  SELECT faction_id, faction_changed_at
  INTO v_old_faction_id, v_last_change
  FROM users WHERE id = p_user_id;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'faction_change_cooldown_days'), 30)
  INTO v_cooldown_days;

  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    IF v_last_change IS NOT NULL AND (NOW() - v_last_change) < (v_cooldown_days || ' days')::INTERVAL THEN
      v_days_remaining := v_cooldown_days - EXTRACT(DAY FROM (NOW() - v_last_change))::INT;
      RETURN json_build_object('error', 'cooldown', 'daysRemaining', GREATEST(1, v_days_remaining));
    END IF;

    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;

    UPDATE users
    SET faction_id = p_faction_id,
        faction_changed_at = NOW(),
        displayed_title_ids_v3 = (
          SELECT COALESCE(array_agg(tid), '{}')
          FROM unnest(displayed_title_ids_v3) AS tid
          WHERE tid < 0
            OR NOT EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND t.type = 'faction' AND t.faction_id = v_old_faction_id)
        ),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true);
  ELSE
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_faction(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- update_my_profile (086)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_name TEXT;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name  = COALESCE(p_first_name, first_name),
      bio         = COALESCE(p_bio, bio),
      instagram   = COALESCE(p_instagram, instagram),
      avatar_url  = COALESCE(p_avatar_url, avatar_url),
      game_mode   = COALESCE(p_game_mode, game_mode),
      updated_at  = NOW()
  WHERE id = p_user_id;

  IF v_old_name IS NULL AND p_first_name IS NOT NULL THEN
    INSERT INTO activity_log (type, actor_id, data)
    VALUES (
      'new_user',
      p_user_id,
      jsonb_build_object('actorName', p_first_name)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ============================================================
-- SECTION 4 : Fonctions wrappées par 088 (wrappers auth.uid)
-- Pour chaque fonction :
--   1) DROP wrapper + _internal (CASCADE)
--   2) CREATE _internal (body pre-088, copié de la dernière migration)
--   3) CREATE wrapper (corps de 088)
--   4) GRANT sur wrapper, REVOKE sur _internal
-- ============================================================

-- ------------------------------------------------------------
-- answer_enigma : internal=057, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.answer_enigma(text, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public._answer_enigma_internal(text, integer, text) CASCADE;

CREATE OR REPLACE FUNCTION public._answer_enigma_internal(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));
  v_diff_key := v_enigma.difficulty;

  IF v_enigma.type = 'daily' THEN
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    ELSE
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_wrong'), 1) INTO v_erudition_gain;
    END IF;
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    ELSE
      v_erudition_gain := 1;
    END IF;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory', (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.answer_enigma(
  p_user_id TEXT,
  p_enigma_id INTEGER,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_enigma_internal(p_user_id, p_enigma_id, p_answer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public._answer_enigma_internal(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._answer_enigma_internal(text, integer, text) FROM authenticated;

-- ------------------------------------------------------------
-- answer_fragment_enigma : internal=057, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.answer_fragment_enigma(text, integer, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public._answer_fragment_enigma_internal(text, integer, text, integer) CASCADE;

CREATE OR REPLACE FUNCTION public._answer_fragment_enigma_internal(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));
  v_diff_key := v_enigma.difficulty;

  IF v_correct THEN
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5)
    ) INTO v_influence_gain;
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2)
    ) INTO v_erudition_gain;
  ELSE
    v_erudition_gain := 1;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId', p_fragment_id,
    'enigmaId', p_enigma_id,
    'correct', v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain
  ));

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.answer_fragment_enigma(
  p_user_id TEXT,
  p_enigma_id INTEGER,
  p_answer TEXT,
  p_fragment_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_fragment_enigma_internal(p_user_id, p_enigma_id, p_answer, p_fragment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(text, integer, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) FROM authenticated;

-- ------------------------------------------------------------
-- contribute_to_place : internal=078, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.contribute_to_place(text, text, text, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public._contribute_to_place_internal(text, text, text, text, text, text, integer) CASCADE;

CREATE OR REPLACE FUNCTION public._contribute_to_place_internal(
  p_user_id    TEXT,
  p_place_id   TEXT,
  p_type       TEXT,
  p_content    TEXT DEFAULT NULL,
  p_image_url  TEXT DEFAULT NULL,
  p_era_id     TEXT DEFAULT NULL,
  p_year_exact INT  DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id          TEXT;
  v_exploration_gain    INT := 0;
  v_erudition_gain      INT := 0;
  v_contribution_id     INT;
  v_place_title         TEXT;
  v_place_lat           NUMERIC;
  v_place_lng           NUMERIC;
  v_actor_name          TEXT;
  v_faction_color       TEXT;
  v_faction_pattern     TEXT;
  v_explorer            RECORD;
  v_is_first_contrib    BOOLEAN := FALSE;
  v_info_types          TEXT[] := ARRAY['accessibility', 'season', 'warning', 'epoch'];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  IF p_type = ANY(v_info_types) THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM place_contributions
      WHERE place_id = p_place_id AND type = p_type
    ) INTO v_is_first_contrib;
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content   = COALESCE(EXCLUDED.content,    place_contributions.content),
               image_url  = COALESCE(EXCLUDED.image_url,  place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5)
      INTO v_exploration_gain;

  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5)
      INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3)
      INTO v_erudition_gain;

  ELSIF p_type = ANY(v_info_types) AND v_is_first_contrib THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_info'), 1)
      INTO v_erudition_gain;
  END IF;

  IF v_exploration_gain > 0 OR v_erudition_gain > 0 THEN
    UPDATE users SET
      exploration_points = exploration_points + v_exploration_gain,
      erudition_points   = erudition_points   + v_erudition_gain
    WHERE id = p_user_id;
  END IF;

  IF p_type = 'epoch' AND p_era_id IS NOT NULL THEN
    UPDATE places
    SET era_id     = p_era_id,
        year_exact = p_year_exact
    WHERE id = p_place_id;
  END IF;

  PERFORM recalc_place_content_points(p_place_id);

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'contributionType',  p_type,
      'placeTitle',        v_place_title,
      'placeLatitude',     v_place_lat,
      'placeLongitude',    v_place_lng,
      'actorName',         v_actor_name,
      'factionColor',      v_faction_color,
      'factionPattern',    v_faction_pattern,
      'explorationGain',   v_exploration_gain,
      'eruditionGain',     v_erudition_gain,
      'isFirstContribution', v_is_first_contrib
    ));

  IF p_type = 'carnet' THEN
    FOR v_explorer IN
      SELECT user_id FROM place_explorers
      WHERE place_id = p_place_id AND user_id != p_user_id
    LOOP
      PERFORM notify(v_explorer.user_id, 'new_carnet', jsonb_build_object(
        'actorName', v_actor_name,
        'actorId',   p_user_id,
        'placeId',   p_place_id
      ));
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success',             true,
    'contributionId',      v_contribution_id,
    'explorationGain',     v_exploration_gain,
    'eruditionGain',       v_erudition_gain,
    'isFirstContribution', v_is_first_contrib
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_era_id TEXT DEFAULT NULL,
  p_year_exact INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._contribute_to_place_internal(p_user_id, p_place_id, p_type, p_content, p_image_url, p_era_id, p_year_exact);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(text, text, text, text, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._contribute_to_place_internal(text, text, text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._contribute_to_place_internal(text, text, text, text, text, text, integer) FROM authenticated;

-- ------------------------------------------------------------
-- place_influence_action : internal=051, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.place_influence_action(text, text, integer, numeric, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public._place_influence_action_internal(text, text, integer, numeric, numeric, text) CASCADE;

CREATE OR REPLACE FUNCTION public._place_influence_action_internal(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
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

CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INTEGER,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._place_influence_action_internal(p_user_id, p_place_id, p_points, p_user_lat, p_user_lng, p_target_faction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(text, text, integer, numeric, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public._place_influence_action_internal(text, text, integer, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._place_influence_action_internal(text, text, integer, numeric, numeric, text) FROM authenticated;

-- ------------------------------------------------------------
-- revisit_place_gps : internal=081 (dernière CREATE OR REPLACE avant 088), wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.revisit_place_gps(text, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public._revisit_place_gps_internal(text, text, numeric, numeric) CASCADE;

CREATE OR REPLACE FUNCTION public._revisit_place_gps_internal(
  p_user_id TEXT, p_place_id TEXT, p_user_lat NUMERIC, p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_actual_influence,
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

CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._revisit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public._revisit_place_gps_internal(text, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._revisit_place_gps_internal(text, text, numeric, numeric) FROM authenticated;

-- ------------------------------------------------------------
-- unlike_contribution : internal=082, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unlike_contribution(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public._unlike_contribution_internal(text, integer) CASCADE;

CREATE OR REPLACE FUNCTION public._unlike_contribution_internal(
  p_user_id TEXT,
  p_contribution_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contrib RECORD;
  v_old_vote INT;
BEGIN
  SELECT * INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF v_contrib.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_old_vote IS NULL THEN
    RETURN json_build_object('success', true, 'changed', false);
  END IF;

  IF v_old_vote = 1 THEN
    DELETE FROM contribution_votes
    WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

    UPDATE place_contributions
    SET votes_up = GREATEST(0, votes_up - 1)
    WHERE id = p_contribution_id;

    PERFORM recalc_place_content_points(v_contrib.place_id);
  END IF;

  RETURN json_build_object('success', true, 'changed', v_old_vote = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.unlike_contribution(
  p_user_id TEXT,
  p_contribution_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._unlike_contribution_internal(p_user_id, p_contribution_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_contribution(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._unlike_contribution_internal(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._unlike_contribution_internal(text, integer) FROM authenticated;

-- ------------------------------------------------------------
-- visit_place_gps : internal=067, wrapper=088
-- (NOTE : le DO block de la migration 081 est un patch runtime qui ne matche pas
-- le body 067 — donc il était no-op en prod, on restaure donc la version 067 pure.)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.visit_place_gps(text, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public._visit_place_gps_internal(text, text, numeric, numeric) CASCADE;

CREATE OR REPLACE FUNCTION public._visit_place_gps_internal(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_visited BOOLEAN;
  v_stock_gain INT;
  v_exploration_gain INT;
  v_new_influence_stock INT;
  v_new_exploration INT;
  v_actor_name TEXT;
  v_explorer_count INT;
  v_explorer RECORD;
  v_author_id TEXT;
  v_guardian_id TEXT;
  v_carnet_author RECORD;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  v_stock_gain := 15;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 10) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_stock_gain
  WHERE id = p_user_id
  RETURNING exploration_points, influence_stock INTO v_new_exploration, v_new_influence_stock;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'stockGain', v_stock_gain,
      'explorationGain', v_exploration_gain
    ));

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  FOR v_explorer IN
    SELECT user_id FROM place_explorers
    WHERE place_id = p_place_id AND user_id != p_user_id
  LOOP
    PERFORM notify_exploration(v_explorer.user_id, p_place_id, v_actor_name);
  END LOOP;

  SELECT COUNT(*) INTO v_explorer_count FROM place_explorers WHERE place_id = p_place_id;
  IF v_explorer_count IN (5, 10, 25, 50) THEN
    SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
    v_guardian_id := get_place_guardian(p_place_id);

    IF v_author_id IS NOT NULL THEN
      PERFORM notify(v_author_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END IF;
    IF v_guardian_id IS NOT NULL AND v_guardian_id != v_author_id THEN
      PERFORM notify(v_guardian_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END IF;
    FOR v_carnet_author IN
      SELECT DISTINCT user_id FROM place_contributions
      WHERE place_id = p_place_id AND type = 'carnet'
        AND user_id != COALESCE(v_author_id, '')
        AND user_id != COALESCE(v_guardian_id, '')
    LOOP
      PERFORM notify(v_carnet_author.user_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'stockGain', v_stock_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id),
    'visitNumber', 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.visit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._visit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(text, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public._visit_place_gps_internal(text, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._visit_place_gps_internal(text, text, numeric, numeric) FROM authenticated;

-- ------------------------------------------------------------
-- vote_contribution : internal=065, wrapper=088
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vote_contribution(text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public._vote_contribution_internal(text, integer, integer) CASCADE;

CREATE OR REPLACE FUNCTION public._vote_contribution_internal(
  p_user_id TEXT,
  p_contribution_id INT,
  p_vote INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contrib RECORD;
  v_old_vote INT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_author_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_faction TEXT;
  v_actor_avatar TEXT;
  v_new_votes_up INT;
BEGIN
  SELECT * INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF v_contrib.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_contrib.user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_vote_own');
  END IF;

  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_old_vote IS NOT NULL THEN
    IF v_old_vote = p_vote THEN
      RETURN json_build_object('error', 'already_voted');
    END IF;
    UPDATE contribution_votes SET vote = p_vote WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1, votes_down = votes_down - 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_up = votes_up - 1, votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  ELSE
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, p_vote);
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  END IF;

  PERFORM recalc_place_content_points(v_contrib.place_id);

  SELECT votes_up INTO v_new_votes_up FROM place_contributions WHERE id = p_contribution_id;

  IF p_vote = 1 AND v_old_vote IS NULL THEN
    SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
    FROM places WHERE id = v_contrib.place_id;

    SELECT COALESCE(display_name, first_name, 'Quelqu''un'), faction_id, avatar_url
    INTO v_actor_name, v_actor_faction, v_actor_avatar
    FROM users WHERE id = p_user_id;

    SELECT COALESCE(display_name, first_name, 'Quelqu''un')
    INTO v_author_name
    FROM users WHERE id = v_contrib.user_id;

    SELECT color, pattern INTO v_faction_color, v_faction_pattern
    FROM factions WHERE id = v_actor_faction;

    INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
    VALUES ('like_carnet', p_user_id, v_contrib.place_id, v_actor_faction,
      jsonb_build_object(
        'placeTitle', v_place_title,
        'placeLatitude', v_place_lat,
        'placeLongitude', v_place_lng,
        'actorName', v_actor_name,
        'actorAvatarUrl', v_actor_avatar,
        'authorName', v_author_name,
        'authorId', v_contrib.user_id,
        'contributionId', v_contrib.id,
        'factionColor', v_faction_color,
        'factionPattern', v_faction_pattern
      ));

    PERFORM notify(v_contrib.user_id, 'like_carnet', jsonb_build_object(
      'actorName', v_actor_name,
      'actorId', p_user_id,
      'placeTitle', v_place_title,
      'placeId', v_contrib.place_id,
      'contributionId', v_contrib.id
    ));

    IF v_new_votes_up IN (5, 10, 20, 50) THEN
      PERFORM notify(v_contrib.user_id, 'milestone_likes', jsonb_build_object(
        'placeId', v_contrib.place_id,
        'contributionId', v_contrib.id,
        'likeCount', v_new_votes_up
      ));
    END IF;
  END IF;

  RETURN json_build_object('success', true,
    'newVotesUp', v_new_votes_up,
    'newVotesDown', (SELECT votes_down FROM place_contributions WHERE id = p_contribution_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_contribution(
  p_user_id TEXT,
  p_contribution_id INTEGER,
  p_vote INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._vote_contribution_internal(p_user_id, p_contribution_id, p_vote);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._vote_contribution_internal(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._vote_contribution_internal(text, integer, integer) FROM authenticated;

COMMIT;
