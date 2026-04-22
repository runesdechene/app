-- 001_baseline.sql
-- Baseline schéma Supabase pour runes-de-chene app
-- Généré : 2026-04-22
--
-- ATTENTION : ce fichier n'est PAS destiné à être ré-exécuté sur la DB prod.
-- Sert à :
--   1) Rebuild from scratch une DB vide (ex: test local, nouveau clone)
--   2) Archive fidèle du schéma au 22 avril 2026
--
-- La prod est alignée avec ce baseline par un INSERT manuel dans
-- supabase_migrations.schema_migrations (version '001') effectué le 22 avril 2026
-- suite à l'archivage des 94 migrations historiques (cf. .archives/migrations-2026-04-22/).
--
-- Contenu :
--   * Structure complète du schéma public (tables + fonctions + triggers + RLS + indexes + grants)
--   * Data-only des 17 tables de référence gameplay :
--     ad_screens, ad_tips, app_settings, construction_types, enigmas, eras,
--     factions, faction_tag_bonuses, fragment_tag_affinities, fragment_words,
--     place_types, tag_gauge_mapping, tags, territory_tiers, title_fragments,
--     titles, tutorial_slides
--
-- Tables user-data non incluses (vides au rebuild) :
--   users, places, chat_messages, activity_log, notifications, enigma_responses,
--   place_claims, place_contributions, etc. (38 tables au total)
--
-- Gotcha connu : pg_dump a signalé une circular FK sur place_types.
-- Si rebuild from scratch échoue, utiliser psql --set ON_ERROR_STOP=0
-- ou désactiver temporairement la FK avant le data load.
--
-- Secret neutralisé : app_settings.shopify_access_token a été remplacé par
-- `REPLACE_FROM_ENV_AFTER_RESTORE` pour ne pas exposer le token en git.
-- Après un rebuild from scratch, restaurer la vraie valeur via :
--   UPDATE app_settings SET value = '<token depuis ProtonPass>' WHERE key = 'shopify_access_token';
-- TODO Uriel : à moyen terme, sortir ce token de app_settings vers les
-- secrets Supabase (Edge Functions → Environment variables) pour ne plus
-- jamais avoir un token long-lived stocké en table.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."_answer_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_answer_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_answer_fragment_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_answer_fragment_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_contribute_to_place_internal"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text", "p_era_id" "text" DEFAULT NULL::"text", "p_year_exact" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_contribute_to_place_internal"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_place_influence_action_internal"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric DEFAULT NULL::numeric, "p_user_lng" numeric DEFAULT NULL::numeric, "p_target_faction_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_place_influence_action_internal"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_revisit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_revisit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_unlike_contribution_internal"("p_user_id" "text", "p_contribution_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_unlike_contribution_internal"("p_user_id" "text", "p_contribution_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_visit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_visit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_vote_contribution_internal"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."_vote_contribution_internal"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_submission_image"("p_submission_id" "uuid", "p_storage_path" "text", "p_image_url" "text", "p_sort_order" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_submission_images (
    submission_id, storage_path, image_url, sort_order
  ) VALUES (
    p_submission_id, p_storage_path, p_image_url, p_sort_order
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."add_submission_image"("p_submission_id" "uuid", "p_storage_path" "text", "p_image_url" "text", "p_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_tag_to_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO hub_photo_submission_tags (submission_id, tag_id)
  VALUES (p_submission_id, p_tag_id)
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."add_tag_to_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."answer_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_enigma_internal(p_user_id, p_enigma_id, p_answer);
END;
$$;


ALTER FUNCTION "public"."answer_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."answer_fragment_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_fragment_enigma_internal(p_user_id, p_enigma_id, p_answer, p_fragment_id);
END;
$$;


ALTER FUNCTION "public"."answer_fragment_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cheat_refill"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role TEXT;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Vérifier que c'est un admin
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lire les max + bonus faction
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_max_energy + v_bonus_energy,
    'maxEnergy', v_max_energy + v_bonus_energy,
    'conquestPoints', v_max_conquest + v_bonus_conquest,
    'maxConquest', v_max_conquest + v_bonus_conquest,
    'constructionPoints', v_max_construction + v_bonus_construction,
    'maxConstruction', v_max_construction + v_bonus_construction
  );
END;
$$;


ALTER FUNCTION "public"."cheat_refill"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cheat_refill_target"("p_caller_id" "text", "p_target_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role TEXT;
  v_target RECORD;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_caller_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT id, first_name INTO v_target
  FROM users
  WHERE LOWER(regexp_replace(normalize(first_name, NFD), E'[\u0300-\u036F]', '', 'g'))
      = LOWER(regexp_replace(normalize(TRIM(p_target_name), NFD), E'[\u0300-\u036F]', '', 'g'))
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN json_build_object('error', 'Joueur introuvable');
  END IF;

  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = v_target.id;

  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = v_target.id;

  RETURN json_build_object(
    'success', true,
    'targetName', v_target.first_name,
    'targetId', v_target.id
  );
END;
$$;


ALTER FUNCTION "public"."cheat_refill_target"("p_caller_id" "text", "p_target_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_milestone_vues"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_view_count INT;
  v_author_id TEXT;
  v_guardian_id TEXT;
  v_carnet_author RECORD;
  v_notif_data JSONB;
BEGIN
  -- Count total views for this place
  SELECT COUNT(*) INTO v_view_count
  FROM places_viewed WHERE place_id = NEW.place_id;

  -- Only fire on milestone thresholds
  IF v_view_count NOT IN (10, 50, 100, 500) THEN
    RETURN NEW;
  END IF;

  v_notif_data := jsonb_build_object('placeId', NEW.place_id, 'viewCount', v_view_count);

  -- Decouvreur
  SELECT author_id INTO v_author_id FROM places WHERE id = NEW.place_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM notify(v_author_id, 'milestone_vues', v_notif_data);
  END IF;

  -- Gardien
  v_guardian_id := get_place_guardian(NEW.place_id);
  IF v_guardian_id IS NOT NULL AND v_guardian_id != COALESCE(v_author_id, '') THEN
    PERFORM notify(v_guardian_id, 'milestone_vues', v_notif_data);
  END IF;

  -- Auteurs de recits (sauf decouvreur et gardien deja notifies)
  FOR v_carnet_author IN
    SELECT DISTINCT user_id FROM place_contributions
    WHERE place_id = NEW.place_id AND type = 'carnet'
      AND user_id != COALESCE(v_author_id, '')
      AND user_id != COALESCE(v_guardian_id, '')
  LOOP
    PERFORM notify(v_carnet_author.user_id, 'milestone_vues', v_notif_data);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_milestone_vues"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_title_condition"("p_condition" "jsonb", "p_stat_value" integer, "p_rank_value" integer) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Seuil : {"stat": "xxx", "min": N}
  IF p_condition ? 'min' THEN
    RETURN p_stat_value >= (p_condition->>'min')::INT;
  END IF;

  -- Top N : {"stat": "xxx", "rank": N}
  IF p_condition ? 'rank' THEN
    RETURN p_rank_value <= (p_condition->>'rank')::INT;
  END IF;

  -- Classement : {"stat": "xxx", "rank_from": N, "rank_to": M}
  IF p_condition ? 'rank_from' AND p_condition ? 'rank_to' THEN
    RETURN p_rank_value >= (p_condition->>'rank_from')::INT
       AND p_rank_value <= (p_condition->>'rank_to')::INT;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_title_condition"("p_condition" "jsonb", "p_stat_value" integer, "p_rank_value" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_chat_messages"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_chat_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_faction_id TEXT;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Fetch place + actor + faction info for activity_log
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains perso (exploration + erudition) — PAS d'influence content sur le lieu
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3) INTO v_erudition_gain;
  END IF;

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Recalculer les content_points
  PERFORM recalc_place_content_points(p_place_id);

  -- Log activité pour les toasts
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'contributionType', p_type,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'explorationGain', v_exploration_gain,
      'eruditionGain', v_erudition_gain
    ));

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;


ALTER FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text", "p_era_id" "text" DEFAULT NULL::"text", "p_year_exact" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._contribute_to_place_internal(p_user_id, p_place_id, p_type, p_content, p_image_url, p_era_id, p_year_exact);
END;
$$;


ALTER FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_photo_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_submitter_instagram" "text", "p_location_name" "text" DEFAULT NULL::"text", "p_location_zip" "text" DEFAULT NULL::"text", "p_message" "text" DEFAULT NULL::"text", "p_consent_brand" boolean DEFAULT false, "p_consent_account" boolean DEFAULT false, "p_submitter_role" "text" DEFAULT 'client'::"text", "p_product_size" "text" DEFAULT NULL::"text", "p_model_height_cm" numeric DEFAULT NULL::numeric, "p_model_shoulder_width_cm" numeric DEFAULT NULL::numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_photo_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_submitter_instagram" "text", "p_location_name" "text", "p_location_zip" "text", "p_message" "text", "p_consent_brand" boolean, "p_consent_account" boolean, "p_submitter_role" "text", "p_product_size" "text", "p_model_height_cm" numeric, "p_model_shoulder_width_cm" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_photo_tag"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_photo_tags (name)
  VALUES (lower(trim(p_name)))
  ON CONFLICT (name) DO UPDATE SET name = hub_photo_tags.name
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_photo_tag"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT ''::"text", "p_text" "text" DEFAULT ''::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Verify user exists
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Verify tag exists
  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  -- Generate place ID
  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_images := jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url)
    );
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  -- Insert primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (author discovers their own place)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Activity log
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place',
    p_user_id,
    v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name
    )
  );

  RETURN json_build_object('success', true, 'placeId', v_new_id);
END;
$$;


ALTER FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_address" "text", "p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_thumb_url" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT ''::"text", "p_text" "text" DEFAULT ''::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
  v_faction_id TEXT;
  v_influence_gain INT;
  v_content_pts INT;
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

  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place (NO faction_id / claimed_by — old claim system removed)
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  -- Primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (creator sees the place without fog)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- V0.5: Creator gets influence stock reward
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 50)
  INTO v_influence_gain;

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  -- V0.5: Auto-create discoverer's carnet contribution
  v_content_pts := 10; -- text
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10; -- photos bonus (flat)
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    COALESCE(
      (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(v_images) AS img WHERE img->>'url' IS NOT NULL),
      '[]'::jsonb
    ),
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  -- V0.5: Content influence for creator's faction
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_influence (place_id, faction_id, content_points)
    VALUES (v_new_id, v_faction_id, v_content_pts)
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;
  END IF;

  -- Activity log
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'influenceGain', v_influence_gain,
    'contentPoints', v_content_pts
  );
END;
$$;


ALTER FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_thumb_url" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT ''::"text", "p_text" "text" DEFAULT ''::"text", "p_user_lat" numeric DEFAULT NULL::numeric, "p_user_lng" numeric DEFAULT NULL::numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
  v_faction_id TEXT;
  v_influence_gain INT;
  v_content_pts INT;
  v_is_gps     BOOLEAN := FALSE;
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

  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Check if creator is on-site (< 500m)
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_is_gps := haversine_km(p_user_lat, p_user_lng, p_latitude::NUMERIC, p_longitude::NUMERIC) < 0.5;
  END IF;

  -- Auto-discover
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'remote' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Influence bonus: 80pts on-site, 0 remote
  IF v_is_gps THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 80)
    INTO v_influence_gain;
  ELSE
    v_influence_gain := 0;
  END IF;

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  -- Auto-create carnet (always, GPS or not)
  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    COALESCE(
      (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(v_images) AS img WHERE img->>'url' IS NOT NULL),
      '[]'::jsonb
    ),
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  -- Content influence for faction
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_influence (place_id, faction_id, content_points)
    VALUES (v_new_id, v_faction_id, v_content_pts)
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;
  END IF;

  -- Activity log
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name,
      'gps', v_is_gps
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'influenceGain', v_influence_gain,
    'contentPoints', v_content_pts,
    'gps', v_is_gps
  );
END;
$$;


ALTER FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" numeric, "p_user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_thumb_url" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT ''::"text", "p_text" "text" DEFAULT ''::"text", "p_user_lat" real DEFAULT NULL::real, "p_user_lng" real DEFAULT NULL::real, "p_carnet_title" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  -- Déterminer si le joueur est sur place (GPS)
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

  -- Build images JSONB
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  -- Primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Créateur voit le lieu (pas de brouillard)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Exploration de base (GPS ou remote)
  UPDATE users SET exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  IF v_is_gps THEN
    -- GPS : influence PERMANENTE sur le lieu + bonus exploration
    v_influence_gain := 30;

    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;

    INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
    VALUES (v_new_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_gain,
                 updated_at = NOW();

    -- Auto-visite : le créateur sur place est aussi explorateur
    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Auto-create carnet contribution
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

  -- Recalculer les content_points (le nouveau carnet entre dans le classement)
  PERFORM recalc_place_content_points(v_new_id);

  -- Activity log
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
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


ALTER FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text" DEFAULT NULL::"text", "p_thumb_url" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT ''::"text", "p_text" "text" DEFAULT ''::"text", "p_user_lat" real DEFAULT NULL::real, "p_user_lng" real DEFAULT NULL::real, "p_carnet_title" "text" DEFAULT NULL::"text", "p_era_id" "text" DEFAULT NULL::"text", "p_year_exact" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text", "p_era_id" "text", "p_year_exact" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_location_name" "text", "p_location_zip" "text", "p_review_text" "text", "p_rating" integer, "p_purchase_status" "text" DEFAULT 'owner'::"text", "p_consent_account" boolean DEFAULT false, "p_consent_republish" boolean DEFAULT false, "p_image_url" "text" DEFAULT NULL::"text", "p_storage_path" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_review_submissions (
    user_id, submitter_name, submitter_email,
    location_name, location_zip, review_text, rating,
    purchase_status, consent_account, consent_republish,
    image_url, storage_path, status
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email,
    p_location_name, p_location_zip, p_review_text, p_rating,
    p_purchase_status, p_consent_account, p_consent_republish,
    p_image_url, p_storage_path, 'pending'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_review_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_location_name" "text", "p_location_zip" "text", "p_review_text" "text", "p_rating" integer, "p_purchase_status" "text", "p_consent_account" boolean, "p_consent_republish" boolean, "p_image_url" "text", "p_storage_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text" DEFAULT NULL::"text", "p_location_zip" "text" DEFAULT NULL::"text") RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');
  RETURN p_id;
END;
$$;


ALTER FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text", "p_location_zip" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decay_placed_influence"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."decay_placed_influence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_carnet"("p_user_id" "text", "p_place_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Vérifier que l'appelant est bien le propriétaire
  IF auth.uid()::TEXT != p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  DELETE FROM place_contributions
  WHERE user_id = p_user_id
    AND place_id = p_place_id
    AND type = 'carnet';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."delete_carnet"("p_user_id" "text", "p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_photo_submission"("p_submission_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM hub_submission_images WHERE submission_id = p_submission_id;
  DELETE FROM hub_photo_submissions WHERE id = p_submission_id;
END;
$$;


ALTER FUNCTION "public"."delete_photo_submission"("p_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_photo_tag"("p_tag_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM hub_photo_tags WHERE id = p_tag_id;
END;
$$;


ALTER FUNCTION "public"."delete_photo_tag"("p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_place"("p_user_id" "text", "p_place_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_author_id TEXT;
  v_user_role TEXT;
BEGIN
  -- Verifier que le lieu existe et recuperer l'auteur
  SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
  IF v_author_id IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier les droits : auteur ou admin
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  IF v_author_id != p_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- Nettoyer activity_log (FK sans CASCADE)
  DELETE FROM activity_log WHERE place_id = p_place_id;

  -- Supprimer (CASCADE sur toutes les tables liees)
  DELETE FROM places WHERE id = p_place_id;

  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."delete_place"("p_user_id" "text", "p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_review_submission"("p_review_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM hub_review_submissions WHERE id = p_review_id;
END;
$$;


ALTER FUNCTION "public"."delete_review_submission"("p_review_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discover_place"("p_user_id" "text", "p_place_id" "text", "p_method" "text" DEFAULT 'remote'::"text", "p_user_lat" numeric DEFAULT NULL::numeric, "p_user_lng" numeric DEFAULT NULL::numeric, "p_free" boolean DEFAULT false, "p_glory_mult" numeric DEFAULT 1) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_exploration_gain INT;
  v_gps_bonus INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_m NUMERIC;
  v_method TEXT;
  v_proximity_m NUMERIC := 500;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  -- Récupérer les coordonnées du lieu
  SELECT latitude, longitude INTO v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Déterminer la méthode côté SERVEUR (ne pas faire confiance au client)
  v_method := 'remote';
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    -- Haversine simplifié en mètres
    v_distance_m := 6371000 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_place_lat - p_user_lat) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(v_place_lat)) *
      POWER(SIN(RADIANS(v_place_lng - p_user_lng) / 2), 2)
    ));
    IF v_distance_m <= v_proximity_m THEN
      v_method := 'gps';
    END IF;
  END IF;

  -- Calculer le coût
  IF p_free THEN
    v_cost := 0;
  ELSIF v_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Remote : coût en énergie basé sur la distance
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, v_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Exploration : GPS = +10 (bonus sur place), remote/free = +1 (bonus découverte)
  IF v_method = 'gps' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := 1;
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;


ALTER FUNCTION "public"."discover_place"("p_user_id" "text", "p_place_id" "text", "p_method" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_free" boolean, "p_glory_mult" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."distance_multiplier"("distance_km" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_gps NUMERIC;
  v_close NUMERIC;
  v_mid NUMERIC;
  v_mult_gps NUMERIC;
  v_mult_close NUMERIC;
  v_mult_mid NUMERIC;
  v_mult_far NUMERIC;
BEGIN
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_gps_km'), 0.5) INTO v_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_close_km'), 10) INTO v_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mid_km'), 50) INTO v_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_gps'), 0.5) INTO v_mult_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_close'), 1) INTO v_mult_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_mid'), 2) INTO v_mult_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_far'), 3) INTO v_mult_far;

  RETURN CASE
    WHEN distance_km < v_gps THEN v_mult_gps
    WHEN distance_km < v_close THEN v_mult_close
    WHEN distance_km < v_mid THEN v_mult_mid
    ELSE v_mult_far
  END;
END;
$$;


ALTER FUNCTION "public"."distance_multiplier"("distance_km" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_fragments"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_all_fragments"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_player_titles"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_is_admin BOOLEAN;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
  v_stats JSON;
  v_discoveries INT;
  v_claims INT;
  v_notoriety INT;
  v_likes INT;
  v_fortifications INT;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id, (role = 'admin')
  INTO v_displayed, v_faction_id, v_is_admin
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  v_discoveries := COALESCE((v_titles_data->'stats'->>'discoveries')::INT, 0);
  v_claims := COALESCE((v_titles_data->'stats'->>'claims')::INT, 0);
  v_notoriety := COALESCE((v_titles_data->'stats'->>'notoriety')::INT, 0);
  v_likes := COALESCE((v_titles_data->'stats'->>'likes')::INT, 0);
  v_fortifications := COALESCE((v_titles_data->'stats'->>'fortifications')::INT, 0);

  v_stats := json_build_object(
    'discoveries', v_discoveries,
    'claims', v_claims,
    'notoriety', v_notoriety,
    'likes', v_likes,
    'fortifications', v_fortifications
  );

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
      t.condition,
      EXISTS (SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem WHERE (elem->>'id')::INT = t.id) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
        t.condition,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.icon_url, tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
    WHERE tf.visible = true OR v_is_admin = true
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed,
    'stats', v_stats
  );
END;
$$;


ALTER FUNCTION "public"."get_all_player_titles"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_construction_types"() RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COALESCE(json_agg(row_to_json(ct) ORDER BY ct.level), '[]'::json)
  FROM construction_types ct;
$$;


ALTER FUNCTION "public"."get_construction_types"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_enigma"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_daily_enigma"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_faction_members"("p_faction_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_faction_members"("p_faction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_faction_tag_reduction"("p_user_id" "text", "p_place_id" "text") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    (SELECT ftb.cost_reduction
     FROM faction_tag_bonuses ftb
     JOIN users u ON u.faction_id = ftb.faction_id
     JOIN place_tags pt ON pt.tag_id = ftb.tag_id AND pt.is_primary = TRUE
     WHERE u.id = p_user_id AND pt.place_id = p_place_id
     LIMIT 1),
    0
  );
$$;


ALTER FUNCTION "public"."get_faction_tag_reduction"("p_user_id" "text", "p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_fragment_enigma"("p_user_id" "text", "p_fragment_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_fragment_enigma"("p_user_id" "text", "p_fragment_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard"("p_type" "text", "p_limit" integer DEFAULT 50) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_leaderboard"("p_type" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_map_places"("p_type" "text" DEFAULT 'all'::"text", "p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_latitude_delta" double precision DEFAULT NULL::double precision, "p_longitude_delta" double precision DEFAULT NULL::double precision, "p_limit" integer DEFAULT 100, "p_user_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_map_places"("p_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_latitude_delta" double precision, "p_longitude_delta" double precision, "p_limit" integer, "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_fragment_status"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_my_fragment_status"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_informations"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_my_informations"("p_user_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."hub_photo_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(255),
    "submitter_name" "text" NOT NULL,
    "submitter_email" "text" NOT NULL,
    "submitter_instagram" "text",
    "message" "text",
    "consent_brand_usage" boolean DEFAULT false NOT NULL,
    "consent_account_creation" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "moderated_by" character varying(255),
    "moderated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "submitter_role" "text" DEFAULT 'client'::"text",
    "location_name" "text",
    "location_zip" "text",
    "product_size" "text",
    "model_height_cm" numeric,
    "model_shoulder_width_cm" numeric,
    "product_worn" "text",
    CONSTRAINT "hub_photo_submissions_message_check" CHECK (("char_length"("message") <= 500)),
    CONSTRAINT "hub_photo_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'archived'::"text"]))),
    CONSTRAINT "hub_photo_submissions_submitter_role_check" CHECK (("submitter_role" = ANY (ARRAY['client'::"text", 'ambassadeur'::"text", 'partenaire'::"text"])))
);


ALTER TABLE "public"."hub_photo_submissions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_photo_submissions"("p_status" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."hub_photo_submissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_photo_submissions ORDER BY created_at DESC LIMIT 100;
  ELSE
    RETURN QUERY SELECT * FROM hub_photo_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 100;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_photo_submissions"("p_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_photo_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hub_photo_tags" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_photo_tags"() RETURNS SETOF "public"."hub_photo_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM hub_photo_tags ORDER BY name;
END;
$$;


ALTER FUNCTION "public"."get_photo_tags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_place_by_id"("p_id" "text", "p_user_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_place_by_id"("p_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_place_detail_v05"("p_place_id" "text", "p_user_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_place_detail_v05"("p_place_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_place_guardian"("p_place_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_guardian TEXT;
BEGIN
  SELECT user_id INTO v_guardian
  FROM place_contributions
  WHERE place_id = p_place_id AND type = 'carnet'
  ORDER BY votes_up DESC, created_at ASC
  LIMIT 1;
  RETURN v_guardian;
END;
$$;


ALTER FUNCTION "public"."get_place_guardian"("p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_player_profile"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_player_profile"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_random_ad"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_random_ad"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_activity"("p_limit" integer DEFAULT 20) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_recent_activity"("p_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_review_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(255),
    "submitter_name" "text" NOT NULL,
    "submitter_email" "text" NOT NULL,
    "location_name" "text" NOT NULL,
    "location_zip" "text" NOT NULL,
    "review_text" "text" NOT NULL,
    "rating" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "moderated_by" character varying(255),
    "moderated_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "purchase_status" "text" DEFAULT 'owner'::"text",
    "consent_account" boolean DEFAULT false NOT NULL,
    "consent_republish" boolean DEFAULT false NOT NULL,
    "image_url" "text",
    "storage_path" "text",
    CONSTRAINT "hub_review_submissions_purchase_status_check" CHECK (("purchase_status" = ANY (ARRAY['owner'::"text", 'planning'::"text", 'no'::"text"]))),
    CONSTRAINT "hub_review_submissions_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "hub_review_submissions_review_text_check" CHECK (("char_length"("review_text") <= 2000)),
    CONSTRAINT "hub_review_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."hub_review_submissions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_review_submissions"("p_status" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."hub_review_submissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_review_submissions ORDER BY created_at DESC LIMIT 50;
  ELSE
    RETURN QUERY SELECT * FROM hub_review_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 50;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_review_submissions"("p_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_submission_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hub_submission_images" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_submission_images"("p_submission_id" "uuid") RETURNS SETOF "public"."hub_submission_images"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM hub_submission_images WHERE submission_id = p_submission_id ORDER BY sort_order;
END;
$$;


ALTER FUNCTION "public"."get_submission_images"("p_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_submission_images_batch"("p_submission_ids" "uuid"[]) RETURNS SETOF "public"."hub_submission_images"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM hub_submission_images WHERE submission_id = ANY(p_submission_ids) ORDER BY sort_order;
END;
$$;


ALTER FUNCTION "public"."get_submission_images_batch"("p_submission_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_submission_tags_batch"("p_submission_ids" "uuid"[]) RETURNS TABLE("submission_id" "uuid", "tag_id" "uuid", "tag_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    SELECT pst.submission_id, t.id AS tag_id, t.name AS tag_name
    FROM hub_photo_submission_tags pst
    INNER JOIN hub_photo_tags t ON t.id = pst.tag_id
    WHERE pst.submission_id = ANY(p_submission_ids)
    ORDER BY t.name;
END;
$$;


ALTER FUNCTION "public"."get_submission_tags_batch"("p_submission_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_territory_votes"("p_anchor_place_id" "text", "p_user_id" "text", "p_blob_place_ids" "text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- 1. Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- 2. Supprimer les votes sur des propositions orphelines
  --    (propositions dont l'auteur n'est plus de la faction du territoire)
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u_proposer
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- 3. Supprimer les propositions orphelines elles-memes
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions (seulement celles dont l'auteur est de la bonne faction)
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

  -- Votes utilises (tout ce qui reste apres nettoyage est valide)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;


ALTER FUNCTION "public"."get_territory_votes"("p_anchor_place_id" "text", "p_user_id" "text", "p_blob_place_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_underdog_faction_id"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_enabled BOOLEAN;
  v_faction_id TEXT;
  v_active_count INT;
BEGIN
  -- Verifier si le systeme est active
  SELECT (value = 'true') INTO v_enabled
  FROM app_settings WHERE key = 'underdog_enabled';

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NULL;
  END IF;

  -- Compter les factions actives (au moins 1 lieu)
  SELECT COUNT(DISTINCT faction_id) INTO v_active_count
  FROM places
  WHERE faction_id IS NOT NULL AND claimed_at IS NOT NULL;

  IF v_active_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Faction avec le score le plus bas
  SELECT f.id INTO v_faction_id
  FROM factions f
  INNER JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
  GROUP BY f.id
  ORDER BY COALESCE(SUM(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
    * (1 + p.fortification_level * 0.5)
  ), 0) ASC
  LIMIT 1;

  RETURN v_faction_id;
END;
$$;


ALTER FUNCTION "public"."get_underdog_faction_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_avatar"("p_user_id" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT avatar_url FROM users WHERE id = p_user_id;
$$;


ALTER FUNCTION "public"."get_user_avatar"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_discoveries"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(place_id) INTO v_result
  FROM places_discovered
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_user_discoveries"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_energy"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  v_energy_cycle := GREATEST(600, (v_base_energy_cycle * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy (FIX: avancer energy_reset_at même au max)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_ticks > 0 THEN
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_energy := LEAST(v_energy + v_add, v_max_energy);
    END IF;
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_ticks > 0 THEN
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    END IF;
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_ticks > 0 THEN
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_construction := LEAST(v_construction + v_add, v_max_construction);
    END IF;
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite (FIX: même pattern)
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_ticks > 0 THEN
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    IF v_add > 0 THEN
      v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    END IF;
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;


ALTER FUNCTION "public"."get_user_energy"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_fragments"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_fragments"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_titles"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_titles"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_winning_territory_names"() RETURNS TABLE("anchor_place_id" "text", "winning_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  WITH scores AS (
    SELECT
      p.anchor_place_id,
      p.name,
      COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    GROUP BY p.anchor_place_id, p.id, p.name
  ),
  ranked AS (
    SELECT
      anchor_place_id,
      name,
      net_score,
      RANK() OVER (PARTITION BY anchor_place_id ORDER BY net_score DESC) AS rnk
    FROM scores
  ),
  top_ranked AS (
    SELECT
      anchor_place_id,
      name,
      COUNT(*) OVER (PARTITION BY anchor_place_id) AS tied_count
    FROM ranked
    WHERE rnk = 1
  )
  SELECT
    anchor_place_id,
    CASE WHEN tied_count > 1 THEN NULL ELSE name END AS winning_name
  FROM top_ranked
  GROUP BY anchor_place_id, tied_count, name;
$$;


ALTER FUNCTION "public"."get_winning_territory_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;


ALTER FUNCTION "public"."haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_claim_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."log_claim_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_discover_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'discover',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_discover_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_explore_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_place_title TEXT;
  v_actor_name TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
BEGIN
  SELECT title, latitude, longitude
  INTO v_place_title, v_lat, v_lng
  FROM places WHERE id = NEW.place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un')
  INTO v_actor_name
  FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'explore',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name,
      'placeLatitude', v_lat,
      'placeLongitude', v_lng
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_explore_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_like_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'like',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_like_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_new_user_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."log_new_user_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notifications_read"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications SET read = TRUE
  WHERE recipient_id = p_user_id AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'markedRead', v_count);
END;
$$;


ALTER FUNCTION "public"."mark_notifications_read"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_user_to_auth_id"("p_old_id" "text", "p_new_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_err TEXT;
BEGIN
  -- Securite : seul l'utilisateur authentifie peut migrer son propre compte
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Verifier que l'ancien user existe
  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  -- Verifier qu'un user avec le nouvel ID n'existe pas deja
  -- (sauf les ghosts __migrated_ qu'on va supprimer)
  DELETE FROM public.users
  WHERE id = p_new_id
    AND (email_address LIKE '__migrated_%' OR email_address = '');

  -- Vider l'email et shopify_customer_id de l'ancien pour liberer les index uniques
  UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = p_old_id;

  -- Inserer le nouveau user avec copie complete
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
    p_new_id,
    v_email,
    first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, NOW()
  FROM public.users WHERE id = p_old_id
  ON CONFLICT (id) DO NOTHING;

  -- Migrer TOUTES les FK
  UPDATE places_discovered SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE place_claims SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE chat_messages SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_viewed SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_liked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_explored SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_bookmarked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE reviews SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE image_media SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE member_codes SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_photo_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_review_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_photo_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_review_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE places SET author_id = p_new_id WHERE author_id = p_old_id;
  UPDATE places SET claimed_by = p_new_id WHERE claimed_by = p_old_id;
  UPDATE activity_log SET actor_id = p_new_id WHERE actor_id = p_old_id;
  UPDATE place_claims SET previous_claimed_by = p_new_id WHERE previous_claimed_by = p_old_id;
  -- Tables ajoutees apres 078
  UPDATE territory_name_proposals SET proposed_by = p_new_id WHERE proposed_by = p_old_id;
  UPDATE territory_name_votes SET voter_id = p_new_id WHERE voter_id = p_old_id;
  UPDATE user_fragments SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE fragment_ability_uses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE purchase_log SET user_id = p_new_id WHERE user_id = p_old_id;

  -- Supprimer l'ancien
  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$$;


ALTER FUNCTION "public"."migrate_user_to_auth_id"("p_old_id" "text", "p_new_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_review_submissions
  SET status = p_status,
      moderated_at = NOW(),
      rejection_reason = p_rejection_reason
  WHERE id = p_review_id;
END;
$$;


ALTER FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET status = p_status,
      moderated_at = NOW()
  WHERE id = p_submission_id;
END;
$$;


ALTER FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify"("p_recipient" "text", "p_type" "text", "p_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Ne pas notifier soi-meme
  IF p_recipient IS NULL THEN RETURN; END IF;

  INSERT INTO notifications (recipient_id, type, data)
  VALUES (p_recipient, p_type, p_data);

  DELETE FROM notifications WHERE id IN (
    SELECT id FROM notifications WHERE recipient_id = p_recipient
    ORDER BY created_at DESC OFFSET 50
  );
END;
$$;


ALTER FUNCTION "public"."notify"("p_recipient" "text", "p_type" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_exploration"("p_recipient" "text", "p_place_id" "text", "p_visitor_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_existing_id INT;
  v_current_count INT;
BEGIN
  IF p_recipient IS NULL THEN RETURN; END IF;

  -- Chercher une notif exploration non lue pour ce lieu aujourd'hui
  SELECT id, COALESCE((data->>'visitorsToday')::INT, 1)
  INTO v_existing_id, v_current_count
  FROM notifications
  WHERE recipient_id = p_recipient
    AND type = 'exploration'
    AND (data->>'placeId') = p_place_id
    AND read = FALSE
    AND created_at::DATE = CURRENT_DATE
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Upsert : incrementer le compteur
    UPDATE notifications
    SET data = data || jsonb_build_object(
      'visitorsToday', v_current_count + 1,
      'lastVisitorName', p_visitor_name
    ),
    created_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    PERFORM notify(p_recipient, 'exploration', jsonb_build_object(
      'placeId', p_place_id,
      'visitorsToday', 1,
      'lastVisitorName', p_visitor_name
    ));
  END IF;
END;
$$;


ALTER FUNCTION "public"."notify_exploration"("p_recipient" "text", "p_place_id" "text", "p_visitor_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_influence_action"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric DEFAULT NULL::numeric, "p_user_lng" numeric DEFAULT NULL::numeric, "p_target_faction_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._place_influence_action_internal(p_user_id, p_place_id, p_points, p_user_lat, p_user_lng, p_target_faction_id);
END;
$$;


ALTER FUNCTION "public"."place_influence_action"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_influence_score"("p_place_id" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0) * 1
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 3
    + CASE COALESCE((SELECT fortification_level FROM places WHERE id = p_place_id), 0)
        WHEN 1 THEN 10
        WHEN 2 THEN 20
        WHEN 3 THEN 30
        WHEN 4 THEN 60
        ELSE 0
      END
  ))::int;
$$;


ALTER FUNCTION "public"."place_influence_score"("p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_action_cost"("p_user_id" "text", "p_place_id" "text", "p_action" "text", "p_user_lat" numeric DEFAULT NULL::numeric, "p_user_lng" numeric DEFAULT NULL::numeric, "p_fortify_level" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_detection_radius NUMERIC;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_preview INT;
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10) INTO v_detection_radius;

    IF v_place_faction IS NOT NULL AND v_zone_multiplier > 0 THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2
      WHERE p2.faction_id = v_place_faction
        AND p2.id != p_place_id
        AND p2.fortification_level > 0
        AND sqrt(pow((p2.latitude - v_place_lat) * 111, 2) + pow((p2.longitude - v_place_lng) * 79, 2)) <= v_detection_radius;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
  END IF;

  -- Fortification (fortify)
  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  -- Projection Gloire
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key =
    CASE p_action WHEN 'discover' THEN 'glory_discover' WHEN 'claim' THEN 'glory_claim' WHEN 'fortify' THEN 'glory_fortify' END
  ), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_preview := GREATEST(1, ROUND(v_glory_base + v_total * v_glory_cost_pct / 100));

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'gloryPreview', v_glory_preview,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', 0
    )
  );
END;
$$;


ALTER FUNCTION "public"."preview_action_cost"("p_user_id" "text", "p_place_id" "text", "p_action" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_fortify_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propose_territory_name"("p_user_id" "text", "p_anchor_place_id" "text", "p_name" "text", "p_blob_place_ids" "text"[] DEFAULT '{}'::"text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_faction_id TEXT;
  v_place_faction TEXT;
BEGIN
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Faction du joueur
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    SELECT faction_id INTO v_place_faction
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
    GROUP BY faction_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_anchor_place_id;
  END IF;

  IF v_faction_id IS NULL OR v_faction_id != v_place_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si necessaire
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


ALTER FUNCTION "public"."propose_territory_name"("p_user_id" "text", "p_anchor_place_id" "text", "p_name" "text", "p_blob_place_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_place"("p_user_id" "text", "p_place_id" "text", "p_rating" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_explorer BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  -- Vérifier que le joueur est explorateur OU auteur du lieu
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_is_explorer;

  SELECT EXISTS(SELECT 1 FROM places WHERE id = p_place_id AND author_id = p_user_id)
  INTO v_is_author;

  IF NOT v_is_explorer AND NOT v_is_author THEN
    RETURN json_build_object('error', 'must_be_explorer');
  END IF;

  INSERT INTO place_ratings (place_id, user_id, rating)
  VALUES (p_place_id, p_user_id, p_rating)
  ON CONFLICT (place_id, user_id)
  DO UPDATE SET rating = p_rating, updated_at = NOW();

  RETURN json_build_object('success', true,
    'avgRating', (SELECT AVG(rating)::NUMERIC(2,1) FROM place_ratings WHERE place_id = p_place_id),
    'count', (SELECT COUNT(*) FROM place_ratings WHERE place_id = p_place_id));
END;
$$;


ALTER FUNCTION "public"."rate_place"("p_user_id" "text", "p_place_id" "text", "p_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_place_content_points"("p_place_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."recalc_place_content_points"("p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_tag_from_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM hub_photo_submission_tags 
  WHERE submission_id = p_submission_id AND tag_id = p_tag_id;
END;
$$;


ALTER FUNCTION "public"."remove_tag_from_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_faction"("p_old_id" "text", "p_new_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verifier que l'ancien ID existe
  IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_old_id) THEN
    RETURN json_build_object('error', 'Faction not found');
  END IF;

  -- Verifier que le nouvel ID n'existe pas deja
  IF EXISTS(SELECT 1 FROM factions WHERE id = p_new_id) THEN
    RETURN json_build_object('error', 'ID already exists');
  END IF;

  -- 1. Inserer la nouvelle faction (copie de l'ancienne)
  INSERT INTO factions (id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, updated_at)
  SELECT p_new_id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, NOW()
  FROM factions WHERE id = p_old_id;

  -- 2. Mettre a jour toutes les references
  UPDATE users SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE places SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE place_claims SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE activity_log SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE chat_messages SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE titles SET faction_id = p_new_id WHERE faction_id = p_old_id;

  -- 3. Supprimer l'ancienne faction
  DELETE FROM factions WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'newId', p_new_id);
END;
$$;


ALTER FUNCTION "public"."rename_faction"("p_old_id" "text", "p_new_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_place"("p_user_id" "text", "p_place_id" "text", "p_title" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_has_carnet BOOLEAN;
  v_trimmed TEXT;
BEGIN
  -- Vérifier que l'appelant est bien le joueur
  IF auth.uid()::TEXT != p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  v_trimmed := TRIM(p_title);

  -- Validation
  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN json_build_object('error', 'empty_title');
  END IF;

  IF LENGTH(v_trimmed) > 255 THEN
    RETURN json_build_object('error', 'title_too_long');
  END IF;

  -- Vérifier que le joueur a un carnet sur ce lieu
  SELECT EXISTS(
    SELECT 1 FROM place_contributions
    WHERE place_id = p_place_id AND user_id = p_user_id AND type = 'carnet'
  ) INTO v_has_carnet;

  IF NOT v_has_carnet THEN
    RETURN json_build_object('error', 'must_have_carnet');
  END IF;

  UPDATE places
  SET title = v_trimmed, updated_at = NOW()
  WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$$;


ALTER FUNCTION "public"."rename_place"("p_user_id" "text", "p_place_id" "text", "p_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revisit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._revisit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;


ALTER FUNCTION "public"."revisit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_displayed_titles"("p_user_id" "text", "p_title_ids" integer[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Max 2 titres generaux
  IF array_length(p_title_ids, 1) > 2 THEN
    RETURN json_build_object('error', 'Maximum 2 titres generaux');
  END IF;

  -- Valider que les IDs sont des titres generaux existants
  IF p_title_ids IS NOT NULL AND array_length(p_title_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_title_ids) tid
      WHERE NOT EXISTS (SELECT 1 FROM titles WHERE id = tid AND type = 'general')
    ) THEN
      RETURN json_build_object('error', 'Titre invalide');
    END IF;
  END IF;

  UPDATE users
  SET displayed_general_title_ids = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."set_displayed_titles"("p_user_id" "text", "p_title_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_displayed_titles_v3"("p_user_id" "text", "p_title_ids" integer[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF array_length(p_title_ids, 1) > 3 THEN
    RETURN json_build_object('error', 'Maximum 3 titres');
  END IF;

  UPDATE users
  SET displayed_title_ids_v3 = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."set_displayed_titles_v3"("p_user_id" "text", "p_title_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_faction"("p_user_id" "text", "p_faction_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."set_user_faction"("p_user_id" "text", "p_faction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."territory_radius_km"("p_score" integer) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_score <= 0 THEN 0.0
    WHEN p_score <= 1 THEN 0.25 * 0.6
    ELSE (0.25 + sqrt(p_score - 1) * 0.65) * 0.6
  END;
$$;


ALTER FUNCTION "public"."territory_radius_km"("p_score" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_wishlist"("p_user_id" "text", "p_place_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_exists;

  IF v_exists THEN
    DELETE FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id;
    RETURN json_build_object('wishlisted', false);
  ELSE
    INSERT INTO place_wishlist (place_id, user_id) VALUES (p_place_id, p_user_id);
    RETURN json_build_object('wishlisted', true);
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_wishlist"("p_user_id" "text", "p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlike_contribution"("p_user_id" "text", "p_contribution_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._unlike_contribution_internal(p_user_id, p_contribution_id);
END;
$$;


ALTER FUNCTION "public"."unlike_contribution"("p_user_id" "text", "p_contribution_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlock_pending_fragments"("p_user_id" "text", "p_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id, unlock_ref_id
    FROM purchase_log
    WHERE email = p_email
      AND status = 'pending'
      AND unlock_type = 'fragment'
  LOOP
    -- Inserer le fragment (ignore si deja present)
    INSERT INTO user_fragments (user_id, fragment_id, source)
    VALUES (p_user_id, v_row.unlock_ref_id, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;

    -- Mettre a jour le log
    UPDATE purchase_log
    SET user_id = p_user_id, status = 'unlocked'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."unlock_pending_fragments"("p_user_id" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile"("p_user_id" "text", "p_first_name" "text" DEFAULT NULL::"text", "p_bio" "text" DEFAULT NULL::"text", "p_instagram" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_game_mode" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_my_profile"("p_user_id" "text", "p_first_name" "text", "p_bio" "text", "p_instagram" "text", "p_avatar_url" "text", "p_game_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_submission_message"("p_submission_id" "uuid", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET message = p_message
  WHERE id = p_submission_id;
END;
$$;


ALTER FUNCTION "public"."update_submission_message"("p_submission_id" "uuid", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_submission_product_worn"("p_submission_id" "uuid", "p_product_worn" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET product_worn = p_product_worn
  WHERE id = p_submission_id;
END;
$$;


ALTER FUNCTION "public"."update_submission_product_worn"("p_submission_id" "uuid", "p_product_worn" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."visit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._visit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;


ALTER FUNCTION "public"."visit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_contribution"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._vote_contribution_internal(p_user_id, p_contribution_id, p_vote);
END;
$$;


ALTER FUNCTION "public"."vote_contribution"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_territory_name"("p_user_id" "text", "p_proposal_id" "uuid", "p_value" smallint, "p_blob_place_ids" "text"[], "p_anchor_place_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_total_used      INT;
  v_winning         TEXT;
  v_tied            BOOLEAN;
  v_net             INT;
BEGIN
  -- Eligibilite par faction
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  IF v_user_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Vote power = 1 (base faction) + lieux revendiques
  SELECT COUNT(*) INTO v_claimed_count
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  v_vote_power := 1 + v_claimed_count;

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

  -- Valider que le total utilise ne depasse pas le vote power
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_total_used
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  IF v_total_used > v_vote_power THEN
    -- Rollback : remettre l'ancien vote ou supprimer
    -- On supprime le vote qu'on vient de mettre pour revenir a l'etat precedent
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
  winners AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votee
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


ALTER FUNCTION "public"."vote_territory_name"("p_user_id" "text", "p_proposal_id" "uuid", "p_value" smallint, "p_blob_place_ids" "text"[], "p_anchor_place_id" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" integer NOT NULL,
    "type" character varying(30) NOT NULL,
    "actor_id" character varying(255),
    "place_id" character varying(255),
    "faction_id" character varying(255),
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."activity_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."activity_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."activity_log_id_seq" OWNED BY "public"."activity_log"."id";



CREATE TABLE IF NOT EXISTS "public"."ad_screens" (
    "id" integer NOT NULL,
    "image_url" "text" NOT NULL,
    "product_url" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "linked_tip_id" integer
);


ALTER TABLE "public"."ad_screens" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ad_screens_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ad_screens_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ad_screens_id_seq" OWNED BY "public"."ad_screens"."id";



CREATE TABLE IF NOT EXISTS "public"."ad_tips" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "tag" character varying(30) DEFAULT 'astuce'::character varying NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ad_tips_tag_check" CHECK ((("tag")::"text" = ANY ((ARRAY['astuce'::character varying, 'anecdote'::character varying])::"text"[])))
);


ALTER TABLE "public"."ad_tips" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ad_tips_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ad_tips_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ad_tips_id_seq" OWNED BY "public"."ad_tips"."id";



CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" bigint NOT NULL,
    "channel" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "user_name" character varying(255) NOT NULL,
    "faction_id" character varying(255),
    "faction_color" character varying(50),
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "faction_pattern" "text",
    CONSTRAINT "chat_messages_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 500)))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chat_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chat_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chat_messages_id_seq" OWNED BY "public"."chat_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."construction_types" (
    "level" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image_url" "text",
    "cost" integer DEFAULT 1 NOT NULL,
    "conquest_bonus" integer DEFAULT 1 NOT NULL,
    "tag_ids" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."construction_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contribution_votes" (
    "id" integer NOT NULL,
    "contribution_id" integer NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "vote" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contribution_votes_vote_check" CHECK (("vote" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."contribution_votes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."contribution_votes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."contribution_votes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."contribution_votes_id_seq" OWNED BY "public"."contribution_votes"."id";



CREATE TABLE IF NOT EXISTS "public"."enigma_responses" (
    "id" integer NOT NULL,
    "enigma_id" integer NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "answer_given" "text" NOT NULL,
    "correct" boolean NOT NULL,
    "influence_gained" integer DEFAULT 0 NOT NULL,
    "erudition_gained" integer DEFAULT 0 NOT NULL,
    "responded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enigma_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enigmas" (
    "id" integer NOT NULL,
    "type" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "heritage_id" character varying(255),
    "place_tag" "text",
    "lore_text" "text" NOT NULL,
    "question" "text" NOT NULL,
    "format" "text" NOT NULL,
    "choices" "jsonb",
    "answer" "text" NOT NULL,
    "explanation" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fragment_id" integer,
    CONSTRAINT "enigmas_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['very_easy'::"text", 'easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "enigmas_format_check" CHECK (("format" = ANY (ARRAY['qcm'::"text", 'free'::"text"]))),
    CONSTRAINT "enigmas_type_check" CHECK (("type" = ANY (ARRAY['daily'::"text", 'place'::"text", 'fragment'::"text"])))
);


ALTER TABLE "public"."enigmas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."daily_enigma_status" AS
 SELECT "er"."user_id",
    ("er"."responded_at")::"date" AS "response_date",
    "er"."correct",
    "er"."enigma_id"
   FROM ("public"."enigma_responses" "er"
     JOIN "public"."enigmas" "e" ON (("e"."id" = "er"."enigma_id")))
  WHERE ("e"."type" = 'daily'::"text");


ALTER VIEW "public"."daily_enigma_status" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."enigma_responses_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."enigma_responses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."enigma_responses_id_seq" OWNED BY "public"."enigma_responses"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."enigmas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."enigmas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."enigmas_id_seq" OWNED BY "public"."enigmas"."id";



CREATE TABLE IF NOT EXISTS "public"."eras" (
    "id" character varying NOT NULL,
    "name" character varying NOT NULL,
    "year_start" integer,
    "year_end" integer,
    "sort_order" smallint NOT NULL
);


ALTER TABLE "public"."eras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faction_tag_bonuses" (
    "faction_id" character varying(255) NOT NULL,
    "tag_id" character varying(255) NOT NULL,
    "cost_reduction" numeric(5,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."faction_tag_bonuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factions" (
    "id" character varying(255) NOT NULL,
    "title" character varying(255) NOT NULL,
    "color" character varying(255) DEFAULT '#C19A6B'::character varying NOT NULL,
    "pattern" character varying(255),
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "image_url" "text",
    "bonus_energy" numeric(4,1) DEFAULT 0 NOT NULL,
    "bonus_conquest" numeric(6,1) DEFAULT 0 NOT NULL,
    "bonus_construction" numeric(6,1) DEFAULT 0 NOT NULL,
    "bonus_regen" numeric(4,1) DEFAULT 0 NOT NULL,
    "bonus_regen_energy" numeric(4,1) DEFAULT 0 NOT NULL,
    "bonus_regen_conquest" numeric(4,1) DEFAULT 0 NOT NULL,
    "bonus_regen_construction" numeric(4,1) DEFAULT 0 NOT NULL,
    "bonus_vitalite" numeric(6,1) DEFAULT 0,
    "bonus_regen_vitalite" numeric(4,1) DEFAULT 0,
    "adjective" character varying DEFAULT ''::character varying
);


ALTER TABLE "public"."factions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragment_ability_uses" (
    "user_id" character varying(255) NOT NULL,
    "fragment_id" integer NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fragment_ability_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragment_tag_affinities" (
    "fragment_id" integer NOT NULL,
    "tag_id" character varying(255) NOT NULL,
    "bonus_points" integer DEFAULT 3 NOT NULL
);


ALTER TABLE "public"."fragment_tag_affinities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragment_words" (
    "id" integer NOT NULL,
    "fragment_id" integer NOT NULL,
    "word" character varying(100) NOT NULL,
    "slot" character varying(30) NOT NULL,
    "gender" character varying(10) DEFAULT 'n'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fragment_words_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['m'::character varying, 'f'::character varying, 'n'::character varying])::"text"[]))),
    CONSTRAINT "fragment_words_slot_check" CHECK ((("slot")::"text" = ANY ((ARRAY['nom'::character varying, 'epithete'::character varying, 'connecteur'::character varying])::"text"[])))
);


ALTER TABLE "public"."fragment_words" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fragment_words_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fragment_words_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fragment_words_id_seq" OWNED BY "public"."fragment_words"."id";



CREATE TABLE IF NOT EXISTS "public"."hub_community_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(255),
    "user_email" "text",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "moderated_by" character varying(255),
    "moderated_at" timestamp with time zone,
    "rejection_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hub_community_photos_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."hub_community_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hub_photo_submission_tags" (
    "submission_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."hub_photo_submission_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_media" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "variants" "jsonb" NOT NULL
);


ALTER TABLE "public"."image_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_codes" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255),
    "code" character varying(255) NOT NULL,
    "is_consumed" boolean NOT NULL
);


ALTER TABLE "public"."member_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mikro_orm_migrations" (
    "id" integer NOT NULL,
    "name" character varying(255),
    "executed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."mikro_orm_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mikro_orm_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mikro_orm_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mikro_orm_migrations_id_seq" OWNED BY "public"."mikro_orm_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" integer NOT NULL,
    "recipient_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notifications_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notifications_id_seq" OWNED BY "public"."notifications"."id";



CREATE TABLE IF NOT EXISTS "public"."password_resets" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "code" character varying(255) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_consumed" boolean NOT NULL
);


ALTER TABLE "public"."password_resets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_claims" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "faction_id" character varying(255) NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "previous_faction_id" character varying(255),
    "previous_claimed_by" character varying(255)
);


ALTER TABLE "public"."place_claims" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."place_claims_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_claims_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_claims_id_seq" OWNED BY "public"."place_claims"."id";



CREATE TABLE IF NOT EXISTS "public"."place_contributions" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "faction_id" character varying(255),
    "type" "text" NOT NULL,
    "content" "text",
    "image_url" "text",
    "rating" smallint,
    "votes_up" integer DEFAULT 0 NOT NULL,
    "votes_down" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "title" "text",
    CONSTRAINT "place_contributions_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "place_contributions_type_check" CHECK (("type" = ANY (ARRAY['carnet'::"text", 'photo'::"text", 'accessibility'::"text", 'season'::"text", 'warning'::"text", 'epoch'::"text"])))
);


ALTER TABLE "public"."place_contributions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."place_contributions"."images" IS 'Array of image URLs attached to this contribution. Format: ["url1", "url2", ...]';



CREATE SEQUENCE IF NOT EXISTS "public"."place_contributions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_contributions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_contributions_id_seq" OWNED BY "public"."place_contributions"."id";



CREATE TABLE IF NOT EXISTS "public"."place_explorers" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "visited_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_explorers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."place_explorers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_explorers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_explorers_id_seq" OWNED BY "public"."place_explorers"."id";



CREATE TABLE IF NOT EXISTS "public"."place_influence" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "faction_id" character varying(255) NOT NULL,
    "placed_points" integer DEFAULT 0 NOT NULL,
    "content_points" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "permanent_points" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."place_influence" OWNER TO "postgres";


COMMENT ON TABLE "public"."place_influence" IS 'Influence par Héritage sur chaque lieu. placed_points décroît (-1/semaine), content_points est permanent.';



CREATE SEQUENCE IF NOT EXISTS "public"."place_influence_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_influence_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_influence_id_seq" OWNED BY "public"."place_influence"."id";



CREATE TABLE IF NOT EXISTS "public"."place_ratings" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "rating" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "place_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."place_ratings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."place_ratings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_ratings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_ratings_id_seq" OWNED BY "public"."place_ratings"."id";



CREATE TABLE IF NOT EXISTS "public"."place_tags" (
    "place_id" character varying(255) NOT NULL,
    "tag_id" character varying(255) NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_types" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "parent_id" character varying(255),
    "title" character varying(255) NOT NULL,
    "form_description" character varying(255) NOT NULL,
    "long_description" character varying(255) NOT NULL,
    "images" "jsonb" NOT NULL,
    "color" character varying(255) NOT NULL,
    "order" integer NOT NULL,
    "background" character varying(7),
    "border" character varying(7),
    "faded_color" character varying(7),
    "hidden" boolean DEFAULT false
);


ALTER TABLE "public"."place_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_wishlist" (
    "id" integer NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_wishlist" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."place_wishlist_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."place_wishlist_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."place_wishlist_id_seq" OWNED BY "public"."place_wishlist"."id";



CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "author_id" character varying(255) NOT NULL,
    "place_type_id" character varying(255) NOT NULL,
    "title" character varying(255) NOT NULL,
    "text" "text" NOT NULL,
    "address" character varying(255) NOT NULL,
    "latitude" real NOT NULL,
    "longitude" real NOT NULL,
    "private" boolean NOT NULL,
    "masked" boolean NOT NULL,
    "images" "jsonb" NOT NULL,
    "accessibility" character varying(255),
    "best_season" character varying(255),
    "geocaching" "text",
    "bivouac" "text",
    "sensible" boolean DEFAULT false,
    "begin_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "faction_id" character varying(255),
    "claimed_by" character varying(255),
    "claimed_at" timestamp with time zone,
    "fortification_level" integer DEFAULT 0 NOT NULL,
    "claimed_avatar_url" "text",
    "era_id" character varying,
    "year_exact" integer,
    "slug" "text",
    "seo_description" "text",
    "seo_generated_at" timestamp with time zone
);


ALTER TABLE "public"."places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_bookmarked" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL
);


ALTER TABLE "public"."places_bookmarked" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_discovered" (
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "method" character varying(20) DEFAULT 'remote'::character varying NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."places_discovered" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_explored" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL
);


ALTER TABLE "public"."places_explored" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_liked" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL
);


ALTER TABLE "public"."places_liked" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_viewed" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL
);


ALTER TABLE "public"."places_viewed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_log" (
    "id" integer NOT NULL,
    "email" character varying(255),
    "shopify_order_id" character varying(255),
    "shopify_tag" character varying(100),
    "unlock_type" character varying(30),
    "unlock_ref_id" integer,
    "user_id" character varying(255),
    "status" character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchase_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['unlocked'::character varying, 'pending'::character varying, 'manual'::character varying, 'skipped'::character varying, 'no_match'::character varying, 'no_tags'::character varying])::"text"[])))
);


ALTER TABLE "public"."purchase_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."purchase_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."purchase_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."purchase_log_id_seq" OWNED BY "public"."purchase_log"."id";



CREATE TABLE IF NOT EXISTS "public"."refresh_tokens" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "value" character varying(255) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "disabled" boolean NOT NULL
);


ALTER TABLE "public"."refresh_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "place_id" character varying(255) NOT NULL,
    "score" integer NOT NULL,
    "message" "text" NOT NULL,
    "geocache" boolean DEFAULT false
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews_images" (
    "review_id" character varying(255) NOT NULL,
    "image_media_id" character varying(255) NOT NULL
);


ALTER TABLE "public"."reviews_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_unlocks" (
    "id" integer NOT NULL,
    "shopify_tag" character varying(100) NOT NULL,
    "unlock_type" character varying(30) DEFAULT 'fragment'::character varying NOT NULL,
    "unlock_ref_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopify_unlocks_unlock_type_check" CHECK ((("unlock_type")::"text" = ANY ((ARRAY['fragment'::character varying, 'item'::character varying, 'boost'::character varying])::"text"[])))
);


ALTER TABLE "public"."shopify_unlocks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shopify_unlocks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shopify_unlocks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shopify_unlocks_id_seq" OWNED BY "public"."shopify_unlocks"."id";



CREATE TABLE IF NOT EXISTS "public"."tag_gauge_mapping" (
    "tag_id" character varying(255) NOT NULL,
    "gauge" character varying(30) DEFAULT 'energy'::character varying NOT NULL,
    CONSTRAINT "tag_gauge_mapping_gauge_check" CHECK ((("gauge")::"text" = ANY ((ARRAY['energy'::character varying, 'conquest'::character varying, 'construction'::character varying, 'vitalite'::character varying])::"text"[])))
);


ALTER TABLE "public"."tag_gauge_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "color" character varying(255) DEFAULT '#C19A6B'::character varying NOT NULL,
    "background" character varying(255) DEFAULT '#F5E6D3'::character varying NOT NULL,
    "icon" character varying(255),
    "order" integer DEFAULT 0 NOT NULL,
    "reward_energy" integer DEFAULT 0 NOT NULL,
    "reward_conquest" integer DEFAULT 0 NOT NULL,
    "reward_construction" integer DEFAULT 0 NOT NULL,
    "gauge" character varying(30) DEFAULT 'energy'::character varying NOT NULL,
    "base_cost" numeric(4,1) DEFAULT 1.0 NOT NULL,
    CONSTRAINT "tags_gauge_check" CHECK ((("gauge")::"text" = ANY ((ARRAY['energy'::character varying, 'conquest'::character varying, 'construction'::character varying, 'vitalite'::character varying])::"text"[])))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."territory_name_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "anchor_place_id" character varying(255) NOT NULL,
    "proposed_by" character varying(255) NOT NULL,
    "name" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "territory_name_proposals_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) >= 3))
);


ALTER TABLE "public"."territory_name_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."territory_name_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "voter_id" character varying(255) NOT NULL,
    "value" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "territory_name_votes_value_check" CHECK (("value" <> 0))
);


ALTER TABLE "public"."territory_name_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."territory_tiers" (
    "id" integer NOT NULL,
    "min_places" integer NOT NULL,
    "title" character varying(50) NOT NULL
);


ALTER TABLE "public"."territory_tiers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."territory_tiers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."territory_tiers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."territory_tiers_id_seq" OWNED BY "public"."territory_tiers"."id";



CREATE TABLE IF NOT EXISTS "public"."title_fragments" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "collection" character varying(50),
    "bonus_type" character varying(50),
    "bonus_value" numeric(6,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "link_url" "text",
    "visible" boolean DEFAULT true NOT NULL,
    "icon_url" "text",
    "ability_type" character varying(50) DEFAULT NULL::character varying,
    "ability_cooldown_hours" integer DEFAULT 24,
    "ability_value" numeric(5,2) DEFAULT 0
);


ALTER TABLE "public"."title_fragments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."title_fragments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."title_fragments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."title_fragments_id_seq" OWNED BY "public"."title_fragments"."id";



CREATE TABLE IF NOT EXISTS "public"."titles" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" character varying(30) NOT NULL,
    "faction_id" character varying(255),
    "order" integer DEFAULT 0 NOT NULL,
    "icon" character varying(50),
    "unlocks" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "condition" "jsonb" DEFAULT '{"min": 0, "stat": "discoveries"}'::"jsonb" NOT NULL,
    "description" "text",
    CONSTRAINT "titles_faction_check" CHECK (((("type")::"text" = 'general'::"text") OR ("faction_id" IS NOT NULL))),
    CONSTRAINT "titles_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['general'::character varying, 'faction'::character varying])::"text"[])))
);


ALTER TABLE "public"."titles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."titles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."titles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."titles_id_seq" OWNED BY "public"."titles"."id";



CREATE TABLE IF NOT EXISTS "public"."tutorial_slides" (
    "id" integer NOT NULL,
    "phase" "text" NOT NULL,
    "position" integer NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "image_url" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tutorial_slides_phase_check" CHECK (("phase" = ANY (ARRAY['before'::"text", 'after'::"text"])))
);


ALTER TABLE "public"."tutorial_slides" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tutorial_slides_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tutorial_slides_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tutorial_slides_id_seq" OWNED BY "public"."tutorial_slides"."id";



CREATE TABLE IF NOT EXISTS "public"."user_fragments" (
    "user_id" character varying(255) NOT NULL,
    "fragment_id" integer NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"(),
    "source" character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    CONSTRAINT "user_fragments_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['manual'::character varying, 'shopify'::character varying, 'achievement'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_fragments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_address" character varying(255) NOT NULL,
    "password" character varying(255),
    "first_name" character varying(255),
    "role" character varying(255) NOT NULL,
    "gender" character varying(255),
    "rank" character varying(255) DEFAULT 'guest'::character varying NOT NULL,
    "biography" character varying(255) DEFAULT ''::character varying NOT NULL,
    "instagram_id" character varying(255),
    "website_url" character varying(255),
    "last_access" timestamp with time zone,
    "last_device_os" character varying(255),
    "last_device_version" character varying(255),
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "instagram" "text",
    "location_name" "text",
    "location_zip" "text",
    "faction_id" character varying(255),
    "energy_points" numeric(4,1) DEFAULT 5 NOT NULL,
    "energy_reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conquest_points" numeric(6,1) DEFAULT 0 NOT NULL,
    "construction_points" numeric(6,1) DEFAULT 0 NOT NULL,
    "conquest_reset_at" timestamp with time zone DEFAULT "now"(),
    "construction_reset_at" timestamp with time zone DEFAULT "now"(),
    "notoriety_points" integer DEFAULT 0 NOT NULL,
    "max_energy" numeric(4,1) DEFAULT 3.0 NOT NULL,
    "max_conquest" numeric(6,1) DEFAULT 3.0 NOT NULL,
    "max_construction" numeric(6,1) DEFAULT 3.0 NOT NULL,
    "displayed_general_title_ids" integer[] DEFAULT '{}'::integer[],
    "game_mode" character varying(20) DEFAULT 'exploration'::character varying,
    "displayed_title_ids_v3" integer[] DEFAULT '{}'::integer[],
    "vitalite_points" numeric(6,1) DEFAULT 5.0,
    "max_vitalite" numeric(6,1) DEFAULT 3.0,
    "vitalite_reset_at" timestamp with time zone DEFAULT "now"(),
    "shopify_customer_id" bigint,
    "account_source" character varying(20) DEFAULT 'app'::character varying,
    "exploration_points" integer DEFAULT 0 NOT NULL,
    "erudition_points" integer DEFAULT 0 NOT NULL,
    "influence_stock" integer DEFAULT 0 NOT NULL,
    "faction_changed_at" timestamp with time zone,
    "tutorial_completed_at" timestamp with time zone,
    CONSTRAINT "users_account_source_check" CHECK ((("account_source")::"text" = ANY ((ARRAY['app'::character varying, 'shopify'::character varying])::"text"[])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."exploration_points" IS 'Rang terrain permanent. +N par découverte, ajout lieu, visite GPS, photo, description.';



COMMENT ON COLUMN "public"."users"."erudition_points" IS 'Rang savoir permanent. +N par énigme (quotidienne ou de lieu).';



COMMENT ON COLUMN "public"."users"."influence_stock" IS 'Stock d influence dépensable sur les lieux. Gagné via énigmes, contributions, visites.';



ALTER TABLE ONLY "public"."activity_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."activity_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ad_screens" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ad_screens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ad_tips" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ad_tips_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."chat_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."chat_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."contribution_votes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."contribution_votes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."enigma_responses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."enigma_responses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."enigmas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."enigmas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."fragment_words" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fragment_words_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mikro_orm_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mikro_orm_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notifications" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notifications_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_claims" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_claims_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_contributions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_contributions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_explorers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_explorers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_influence" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_influence_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_ratings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_ratings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."place_wishlist" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."place_wishlist_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."purchase_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."purchase_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shopify_unlocks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shopify_unlocks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."territory_tiers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."territory_tiers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."title_fragments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."title_fragments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."titles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."titles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tutorial_slides" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tutorial_slides_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_screens"
    ADD CONSTRAINT "ad_screens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_tips"
    ADD CONSTRAINT "ad_tips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."construction_types"
    ADD CONSTRAINT "construction_types_pkey" PRIMARY KEY ("level");



ALTER TABLE ONLY "public"."contribution_votes"
    ADD CONSTRAINT "contribution_votes_contribution_id_user_id_key" UNIQUE ("contribution_id", "user_id");



ALTER TABLE ONLY "public"."contribution_votes"
    ADD CONSTRAINT "contribution_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enigma_responses"
    ADD CONSTRAINT "enigma_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enigmas"
    ADD CONSTRAINT "enigmas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eras"
    ADD CONSTRAINT "eras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faction_tag_bonuses"
    ADD CONSTRAINT "faction_tag_bonuses_pkey" PRIMARY KEY ("faction_id", "tag_id");



ALTER TABLE ONLY "public"."factions"
    ADD CONSTRAINT "factions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fragment_ability_uses"
    ADD CONSTRAINT "fragment_ability_uses_pkey" PRIMARY KEY ("user_id", "fragment_id");



ALTER TABLE ONLY "public"."fragment_tag_affinities"
    ADD CONSTRAINT "fragment_tag_affinities_pkey" PRIMARY KEY ("fragment_id", "tag_id");



ALTER TABLE ONLY "public"."fragment_words"
    ADD CONSTRAINT "fragment_words_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_community_photos"
    ADD CONSTRAINT "hub_community_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_photo_submission_tags"
    ADD CONSTRAINT "hub_photo_submission_tags_pkey" PRIMARY KEY ("submission_id", "tag_id");



ALTER TABLE ONLY "public"."hub_photo_submissions"
    ADD CONSTRAINT "hub_photo_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_photo_tags"
    ADD CONSTRAINT "hub_photo_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."hub_photo_tags"
    ADD CONSTRAINT "hub_photo_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_review_submissions"
    ADD CONSTRAINT "hub_review_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_submission_images"
    ADD CONSTRAINT "hub_submission_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_media"
    ADD CONSTRAINT "image_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_codes"
    ADD CONSTRAINT "member_codes_code_unique" UNIQUE ("code");



ALTER TABLE ONLY "public"."member_codes"
    ADD CONSTRAINT "member_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_codes"
    ADD CONSTRAINT "member_codes_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."mikro_orm_migrations"
    ADD CONSTRAINT "mikro_orm_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_claims"
    ADD CONSTRAINT "place_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_contributions"
    ADD CONSTRAINT "place_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_contributions"
    ADD CONSTRAINT "place_contributions_place_id_user_id_type_key" UNIQUE ("place_id", "user_id", "type");



ALTER TABLE ONLY "public"."place_explorers"
    ADD CONSTRAINT "place_explorers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_explorers"
    ADD CONSTRAINT "place_explorers_place_id_user_id_key" UNIQUE ("place_id", "user_id");



ALTER TABLE ONLY "public"."place_influence"
    ADD CONSTRAINT "place_influence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_influence"
    ADD CONSTRAINT "place_influence_place_id_faction_id_key" UNIQUE ("place_id", "faction_id");



ALTER TABLE ONLY "public"."place_ratings"
    ADD CONSTRAINT "place_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_ratings"
    ADD CONSTRAINT "place_ratings_place_id_user_id_key" UNIQUE ("place_id", "user_id");



ALTER TABLE ONLY "public"."place_tags"
    ADD CONSTRAINT "place_tags_pkey" PRIMARY KEY ("place_id", "tag_id");



ALTER TABLE ONLY "public"."place_types"
    ADD CONSTRAINT "place_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_wishlist"
    ADD CONSTRAINT "place_wishlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_wishlist"
    ADD CONSTRAINT "place_wishlist_place_id_user_id_key" UNIQUE ("place_id", "user_id");



ALTER TABLE ONLY "public"."places_bookmarked"
    ADD CONSTRAINT "places_bookmarked_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places_discovered"
    ADD CONSTRAINT "places_discovered_pkey" PRIMARY KEY ("user_id", "place_id");



ALTER TABLE ONLY "public"."places_explored"
    ADD CONSTRAINT "places_explored_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places_liked"
    ADD CONSTRAINT "places_liked_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places_liked"
    ADD CONSTRAINT "places_liked_user_id_place_id_key" UNIQUE ("user_id", "place_id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."places_viewed"
    ADD CONSTRAINT "places_viewed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_log"
    ADD CONSTRAINT "purchase_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_value_unique" UNIQUE ("value");



ALTER TABLE ONLY "public"."reviews_images"
    ADD CONSTRAINT "reviews_images_pkey" PRIMARY KEY ("review_id", "image_media_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_unlocks"
    ADD CONSTRAINT "shopify_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_unlocks"
    ADD CONSTRAINT "shopify_unlocks_shopify_tag_unlock_type_unlock_ref_id_key" UNIQUE ("shopify_tag", "unlock_type", "unlock_ref_id");



ALTER TABLE ONLY "public"."tag_gauge_mapping"
    ADD CONSTRAINT "tag_gauge_mapping_pkey" PRIMARY KEY ("tag_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."territory_name_proposals"
    ADD CONSTRAINT "territory_name_proposals_anchor_place_id_proposed_by_name_key" UNIQUE ("anchor_place_id", "proposed_by", "name");



ALTER TABLE ONLY "public"."territory_name_proposals"
    ADD CONSTRAINT "territory_name_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."territory_name_votes"
    ADD CONSTRAINT "territory_name_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."territory_name_votes"
    ADD CONSTRAINT "territory_name_votes_proposal_id_voter_id_key" UNIQUE ("proposal_id", "voter_id");



ALTER TABLE ONLY "public"."territory_tiers"
    ADD CONSTRAINT "territory_tiers_min_places_key" UNIQUE ("min_places");



ALTER TABLE ONLY "public"."territory_tiers"
    ADD CONSTRAINT "territory_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."title_fragments"
    ADD CONSTRAINT "title_fragments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."titles"
    ADD CONSTRAINT "titles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutorial_slides"
    ADD CONSTRAINT "tutorial_slides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_fragments"
    ADD CONSTRAINT "user_fragments_pkey" PRIMARY KEY ("user_id", "fragment_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_address_unique" UNIQUE ("email_address");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_actor_id" ON "public"."activity_log" USING "btree" ("actor_id");



CREATE INDEX "idx_activity_log_created" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_type" ON "public"."activity_log" USING "btree" ("type");



CREATE INDEX "idx_chat_channel_created" ON "public"."chat_messages" USING "btree" ("channel", "created_at" DESC);



CREATE INDEX "idx_contributions_place" ON "public"."place_contributions" USING "btree" ("place_id");



CREATE INDEX "idx_contributions_user" ON "public"."place_contributions" USING "btree" ("user_id");



CREATE INDEX "idx_contributions_votes" ON "public"."place_contributions" USING "btree" ("place_id", "type", "votes_up" DESC);



CREATE INDEX "idx_enigma_responses_user_date" ON "public"."enigma_responses" USING "btree" ("user_id", "responded_at" DESC);



CREATE INDEX "idx_enigmas_daily" ON "public"."enigmas" USING "btree" ("type", "difficulty") WHERE ("active" = true);



CREATE INDEX "idx_enigmas_fragment" ON "public"."enigmas" USING "btree" ("fragment_id") WHERE (("type" = 'fragment'::"text") AND ("active" = true));



CREATE INDEX "idx_enigmas_place_tag" ON "public"."enigmas" USING "btree" ("place_tag") WHERE (("type" = 'place'::"text") AND ("active" = true));



CREATE INDEX "idx_enigmas_type_active" ON "public"."enigmas" USING "btree" ("type", "active");



CREATE INDEX "idx_explorers_place" ON "public"."place_explorers" USING "btree" ("place_id");



CREATE INDEX "idx_fragment_words_fragment_id" ON "public"."fragment_words" USING "btree" ("fragment_id");



CREATE INDEX "idx_hub_community_photos_created" ON "public"."hub_community_photos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hub_community_photos_status" ON "public"."hub_community_photos" USING "btree" ("status");



CREATE INDEX "idx_hub_community_photos_user" ON "public"."hub_community_photos" USING "btree" ("user_id");



CREATE INDEX "idx_image_media_user_id" ON "public"."image_media" USING "btree" ("user_id");



CREATE INDEX "idx_member_codes_code" ON "public"."member_codes" USING "btree" ("code");



CREATE INDEX "idx_notifications_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_photo_submission_tags_sub" ON "public"."hub_photo_submission_tags" USING "btree" ("submission_id");



CREATE INDEX "idx_photo_submission_tags_tag" ON "public"."hub_photo_submission_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_photo_submissions_created" ON "public"."hub_photo_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_photo_submissions_email" ON "public"."hub_photo_submissions" USING "btree" ("submitter_email");



CREATE INDEX "idx_photo_submissions_status" ON "public"."hub_photo_submissions" USING "btree" ("status");



CREATE INDEX "idx_photo_submissions_user" ON "public"."hub_photo_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_photo_tags_name" ON "public"."hub_photo_tags" USING "btree" ("name");



CREATE INDEX "idx_place_claims_faction_id" ON "public"."place_claims" USING "btree" ("faction_id");



CREATE INDEX "idx_place_claims_place_id" ON "public"."place_claims" USING "btree" ("place_id");



CREATE INDEX "idx_place_influence_faction" ON "public"."place_influence" USING "btree" ("faction_id");



CREATE INDEX "idx_place_influence_place" ON "public"."place_influence" USING "btree" ("place_id");



CREATE INDEX "idx_place_tags_primary" ON "public"."place_tags" USING "btree" ("place_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_place_tags_tag_id" ON "public"."place_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_place_types_parent_id" ON "public"."place_types" USING "btree" ("parent_id");



CREATE INDEX "idx_places_author_id" ON "public"."places" USING "btree" ("author_id");



CREATE INDEX "idx_places_bookmarked_place" ON "public"."places_bookmarked" USING "btree" ("place_id");



CREATE INDEX "idx_places_bookmarked_user" ON "public"."places_bookmarked" USING "btree" ("user_id");



CREATE INDEX "idx_places_claimed_by" ON "public"."places" USING "btree" ("claimed_by");



CREATE INDEX "idx_places_created_at" ON "public"."places" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_places_discovered_place" ON "public"."places_discovered" USING "btree" ("place_id");



CREATE INDEX "idx_places_discovered_user" ON "public"."places_discovered" USING "btree" ("user_id");



CREATE INDEX "idx_places_explored_place" ON "public"."places_explored" USING "btree" ("place_id");



CREATE INDEX "idx_places_explored_user" ON "public"."places_explored" USING "btree" ("user_id");



CREATE INDEX "idx_places_faction_id" ON "public"."places" USING "btree" ("faction_id");



CREATE INDEX "idx_places_liked_place" ON "public"."places_liked" USING "btree" ("place_id");



CREATE INDEX "idx_places_liked_user" ON "public"."places_liked" USING "btree" ("user_id");



CREATE INDEX "idx_places_place_type_id" ON "public"."places" USING "btree" ("place_type_id");



CREATE INDEX "idx_places_seo_stale" ON "public"."places" USING "btree" ("updated_at") WHERE (("seo_description" IS NULL) OR ("seo_generated_at" < "updated_at"));



CREATE UNIQUE INDEX "idx_places_slug" ON "public"."places" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_places_viewed_place" ON "public"."places_viewed" USING "btree" ("place_id");



CREATE INDEX "idx_places_viewed_user" ON "public"."places_viewed" USING "btree" ("user_id");



CREATE INDEX "idx_proposals_anchor" ON "public"."territory_name_proposals" USING "btree" ("anchor_place_id");



CREATE INDEX "idx_ratings_place" ON "public"."place_ratings" USING "btree" ("place_id");



CREATE INDEX "idx_review_submissions_rating" ON "public"."hub_review_submissions" USING "btree" ("rating");



CREATE INDEX "idx_review_submissions_status" ON "public"."hub_review_submissions" USING "btree" ("status");



CREATE INDEX "idx_review_submissions_user" ON "public"."hub_review_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_reviews_place" ON "public"."reviews" USING "btree" ("place_id");



CREATE INDEX "idx_reviews_user" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "idx_submission_images_sub" ON "public"."hub_submission_images" USING "btree" ("submission_id");



CREATE INDEX "idx_territory_votes_voter" ON "public"."territory_name_votes" USING "btree" ("voter_id");



CREATE INDEX "idx_user_fragments_user_id" ON "public"."user_fragments" USING "btree" ("user_id");



CREATE INDEX "idx_users_faction_id" ON "public"."users" USING "btree" ("faction_id");



CREATE INDEX "idx_users_glory" ON "public"."users" USING "btree" ((("exploration_points" + "erudition_points")) DESC);



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE UNIQUE INDEX "idx_users_shopify_customer_id" ON "public"."users" USING "btree" ("shopify_customer_id") WHERE ("shopify_customer_id" IS NOT NULL);



CREATE INDEX "idx_votes_proposal" ON "public"."territory_name_votes" USING "btree" ("proposal_id");



CREATE INDEX "idx_wishlist_user" ON "public"."place_wishlist" USING "btree" ("user_id");



CREATE INDEX "image_media_user_id_index" ON "public"."image_media" USING "btree" ("user_id");



CREATE INDEX "member_codes_code_index" ON "public"."member_codes" USING "btree" ("code");



CREATE INDEX "member_codes_user_id_index" ON "public"."member_codes" USING "btree" ("user_id");



CREATE INDEX "password_resets_user_id_index" ON "public"."password_resets" USING "btree" ("user_id");



CREATE INDEX "place_types_parent_id_index" ON "public"."place_types" USING "btree" ("parent_id");



CREATE INDEX "places_author_id_index" ON "public"."places" USING "btree" ("author_id");



CREATE INDEX "places_bookmarked_place_id_index" ON "public"."places_bookmarked" USING "btree" ("place_id");



CREATE INDEX "places_bookmarked_user_id_index" ON "public"."places_bookmarked" USING "btree" ("user_id");



CREATE INDEX "places_explored_place_id_index" ON "public"."places_explored" USING "btree" ("place_id");



CREATE INDEX "places_explored_user_id_index" ON "public"."places_explored" USING "btree" ("user_id");



CREATE INDEX "places_liked_place_id_index" ON "public"."places_liked" USING "btree" ("place_id");



CREATE INDEX "places_liked_user_id_index" ON "public"."places_liked" USING "btree" ("user_id");



CREATE INDEX "places_place_type_id_index" ON "public"."places" USING "btree" ("place_type_id");



CREATE INDEX "places_viewed_place_id_index" ON "public"."places_viewed" USING "btree" ("place_id");



CREATE INDEX "places_viewed_user_id_index" ON "public"."places_viewed" USING "btree" ("user_id");



CREATE INDEX "refresh_tokens_user_id_index" ON "public"."refresh_tokens" USING "btree" ("user_id");



CREATE INDEX "reviews_place_id_index" ON "public"."reviews" USING "btree" ("place_id");



CREATE INDEX "reviews_user_id_index" ON "public"."reviews" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_log_claim" AFTER INSERT ON "public"."place_claims" FOR EACH ROW EXECUTE FUNCTION "public"."log_claim_activity"();



CREATE OR REPLACE TRIGGER "trg_log_discover" AFTER INSERT ON "public"."places_discovered" FOR EACH ROW EXECUTE FUNCTION "public"."log_discover_activity"();



CREATE OR REPLACE TRIGGER "trg_log_explore" AFTER INSERT ON "public"."places_explored" FOR EACH ROW EXECUTE FUNCTION "public"."log_explore_activity"();



CREATE OR REPLACE TRIGGER "trg_log_like" AFTER INSERT ON "public"."places_liked" FOR EACH ROW EXECUTE FUNCTION "public"."log_like_activity"();



CREATE OR REPLACE TRIGGER "trg_milestone_vues" AFTER INSERT ON "public"."places_viewed" FOR EACH ROW EXECUTE FUNCTION "public"."check_milestone_vues"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id");



ALTER TABLE ONLY "public"."ad_screens"
    ADD CONSTRAINT "ad_screens_linked_tip_id_fkey" FOREIGN KEY ("linked_tip_id") REFERENCES "public"."ad_tips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contribution_votes"
    ADD CONSTRAINT "contribution_votes_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "public"."place_contributions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contribution_votes"
    ADD CONSTRAINT "contribution_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enigma_responses"
    ADD CONSTRAINT "enigma_responses_enigma_id_fkey" FOREIGN KEY ("enigma_id") REFERENCES "public"."enigmas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enigma_responses"
    ADD CONSTRAINT "enigma_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enigmas"
    ADD CONSTRAINT "enigmas_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."title_fragments"("id");



ALTER TABLE ONLY "public"."enigmas"
    ADD CONSTRAINT "enigmas_heritage_id_fkey" FOREIGN KEY ("heritage_id") REFERENCES "public"."factions"("id");



ALTER TABLE ONLY "public"."faction_tag_bonuses"
    ADD CONSTRAINT "faction_tag_bonuses_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faction_tag_bonuses"
    ADD CONSTRAINT "faction_tag_bonuses_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_ability_uses"
    ADD CONSTRAINT "fragment_ability_uses_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."title_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_ability_uses"
    ADD CONSTRAINT "fragment_ability_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_tag_affinities"
    ADD CONSTRAINT "fragment_tag_affinities_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."title_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_tag_affinities"
    ADD CONSTRAINT "fragment_tag_affinities_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_words"
    ADD CONSTRAINT "fragment_words_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."title_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_community_photos"
    ADD CONSTRAINT "hub_community_photos_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_community_photos"
    ADD CONSTRAINT "hub_community_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_photo_submission_tags"
    ADD CONSTRAINT "hub_photo_submission_tags_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."hub_photo_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_photo_submission_tags"
    ADD CONSTRAINT "hub_photo_submission_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."hub_photo_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_photo_submissions"
    ADD CONSTRAINT "hub_photo_submissions_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_photo_submissions"
    ADD CONSTRAINT "hub_photo_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_review_submissions"
    ADD CONSTRAINT "hub_review_submissions_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_review_submissions"
    ADD CONSTRAINT "hub_review_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hub_submission_images"
    ADD CONSTRAINT "hub_submission_images_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."hub_photo_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."image_media"
    ADD CONSTRAINT "image_media_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_codes"
    ADD CONSTRAINT "member_codes_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_claims"
    ADD CONSTRAINT "place_claims_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_claims"
    ADD CONSTRAINT "place_claims_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_claims"
    ADD CONSTRAINT "place_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_contributions"
    ADD CONSTRAINT "place_contributions_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_contributions"
    ADD CONSTRAINT "place_contributions_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_contributions"
    ADD CONSTRAINT "place_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_explorers"
    ADD CONSTRAINT "place_explorers_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_explorers"
    ADD CONSTRAINT "place_explorers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_influence"
    ADD CONSTRAINT "place_influence_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_influence"
    ADD CONSTRAINT "place_influence_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_ratings"
    ADD CONSTRAINT "place_ratings_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_ratings"
    ADD CONSTRAINT "place_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_tags"
    ADD CONSTRAINT "place_tags_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_tags"
    ADD CONSTRAINT "place_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_types"
    ADD CONSTRAINT "place_types_parent_id_foreign" FOREIGN KEY ("parent_id") REFERENCES "public"."place_types"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_wishlist"
    ADD CONSTRAINT "place_wishlist_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_wishlist"
    ADD CONSTRAINT "place_wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_author_id_foreign" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_bookmarked"
    ADD CONSTRAINT "places_bookmarked_place_id_foreign" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_bookmarked"
    ADD CONSTRAINT "places_bookmarked_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."places_discovered"
    ADD CONSTRAINT "places_discovered_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_discovered"
    ADD CONSTRAINT "places_discovered_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_era_id_fkey" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id");



ALTER TABLE ONLY "public"."places_explored"
    ADD CONSTRAINT "places_explored_place_id_foreign" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_explored"
    ADD CONSTRAINT "places_explored_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."places_liked"
    ADD CONSTRAINT "places_liked_place_id_foreign" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_liked"
    ADD CONSTRAINT "places_liked_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_place_type_id_foreign" FOREIGN KEY ("place_type_id") REFERENCES "public"."place_types"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_viewed"
    ADD CONSTRAINT "places_viewed_place_id_foreign" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_viewed"
    ADD CONSTRAINT "places_viewed_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_log"
    ADD CONSTRAINT "purchase_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews_images"
    ADD CONSTRAINT "reviews_images_image_media_id_foreign" FOREIGN KEY ("image_media_id") REFERENCES "public"."image_media"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews_images"
    ADD CONSTRAINT "reviews_images_review_id_foreign" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_place_id_foreign" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_gauge_mapping"
    ADD CONSTRAINT "tag_gauge_mapping_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_name_proposals"
    ADD CONSTRAINT "territory_name_proposals_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."territory_name_votes"
    ADD CONSTRAINT "territory_name_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."territory_name_proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."territory_name_votes"
    ADD CONSTRAINT "territory_name_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."titles"
    ADD CONSTRAINT "titles_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_fragments"
    ADD CONSTRAINT "user_fragments_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."title_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_fragments"
    ADD CONSTRAINT "user_fragments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can manage ad_screens" ON "public"."ad_screens" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage ad_tips" ON "public"."ad_tips" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage member codes" ON "public"."member_codes" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Allow public read" ON "public"."place_types" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."places" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Anyone can add submission images" ON "public"."hub_submission_images" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can submit photos" ON "public"."hub_photo_submissions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can view active ad_screens" ON "public"."ad_screens" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active ad_tips" ON "public"."ad_tips" FOR SELECT USING (true);



CREATE POLICY "Anyone can view bookmarked places" ON "public"."places_bookmarked" FOR SELECT USING (true);



CREATE POLICY "Anyone can view explored places" ON "public"."places_explored" FOR SELECT USING (true);



CREATE POLICY "Anyone can view fragment_words" ON "public"."fragment_words" FOR SELECT USING (true);



CREATE POLICY "Anyone can view image media" ON "public"."image_media" FOR SELECT USING (true);



CREATE POLICY "Anyone can view place likes" ON "public"."places_liked" FOR SELECT USING (true);



CREATE POLICY "Anyone can view place types" ON "public"."place_types" FOR SELECT USING (true);



CREATE POLICY "Anyone can view place views" ON "public"."places_viewed" FOR SELECT USING (true);



CREATE POLICY "Anyone can view place_tags" ON "public"."place_tags" FOR SELECT USING (true);



CREATE POLICY "Anyone can view places" ON "public"."places" FOR SELECT USING (true);



CREATE POLICY "Anyone can view review images" ON "public"."reviews_images" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view shopify_unlocks" ON "public"."shopify_unlocks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view tags" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "Anyone can view title_fragments" ON "public"."title_fragments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view titles" ON "public"."titles" FOR SELECT USING (true);



CREATE POLICY "Approved reviews are public" ON "public"."hub_review_submissions" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Approved submission images are public" ON "public"."hub_submission_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hub_photo_submissions"
  WHERE (("hub_photo_submissions"."id" = "hub_submission_images"."submission_id") AND ("hub_photo_submissions"."status" = 'approved'::"text")))));



CREATE POLICY "Approved submissions are public" ON "public"."hub_photo_submissions" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Auth insert discoveries" ON "public"."places_discovered" FOR INSERT TO "authenticated" WITH CHECK ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Auth insert place_claims" ON "public"."place_claims" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Auth manage factions" ON "public"."factions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Auth users can insert views" ON "public"."places_viewed" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated can insert place_tags" ON "public"."place_tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can read users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create places" ON "public"."places" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("author_id")::"text"));



CREATE POLICY "Authenticated users can create reviews" ON "public"."reviews" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Authenticated users can update tags" ON "public"."tags" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Authors can delete their places" ON "public"."places" FOR DELETE USING ((("auth"."uid"())::"text" = ("author_id")::"text"));



CREATE POLICY "Authors can update their places" ON "public"."places" FOR UPDATE USING ((("auth"."uid"())::"text" = ("author_id")::"text"));



CREATE POLICY "Moderators can manage tag assignments" ON "public"."hub_photo_submission_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can manage tags" ON "public"."hub_photo_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can update photos" ON "public"."hub_community_photos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can update reviews" ON "public"."hub_review_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can update submissions" ON "public"."hub_photo_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can view all photos" ON "public"."hub_community_photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can view all reviews" ON "public"."hub_review_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can view all submission images" ON "public"."hub_submission_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Moderators can view all submissions" ON "public"."hub_photo_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying])::"text"[]))))));



CREATE POLICY "Public can create user accounts" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert reviews" ON "public"."hub_review_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read factions" ON "public"."factions" FOR SELECT USING (true);



CREATE POLICY "Public read place_claims" ON "public"."place_claims" FOR SELECT USING (true);



CREATE POLICY "Review authors can delete review images" ON "public"."reviews_images" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."reviews"
  WHERE ((("reviews"."id")::"text" = ("reviews_images"."review_id")::"text") AND (("reviews"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Review authors can manage review images" ON "public"."reviews_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."reviews"
  WHERE ((("reviews"."id")::"text" = ("reviews_images"."review_id")::"text") AND (("reviews"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Service role can manage fragment_words" ON "public"."fragment_words" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage purchase_log" ON "public"."purchase_log" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage shopify_unlocks" ON "public"."shopify_unlocks" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage title_fragments" ON "public"."title_fragments" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage titles" ON "public"."titles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage user_fragments" ON "public"."user_fragments" USING (true) WITH CHECK (true);



CREATE POLICY "Tag assignments are publicly readable" ON "public"."hub_photo_submission_tags" FOR SELECT USING (true);



CREATE POLICY "Tags are publicly readable" ON "public"."hub_photo_tags" FOR SELECT USING (true);



CREATE POLICY "Users can bookmark places" ON "public"."places_bookmarked" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can create their own image media" ON "public"."image_media" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can create their own views" ON "public"."places_viewed" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can delete their own image media" ON "public"."image_media" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can delete their own reviews" ON "public"."reviews" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can insert own photos" ON "public"."hub_community_photos" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can like places" ON "public"."places_liked" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can mark places as explored" ON "public"."places_explored" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can remove bookmarks" ON "public"."places_bookmarked" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can unlike places" ON "public"."places_liked" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can unmark explored places" ON "public"."places_explored" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update their own reviews" ON "public"."reviews" FOR UPDATE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view own fragments" ON "public"."user_fragments" FOR SELECT USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can view own photos" ON "public"."hub_community_photos" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view own submission images" ON "public"."hub_submission_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hub_photo_submissions"
  WHERE (("hub_photo_submissions"."id" = "hub_submission_images"."submission_id") AND (("hub_photo_submissions"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can view own submissions" ON "public"."hub_photo_submissions" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users read own discoveries" ON "public"."places_discovered" FOR SELECT USING (true);



CREATE POLICY "ability_uses_read" ON "public"."fragment_ability_uses" FOR SELECT USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "ability_uses_write" ON "public"."fragment_ability_uses" USING ((("user_id")::"text" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_read" ON "public"."activity_log" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."ad_screens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ad_tips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_admin_write" ON "public"."app_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "app_settings_read" ON "public"."app_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "chat_insert_bugs" ON "public"."chat_messages" FOR INSERT WITH CHECK (((("channel")::"text" = 'bugs'::"text") AND (("auth"."uid"())::"text" = ("user_id")::"text")));



CREATE POLICY "chat_insert_faction" ON "public"."chat_messages" FOR INSERT WITH CHECK (((("channel")::"text" <> ALL ((ARRAY['general'::character varying, 'bugs'::character varying])::"text"[])) AND (("auth"."uid"())::"text" = ("user_id")::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."faction_id")::"text" = ("chat_messages"."channel")::"text"))))));



CREATE POLICY "chat_insert_general" ON "public"."chat_messages" FOR INSERT WITH CHECK (((("channel")::"text" = 'general'::"text") AND (("auth"."uid"())::"text" = ("user_id")::"text")));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_read_bugs" ON "public"."chat_messages" FOR SELECT USING (((("channel")::"text" = 'bugs'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "chat_read_faction" ON "public"."chat_messages" FOR SELECT USING (((("channel")::"text" <> ALL ((ARRAY['general'::character varying, 'bugs'::character varying])::"text"[])) AND ("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."faction_id")::"text" = ("chat_messages"."channel")::"text"))))));



CREATE POLICY "chat_read_general" ON "public"."chat_messages" FOR SELECT USING (((("channel")::"text" = 'general'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



ALTER TABLE "public"."construction_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "construction_types_admin" ON "public"."construction_types" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "construction_types_read" ON "public"."construction_types" FOR SELECT USING (true);



ALTER TABLE "public"."contribution_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contributions_insert" ON "public"."place_contributions" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "contributions_select" ON "public"."place_contributions" FOR SELECT USING (true);



CREATE POLICY "contributions_update" ON "public"."place_contributions" FOR UPDATE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



ALTER TABLE "public"."enigma_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enigmas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enigmas_select" ON "public"."enigmas" FOR SELECT USING (("active" = true));



ALTER TABLE "public"."eras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eras_read" ON "public"."eras" FOR SELECT USING (true);



CREATE POLICY "explorers_select" ON "public"."place_explorers" FOR SELECT USING (true);



ALTER TABLE "public"."faction_tag_bonuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faction_tag_bonuses_admin" ON "public"."faction_tag_bonuses" USING (true) WITH CHECK (true);



CREATE POLICY "faction_tag_bonuses_read" ON "public"."faction_tag_bonuses" FOR SELECT USING (true);



ALTER TABLE "public"."factions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fragment_ability_uses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fragment_tag_affinities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fragment_tag_affinities_all" ON "public"."fragment_tag_affinities" USING (true) WITH CHECK (true);



CREATE POLICY "fragment_tag_affinities_select" ON "public"."fragment_tag_affinities" FOR SELECT USING (true);



ALTER TABLE "public"."fragment_words" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_community_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_photo_submission_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_photo_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_photo_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_review_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_submission_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("recipient_id" = ("auth"."uid"())::"text"));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("recipient_id" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."place_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_explorers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_influence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_influence_select" ON "public"."place_influence" FOR SELECT USING (true);



ALTER TABLE "public"."place_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_wishlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_bookmarked" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_discovered" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_explored" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_liked" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_viewed" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposals_delete" ON "public"."territory_name_proposals" FOR DELETE USING ((("proposed_by")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "proposals_insert" ON "public"."territory_name_proposals" FOR INSERT WITH CHECK ((("proposed_by")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "proposals_select" ON "public"."territory_name_proposals" FOR SELECT USING (true);



ALTER TABLE "public"."purchase_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_select" ON "public"."place_ratings" FOR SELECT USING (true);



CREATE POLICY "ratings_update" ON "public"."place_ratings" FOR UPDATE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "ratings_upsert" ON "public"."place_ratings" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "responses_insert" ON "public"."enigma_responses" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "responses_select" ON "public"."enigma_responses" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_unlocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_admin_delete" ON "public"."tags" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "tags_admin_insert" ON "public"."tags" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "tags_admin_update" ON "public"."tags" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "tags_select_authenticated" ON "public"."tags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."territory_name_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."territory_name_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."territory_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "territory_tiers_read" ON "public"."territory_tiers" FOR SELECT USING (true);



CREATE POLICY "territory_tiers_write" ON "public"."territory_tiers" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE ((("u"."id")::"text" = ("auth"."uid"())::"text") AND (("u"."role")::"text" = 'admin'::"text")))));



ALTER TABLE "public"."title_fragments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."titles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutorial_slides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutorial_slides_delete" ON "public"."tutorial_slides" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "tutorial_slides_insert" ON "public"."tutorial_slides" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "tutorial_slides_select" ON "public"."tutorial_slides" FOR SELECT USING (true);



CREATE POLICY "tutorial_slides_update" ON "public"."tutorial_slides" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id")::"text" = ("auth"."uid"())::"text") AND (("users"."role")::"text" = 'admin'::"text")))));



ALTER TABLE "public"."user_fragments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_set_era" ON "public"."places" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "votes_delete" ON "public"."territory_name_votes" FOR DELETE USING ((("voter_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "votes_insert" ON "public"."contribution_votes" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "votes_insert" ON "public"."territory_name_votes" FOR INSERT WITH CHECK ((("voter_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "votes_select" ON "public"."contribution_votes" FOR SELECT USING (true);



CREATE POLICY "votes_select" ON "public"."territory_name_votes" FOR SELECT USING (true);



CREATE POLICY "votes_update" ON "public"."territory_name_votes" FOR UPDATE USING ((("voter_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "wishlist_delete" ON "public"."place_wishlist" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "wishlist_insert" ON "public"."place_wishlist" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "wishlist_select" ON "public"."place_wishlist" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_answer_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_answer_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_answer_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_answer_fragment_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_answer_fragment_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_answer_fragment_enigma_internal"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_contribute_to_place_internal"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_contribute_to_place_internal"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_contribute_to_place_internal"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_place_influence_action_internal"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_place_influence_action_internal"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_place_influence_action_internal"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_revisit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_revisit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."_revisit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_unlike_contribution_internal"("p_user_id" "text", "p_contribution_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_unlike_contribution_internal"("p_user_id" "text", "p_contribution_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_unlike_contribution_internal"("p_user_id" "text", "p_contribution_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_visit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_visit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."_visit_place_gps_internal"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_vote_contribution_internal"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_vote_contribution_internal"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_vote_contribution_internal"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_submission_image"("p_submission_id" "uuid", "p_storage_path" "text", "p_image_url" "text", "p_sort_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_submission_image"("p_submission_id" "uuid", "p_storage_path" "text", "p_image_url" "text", "p_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_submission_image"("p_submission_id" "uuid", "p_storage_path" "text", "p_image_url" "text", "p_sort_order" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_tag_to_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_tag_to_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_tag_to_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."answer_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."answer_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."answer_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."answer_fragment_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."answer_fragment_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."answer_fragment_enigma"("p_user_id" "text", "p_enigma_id" integer, "p_answer" "text", "p_fragment_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cheat_refill"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cheat_refill"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cheat_refill"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cheat_refill_target"("p_caller_id" "text", "p_target_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cheat_refill_target"("p_caller_id" "text", "p_target_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cheat_refill_target"("p_caller_id" "text", "p_target_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_milestone_vues"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_milestone_vues"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_milestone_vues"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_title_condition"("p_condition" "jsonb", "p_stat_value" integer, "p_rank_value" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_title_condition"("p_condition" "jsonb", "p_stat_value" integer, "p_rank_value" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_title_condition"("p_condition" "jsonb", "p_stat_value" integer, "p_rank_value" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_chat_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_chat_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_chat_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."contribute_to_place"("p_user_id" "text", "p_place_id" "text", "p_type" "text", "p_content" "text", "p_image_url" "text", "p_era_id" "text", "p_year_exact" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_photo_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_submitter_instagram" "text", "p_location_name" "text", "p_location_zip" "text", "p_message" "text", "p_consent_brand" boolean, "p_consent_account" boolean, "p_submitter_role" "text", "p_product_size" "text", "p_model_height_cm" numeric, "p_model_shoulder_width_cm" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_photo_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_submitter_instagram" "text", "p_location_name" "text", "p_location_zip" "text", "p_message" "text", "p_consent_brand" boolean, "p_consent_account" boolean, "p_submitter_role" "text", "p_product_size" "text", "p_model_height_cm" numeric, "p_model_shoulder_width_cm" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_photo_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_submitter_instagram" "text", "p_location_name" "text", "p_location_zip" "text", "p_message" "text", "p_consent_brand" boolean, "p_consent_account" boolean, "p_submitter_role" "text", "p_product_size" "text", "p_model_height_cm" numeric, "p_model_shoulder_width_cm" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_photo_tag"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_photo_tag"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_photo_tag"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_address" "text", "p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_address" "text", "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_address" "text", "p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text", "p_era_id" "text", "p_year_exact" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text", "p_era_id" "text", "p_year_exact" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_place"("p_user_id" "text", "p_title" "text", "p_latitude" real, "p_longitude" real, "p_tag_id" "text", "p_image_url" "text", "p_thumb_url" "text", "p_address" "text", "p_text" "text", "p_user_lat" real, "p_user_lng" real, "p_carnet_title" "text", "p_era_id" "text", "p_year_exact" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_review_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_location_name" "text", "p_location_zip" "text", "p_review_text" "text", "p_rating" integer, "p_purchase_status" "text", "p_consent_account" boolean, "p_consent_republish" boolean, "p_image_url" "text", "p_storage_path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_review_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_location_name" "text", "p_location_zip" "text", "p_review_text" "text", "p_rating" integer, "p_purchase_status" "text", "p_consent_account" boolean, "p_consent_republish" boolean, "p_image_url" "text", "p_storage_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_review_submission"("p_user_id" character varying, "p_submitter_name" "text", "p_submitter_email" "text", "p_location_name" "text", "p_location_zip" "text", "p_review_text" "text", "p_rating" integer, "p_purchase_status" "text", "p_consent_account" boolean, "p_consent_republish" boolean, "p_image_url" "text", "p_storage_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text", "p_location_zip" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text", "p_location_zip" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text", "p_location_zip" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decay_placed_influence"() TO "anon";
GRANT ALL ON FUNCTION "public"."decay_placed_influence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decay_placed_influence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_carnet"("p_user_id" "text", "p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_carnet"("p_user_id" "text", "p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_carnet"("p_user_id" "text", "p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_photo_submission"("p_submission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_photo_submission"("p_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_photo_submission"("p_submission_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_photo_tag"("p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_photo_tag"("p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_photo_tag"("p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_place"("p_user_id" "text", "p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_place"("p_user_id" "text", "p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_place"("p_user_id" "text", "p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_review_submission"("p_review_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_review_submission"("p_review_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_review_submission"("p_review_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."discover_place"("p_user_id" "text", "p_place_id" "text", "p_method" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_free" boolean, "p_glory_mult" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."discover_place"("p_user_id" "text", "p_place_id" "text", "p_method" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_free" boolean, "p_glory_mult" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."discover_place"("p_user_id" "text", "p_place_id" "text", "p_method" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_free" boolean, "p_glory_mult" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_multiplier"("distance_km" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."distance_multiplier"("distance_km" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_multiplier"("distance_km" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_fragments"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_fragments"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_fragments"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_player_titles"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_player_titles"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_player_titles"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_construction_types"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_construction_types"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_construction_types"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_enigma"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_enigma"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_enigma"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_faction_members"("p_faction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_faction_members"("p_faction_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_faction_members"("p_faction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_faction_tag_reduction"("p_user_id" "text", "p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_faction_tag_reduction"("p_user_id" "text", "p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_faction_tag_reduction"("p_user_id" "text", "p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_fragment_enigma"("p_user_id" "text", "p_fragment_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_fragment_enigma"("p_user_id" "text", "p_fragment_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fragment_enigma"("p_user_id" "text", "p_fragment_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_type" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_type" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("p_type" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_map_places"("p_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_latitude_delta" double precision, "p_longitude_delta" double precision, "p_limit" integer, "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_map_places"("p_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_latitude_delta" double precision, "p_longitude_delta" double precision, "p_limit" integer, "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_map_places"("p_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_latitude_delta" double precision, "p_longitude_delta" double precision, "p_limit" integer, "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_fragment_status"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_fragment_status"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_fragment_status"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_informations"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_informations"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_informations"("p_user_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."hub_photo_submissions" TO "anon";
GRANT ALL ON TABLE "public"."hub_photo_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_photo_submissions" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_photo_submissions"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_photo_submissions"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_photo_submissions"("p_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."hub_photo_tags" TO "anon";
GRANT ALL ON TABLE "public"."hub_photo_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_photo_tags" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_photo_tags"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_photo_tags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_photo_tags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_place_by_id"("p_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_place_by_id"("p_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_place_by_id"("p_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_place_detail_v05"("p_place_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_place_detail_v05"("p_place_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_place_detail_v05"("p_place_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_place_guardian"("p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_place_guardian"("p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_place_guardian"("p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_player_profile"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_player_profile"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_player_profile"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_random_ad"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_random_ad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_random_ad"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_activity"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_activity"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_activity"("p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."hub_review_submissions" TO "anon";
GRANT ALL ON TABLE "public"."hub_review_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_review_submissions" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_review_submissions"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_review_submissions"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_review_submissions"("p_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."hub_submission_images" TO "anon";
GRANT ALL ON TABLE "public"."hub_submission_images" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_submission_images" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_submission_images"("p_submission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_submission_images"("p_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_submission_images"("p_submission_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_submission_images_batch"("p_submission_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_submission_images_batch"("p_submission_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_submission_images_batch"("p_submission_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_submission_tags_batch"("p_submission_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_submission_tags_batch"("p_submission_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_submission_tags_batch"("p_submission_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_territory_votes"("p_anchor_place_id" "text", "p_user_id" "text", "p_blob_place_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_territory_votes"("p_anchor_place_id" "text", "p_user_id" "text", "p_blob_place_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_territory_votes"("p_anchor_place_id" "text", "p_user_id" "text", "p_blob_place_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_underdog_faction_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_underdog_faction_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_underdog_faction_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_avatar"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_avatar"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_avatar"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_discoveries"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_discoveries"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_discoveries"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_energy"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_energy"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_energy"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_fragments"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_fragments"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_fragments"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_titles"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_titles"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_titles"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_winning_territory_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_winning_territory_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_winning_territory_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" numeric, "lng1" numeric, "lat2" numeric, "lng2" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_claim_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_claim_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_claim_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_discover_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_discover_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_discover_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_explore_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_explore_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_explore_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_like_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_like_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_like_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_new_user_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_new_user_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_new_user_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_user_to_auth_id"("p_old_id" "text", "p_new_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_user_to_auth_id"("p_old_id" "text", "p_new_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_user_to_auth_id"("p_old_id" "text", "p_new_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify"("p_recipient" "text", "p_type" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify"("p_recipient" "text", "p_type" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify"("p_recipient" "text", "p_type" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_exploration"("p_recipient" "text", "p_place_id" "text", "p_visitor_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_exploration"("p_recipient" "text", "p_place_id" "text", "p_visitor_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_exploration"("p_recipient" "text", "p_place_id" "text", "p_visitor_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."place_influence_action"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."place_influence_action"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_influence_action"("p_user_id" "text", "p_place_id" "text", "p_points" integer, "p_user_lat" numeric, "p_user_lng" numeric, "p_target_faction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."place_influence_score"("p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."place_influence_score"("p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_influence_score"("p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_action_cost"("p_user_id" "text", "p_place_id" "text", "p_action" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_fortify_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."preview_action_cost"("p_user_id" "text", "p_place_id" "text", "p_action" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_fortify_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_action_cost"("p_user_id" "text", "p_place_id" "text", "p_action" "text", "p_user_lat" numeric, "p_user_lng" numeric, "p_fortify_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."propose_territory_name"("p_user_id" "text", "p_anchor_place_id" "text", "p_name" "text", "p_blob_place_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."propose_territory_name"("p_user_id" "text", "p_anchor_place_id" "text", "p_name" "text", "p_blob_place_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."propose_territory_name"("p_user_id" "text", "p_anchor_place_id" "text", "p_name" "text", "p_blob_place_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rate_place"("p_user_id" "text", "p_place_id" "text", "p_rating" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rate_place"("p_user_id" "text", "p_place_id" "text", "p_rating" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rate_place"("p_user_id" "text", "p_place_id" "text", "p_rating" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_place_content_points"("p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_place_content_points"("p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_place_content_points"("p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_tag_from_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_tag_from_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_tag_from_submission"("p_submission_id" "uuid", "p_tag_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_faction"("p_old_id" "text", "p_new_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rename_faction"("p_old_id" "text", "p_new_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_faction"("p_old_id" "text", "p_new_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_place"("p_user_id" "text", "p_place_id" "text", "p_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rename_place"("p_user_id" "text", "p_place_id" "text", "p_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_place"("p_user_id" "text", "p_place_id" "text", "p_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revisit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."revisit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."revisit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_displayed_titles"("p_user_id" "text", "p_title_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_displayed_titles"("p_user_id" "text", "p_title_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_displayed_titles"("p_user_id" "text", "p_title_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_displayed_titles_v3"("p_user_id" "text", "p_title_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_displayed_titles_v3"("p_user_id" "text", "p_title_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_displayed_titles_v3"("p_user_id" "text", "p_title_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_faction"("p_user_id" "text", "p_faction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_faction"("p_user_id" "text", "p_faction_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_faction"("p_user_id" "text", "p_faction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."territory_radius_km"("p_score" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."territory_radius_km"("p_score" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."territory_radius_km"("p_score" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_wishlist"("p_user_id" "text", "p_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_wishlist"("p_user_id" "text", "p_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_wishlist"("p_user_id" "text", "p_place_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unlike_contribution"("p_user_id" "text", "p_contribution_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."unlike_contribution"("p_user_id" "text", "p_contribution_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlike_contribution"("p_user_id" "text", "p_contribution_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."unlock_pending_fragments"("p_user_id" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlock_pending_fragments"("p_user_id" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlock_pending_fragments"("p_user_id" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile"("p_user_id" "text", "p_first_name" "text", "p_bio" "text", "p_instagram" "text", "p_avatar_url" "text", "p_game_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_user_id" "text", "p_first_name" "text", "p_bio" "text", "p_instagram" "text", "p_avatar_url" "text", "p_game_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_user_id" "text", "p_first_name" "text", "p_bio" "text", "p_instagram" "text", "p_avatar_url" "text", "p_game_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_message"("p_submission_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_message"("p_submission_id" "uuid", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_message"("p_submission_id" "uuid", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_product_worn"("p_submission_id" "uuid", "p_product_worn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_product_worn"("p_submission_id" "uuid", "p_product_worn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_product_worn"("p_submission_id" "uuid", "p_product_worn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."visit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."visit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."visit_place_gps"("p_user_id" "text", "p_place_id" "text", "p_user_lat" numeric, "p_user_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_contribution"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vote_contribution"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_contribution"("p_user_id" "text", "p_contribution_id" integer, "p_vote" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_territory_name"("p_user_id" "text", "p_proposal_id" "uuid", "p_value" smallint, "p_blob_place_ids" "text"[], "p_anchor_place_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."vote_territory_name"("p_user_id" "text", "p_proposal_id" "uuid", "p_value" smallint, "p_blob_place_ids" "text"[], "p_anchor_place_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_territory_name"("p_user_id" "text", "p_proposal_id" "uuid", "p_value" smallint, "p_blob_place_ids" "text"[], "p_anchor_place_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ad_screens" TO "anon";
GRANT ALL ON TABLE "public"."ad_screens" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_screens" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ad_screens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_screens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_screens_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ad_tips" TO "anon";
GRANT ALL ON TABLE "public"."ad_tips" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_tips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ad_tips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_tips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_tips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."construction_types" TO "anon";
GRANT ALL ON TABLE "public"."construction_types" TO "authenticated";
GRANT ALL ON TABLE "public"."construction_types" TO "service_role";



GRANT ALL ON TABLE "public"."contribution_votes" TO "anon";
GRANT ALL ON TABLE "public"."contribution_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."contribution_votes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contribution_votes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contribution_votes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contribution_votes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."enigma_responses" TO "anon";
GRANT ALL ON TABLE "public"."enigma_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."enigma_responses" TO "service_role";



GRANT ALL ON TABLE "public"."enigmas" TO "anon";
GRANT ALL ON TABLE "public"."enigmas" TO "authenticated";
GRANT ALL ON TABLE "public"."enigmas" TO "service_role";



GRANT ALL ON TABLE "public"."daily_enigma_status" TO "anon";
GRANT ALL ON TABLE "public"."daily_enigma_status" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_enigma_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."enigma_responses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."enigma_responses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."enigma_responses_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."enigmas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."enigmas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."enigmas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."eras" TO "anon";
GRANT ALL ON TABLE "public"."eras" TO "authenticated";
GRANT ALL ON TABLE "public"."eras" TO "service_role";



GRANT ALL ON TABLE "public"."faction_tag_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."faction_tag_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."faction_tag_bonuses" TO "service_role";



GRANT ALL ON TABLE "public"."factions" TO "anon";
GRANT ALL ON TABLE "public"."factions" TO "authenticated";
GRANT ALL ON TABLE "public"."factions" TO "service_role";



GRANT ALL ON TABLE "public"."fragment_ability_uses" TO "anon";
GRANT ALL ON TABLE "public"."fragment_ability_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."fragment_ability_uses" TO "service_role";



GRANT ALL ON TABLE "public"."fragment_tag_affinities" TO "anon";
GRANT ALL ON TABLE "public"."fragment_tag_affinities" TO "authenticated";
GRANT ALL ON TABLE "public"."fragment_tag_affinities" TO "service_role";



GRANT ALL ON TABLE "public"."fragment_words" TO "anon";
GRANT ALL ON TABLE "public"."fragment_words" TO "authenticated";
GRANT ALL ON TABLE "public"."fragment_words" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fragment_words_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fragment_words_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fragment_words_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hub_community_photos" TO "anon";
GRANT ALL ON TABLE "public"."hub_community_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_community_photos" TO "service_role";



GRANT ALL ON TABLE "public"."hub_photo_submission_tags" TO "anon";
GRANT ALL ON TABLE "public"."hub_photo_submission_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_photo_submission_tags" TO "service_role";



GRANT ALL ON TABLE "public"."image_media" TO "anon";
GRANT ALL ON TABLE "public"."image_media" TO "authenticated";
GRANT ALL ON TABLE "public"."image_media" TO "service_role";



GRANT ALL ON TABLE "public"."member_codes" TO "anon";
GRANT ALL ON TABLE "public"."member_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."member_codes" TO "service_role";



GRANT ALL ON TABLE "public"."mikro_orm_migrations" TO "anon";
GRANT ALL ON TABLE "public"."mikro_orm_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."mikro_orm_migrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mikro_orm_migrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mikro_orm_migrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mikro_orm_migrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."password_resets" TO "anon";
GRANT ALL ON TABLE "public"."password_resets" TO "authenticated";
GRANT ALL ON TABLE "public"."password_resets" TO "service_role";



GRANT ALL ON TABLE "public"."place_claims" TO "anon";
GRANT ALL ON TABLE "public"."place_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."place_claims" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_claims_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_claims_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_claims_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_contributions" TO "anon";
GRANT ALL ON TABLE "public"."place_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."place_contributions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_contributions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_contributions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_contributions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_explorers" TO "anon";
GRANT ALL ON TABLE "public"."place_explorers" TO "authenticated";
GRANT ALL ON TABLE "public"."place_explorers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_explorers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_explorers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_explorers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_influence" TO "anon";
GRANT ALL ON TABLE "public"."place_influence" TO "authenticated";
GRANT ALL ON TABLE "public"."place_influence" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_influence_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_influence_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_influence_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_ratings" TO "anon";
GRANT ALL ON TABLE "public"."place_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."place_ratings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_ratings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_ratings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_ratings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_tags" TO "anon";
GRANT ALL ON TABLE "public"."place_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."place_tags" TO "service_role";



GRANT ALL ON TABLE "public"."place_types" TO "anon";
GRANT ALL ON TABLE "public"."place_types" TO "authenticated";
GRANT ALL ON TABLE "public"."place_types" TO "service_role";



GRANT ALL ON TABLE "public"."place_wishlist" TO "anon";
GRANT ALL ON TABLE "public"."place_wishlist" TO "authenticated";
GRANT ALL ON TABLE "public"."place_wishlist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_wishlist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_wishlist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_wishlist_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."places" TO "anon";
GRANT ALL ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON TABLE "public"."places_bookmarked" TO "anon";
GRANT ALL ON TABLE "public"."places_bookmarked" TO "authenticated";
GRANT ALL ON TABLE "public"."places_bookmarked" TO "service_role";



GRANT ALL ON TABLE "public"."places_discovered" TO "anon";
GRANT ALL ON TABLE "public"."places_discovered" TO "authenticated";
GRANT ALL ON TABLE "public"."places_discovered" TO "service_role";



GRANT ALL ON TABLE "public"."places_explored" TO "anon";
GRANT ALL ON TABLE "public"."places_explored" TO "authenticated";
GRANT ALL ON TABLE "public"."places_explored" TO "service_role";



GRANT ALL ON TABLE "public"."places_liked" TO "anon";
GRANT ALL ON TABLE "public"."places_liked" TO "authenticated";
GRANT ALL ON TABLE "public"."places_liked" TO "service_role";



GRANT ALL ON TABLE "public"."places_viewed" TO "anon";
GRANT ALL ON TABLE "public"."places_viewed" TO "authenticated";
GRANT ALL ON TABLE "public"."places_viewed" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_log" TO "anon";
GRANT ALL ON TABLE "public"."purchase_log" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchase_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."refresh_tokens" TO "anon";
GRANT ALL ON TABLE "public"."refresh_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."refresh_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."reviews_images" TO "anon";
GRANT ALL ON TABLE "public"."reviews_images" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews_images" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."shopify_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_unlocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shopify_unlocks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shopify_unlocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shopify_unlocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tag_gauge_mapping" TO "anon";
GRANT ALL ON TABLE "public"."tag_gauge_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_gauge_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."territory_name_proposals" TO "anon";
GRANT ALL ON TABLE "public"."territory_name_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."territory_name_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."territory_name_votes" TO "anon";
GRANT ALL ON TABLE "public"."territory_name_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."territory_name_votes" TO "service_role";



GRANT ALL ON TABLE "public"."territory_tiers" TO "anon";
GRANT ALL ON TABLE "public"."territory_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."territory_tiers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."territory_tiers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."territory_tiers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."territory_tiers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."title_fragments" TO "anon";
GRANT ALL ON TABLE "public"."title_fragments" TO "authenticated";
GRANT ALL ON TABLE "public"."title_fragments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."title_fragments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."title_fragments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."title_fragments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."titles" TO "anon";
GRANT ALL ON TABLE "public"."titles" TO "authenticated";
GRANT ALL ON TABLE "public"."titles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tutorial_slides" TO "anon";
GRANT ALL ON TABLE "public"."tutorial_slides" TO "authenticated";
GRANT ALL ON TABLE "public"."tutorial_slides" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tutorial_slides_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tutorial_slides_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tutorial_slides_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_fragments" TO "anon";
GRANT ALL ON TABLE "public"."user_fragments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_fragments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict xI89Ik6qEvlLid4fisXO3jfmrgSVlLoLdO7mbVBHCSmWrvRT9svt6dP1DygFGJS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ad_tips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ad_tips" ("id", "title", "subtitle", "tag", "active", "created_at") FROM stdin;
3	Nommer son territoire	Si trois lieux ou plus fusionnent sur la carte, les membres de la faction peuvent proposer des noms pour ce territoire. Plus un joueur a participé, plus il peut voté.	astuce	f	2026-03-25 14:20:07.768521+00
8	Une taverne médiéval-fantastique sur Toulouse	Runes de Chêne vous annonce son partenariat futur avec la Taverne de Trayaa, un projet porté par une actuelle utilisatrice de l'application. Un projet ambitieux qui a besoin de vous dès aujourd'hui pour se construire. Aux armes, compagnons ! ⚔️	astuce	t	2026-04-05 22:10:58.453711+00
6	Deux boutiques nomades !	Runes de Chêne n'a pas de boutique physique, mais possède deux stands nomades qui viennent à votre rencontre toute l'année sur des festivals.	astuce	t	2026-03-25 14:22:15.300603+00
4	Equipez-vous !	Chaque Fragment (vêtements) acquis sur la boutique Runes de Chêne, augmente vos statistiques de jeu.	astuce	t	2026-03-25 14:21:01.923101+00
5	Une marque + Une application	Conquête est l'application officielle de la marque Runes de Chêne. Entreprise familiale, elle se spécialise dans le vêtement durable et l'illustration historique depuis 2023.	astuce	t	2026-03-25 14:21:39.267479+00
\.


--
-- Data for Name: ad_screens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ad_screens" ("id", "image_url", "product_url", "active", "created_at", "title", "linked_tip_id") FROM stdin;
6	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448782449.webp	https://runesdechene.com/products/t-shirt-unisexe-lesprit-du-loup	f	2026-03-25 14:26:23.062937+00	T-shirt Loup	\N
4	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448772531.jpg	https://runesdechene.com/products/sweatshirt-premium-varegue	f	2026-03-25 14:26:13.423655+00	Sweatshirt oversized Varègue	\N
5	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448778767.webp	https://runesdechene.com/products/t-shirt-overzised-varegue	f	2026-03-25 14:26:19.407999+00	T-shirt oversized Valkyrie	\N
1	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774446635712.png	https://runesdechene.com/products/t-shirt-unisexe-lesprit-du-hibou?variant=52906060054795	f	2026-03-25 13:50:36.487011+00	T-shirt Hibou	\N
8	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1775426972524.png	https://fr.ulule.com/la-taverne-de-trayaa----une-taverne-medievale-fantasy/	t	2026-04-05 22:09:34.528707+00	SOUTENIR SUR ULULE	8
2	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448767545.webp	https://runesdechene.com/products/druide-t-shirt-oversized	t	2026-03-25 14:26:08.303461+00	T-shirt oversized Druide	\N
3	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448770273.jpg	https://runesdechene.com/products/sweatshirt-premium-varegue	t	2026-03-25 14:26:10.900863+00	Sweatshirt Oversized Valkyrie	\N
7	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-ads/screen-1774448792696.jpeg	https://runesdechene.com/products/veste-zipee-varegue	t	2026-03-25 14:26:33.283546+00	Veste Varègue	\N
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."app_settings" ("key", "value", "updated_at") FROM stdin;
underdog_enabled	false	2026-03-24 12:43:02.546258+00
shopify_access_token	REPLACE_FROM_ENV_AFTER_RESTORE	2026-03-31 11:39:21.33355+00
shopify_shop	eef6c4-b5.myshopify.com	2026-03-31 11:39:21.408699+00
default_max_energy	9	2026-04-06 12:02:12.232414+00
erudition_add_carnet	1	2026-04-06 13:28:28.350531+00
underdog_multiplier	2	2026-03-24 12:43:02.546258+00
ad_screen_duration	5	2026-03-25 13:31:13.682974+00
enigma_place_influence_base	2	2026-04-06 13:28:28.350531+00
enigma_place_influence_per_diff	1	2026-04-06 13:28:28.350531+00
unknown_place_icon	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-assets/unknown-place-icon-1771775818328.webp	2026-02-22 15:56:58.524+00
enigma_place_erudition_base	2	2026-04-06 13:28:28.350531+00
conquest_base_cycle	7200	2026-03-27 17:38:04.233015+00
construction_base_cycle	7200	2026-03-27 17:38:04.233015+00
vitalite_base_cycle	7200	2026-03-27 17:38:04.233015+00
enigma_place_erudition_per_diff	1	2026-04-06 13:28:28.350531+00
enigma_influence_hard	5	2026-04-06 13:28:28.350531+00
fragment_enigma_influence_easy	4	2026-04-08 00:46:40.135482+00
enigma_bonus_energy_cost	5	2026-04-06 23:38:37.666081+00
faction_change_cooldown_days	30	2026-04-07 10:40:26.213978+00
distance_gps_km	0.5	2026-03-27 18:17:23.827338+00
distance_close_km	50	2026-03-27 18:17:23.827338+00
distance_mid_km	100	2026-03-27 18:17:23.827338+00
distance_mult_gps	0.2	2026-03-27 18:17:23.827338+00
distance_mult_close	1	2026-03-27 18:17:23.827338+00
distance_mult_mid	2	2026-03-27 18:17:23.827338+00
distance_mult_far	3	2026-03-27 18:17:23.827338+00
energy_base_cycle	3600	2026-03-27 17:38:04.233015+00
fragment_enigma_influence_medium	7	2026-04-08 00:46:40.135482+00
fragment_enigma_influence_hard	10	2026-04-08 00:46:40.135482+00
fragment_affinity_bonus_default	3	2026-04-07 15:39:36.497395+00
territory_size_defense_mult	0.1	2026-03-28 12:13:28.536+00
zone_fort_multiplier	0.3	2026-03-28 12:13:28.536+00
zone_detection_radius_km	3	2026-03-28 12:13:28.536+00
glory_discover	2	2026-03-30 14:02:26.432015+00
glory_claim	5	2026-03-30 14:02:26.432015+00
glory_fortify	5	2026-03-30 14:02:26.432015+00
glory_cost_bonus_pct	50	2026-03-30 14:02:26.432015+00
fragment_collection_1	1	2026-04-07 15:39:36.497395+00
fragment_collection_2	3	2026-04-07 15:39:36.497395+00
fragment_collection_3	5	2026-04-07 15:39:36.497395+00
fragment_collection_4	8	2026-04-07 15:39:36.497395+00
fragment_enigma_influence	5	2026-04-07 15:39:36.497395+00
fragment_enigma_erudition	2	2026-04-07 15:39:36.497395+00
fragment_enigma_cooldown_hours	48	2026-04-07 16:09:54.414181+00
enigma_erudition_very_easy	1	2026-04-08 00:13:56.638549+00
enigma_erudition_easy	1	2026-04-06 13:28:28.350531+00
enigma_erudition_hard	3	2026-04-06 13:28:28.350531+00
enigma_erudition_wrong	0	2026-04-08 00:52:23.698748+00
enigma_erudition_medium	3	2026-04-06 13:28:28.350531+00
fragment_enigma_erudition_easy	3	2026-04-08 00:52:23.698748+00
fragment_enigma_erudition_medium	5	2026-04-08 00:52:23.698748+00
fragment_enigma_erudition_hard	7	2026-04-08 00:52:23.698748+00
influence_visit_gps_stock	5	2026-04-08 12:00:32.723699+00
influence_revisit_gps_stock	3	2026-04-08 12:00:32.723699+00
erudition_enigma_wrong	0	2026-04-06 13:28:28.350531+00
exploration_visit_gps	20	2026-04-06 13:28:28.350531+00
influence_visit_gps	20	2026-04-06 13:28:28.350531+00
erudition_add_info	1	2026-04-09 13:09:50.771977+00
share_text_template	Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}.	2026-04-21 07:28:51.767363+00
influence_decay_per_week	5	2026-04-06 13:28:28.350531+00
influence_max_remote_per_day	5	2026-04-06 13:28:28.350531+00
influence_per_vote	1	2026-04-06 13:28:28.350531+00
influence_revisit_gps	10	2026-04-07 13:36:41.050634+00
exploration_add_carnet	1	2026-04-06 13:28:28.350531+00
exploration_add_photo	1	2026-04-06 13:28:28.350531+00
exploration_add_place	10	2026-04-06 13:28:28.350531+00
exploration_gps_bonus	10	2026-04-07 11:32:37.34055+00
influence_add_carnet	0	2026-04-06 13:28:28.350531+00
influence_add_photo	0	2026-04-06 13:28:28.350531+00
influence_add_place	20	2026-04-06 13:28:28.350531+00
enigma_influence_very_easy	2	2026-04-08 00:13:56.638549+00
enigma_influence_easy	3	2026-04-06 13:28:28.350531+00
enigma_influence_medium	4	2026-04-06 13:28:28.350531+00
\.


--
-- Data for Name: construction_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."construction_types" ("level", "name", "description", "image_url", "cost", "conquest_bonus", "tag_ids", "created_at", "updated_at") FROM stdin;
1	Tour de guet	Coute +1 point de conquete aux ennemis pour revendiquer ce lieu.	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/construction-1-1772054491097.webp	1	1	\N	2026-02-25 21:19:50.183235+00	2026-02-25 21:21:32.19+00
2	Bastion	Coute +2 points de conquete aux ennemis pour revendiquer ce lieu.	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/construction-2-1772054504944.webp	2	2	\N	2026-02-25 21:19:50.183235+00	2026-03-01 10:32:49.156+00
3	Donjon	Coute +3 points de conquete aux ennemis pour revendiquer ce lieu.	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/construction-3-1772054520652.webp	3	3	\N	2026-02-25 21:19:50.183235+00	2026-03-01 10:32:59.814+00
4	Forteresse	Forteresse imprenable. Coute +4 points de conquete aux ennemis.	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/construction-4-1772054524254.webp	5	5	\N	2026-02-25 21:19:50.183235+00	2026-03-01 10:33:12.07+00
\.


--
-- Data for Name: factions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."factions" ("id", "title", "color", "pattern", "order", "created_at", "updated_at", "description", "image_url", "bonus_energy", "bonus_conquest", "bonus_construction", "bonus_regen", "bonus_regen_energy", "bonus_regen_conquest", "bonus_regen_construction", "bonus_vitalite", "bonus_regen_vitalite", "adjective") FROM stdin;
faction-nordique	Les Explorateurs de Midgard	#2665c9	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/explorateur-de-midgard.svg	1	2026-02-21 18:20:05.537926+00	2026-03-27 23:55:54.683+00	Les Explorateurs accueillent les aventuriers intrépides, ceux pour qui chaque horizon cache une découverte. Curieux, plein de bravoures ils sillonnent le monde à la recherche de merveilles.\n\n<b>Ils sont portés par l'envie de nouveauté et de grands espaces.</b>\n	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/explorateur-de-midgard-image.webp	0.0	0.0	0.0	0.0	0.0	0.0	0.0	1.0	0.0	Nordique
faction-romaine	Les Légions de Rome	#cb2020	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/les-aigles-des-romes.svg	3	2026-02-23 15:57:31.915513+00	2026-03-27 23:55:54.683+00	Les Légions accueillent les meneurs et les bâtisseurs, ceux qui aiment structurer et laisser leur empreinte, désireux d'apporter la civilisation sans effacer les autres peuples. \n\n<b>Ils sont portés par l'envie de grandeur et de stabilité.</b>\n	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/les-aigles-des-romes-image.webp	0.0	1.0	1.0	0.0	0.0	50.0	0.0	0.0	0.0	Romain
faction-celtique	Les Compagnons de Lug	#69a72a	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/compagnons-de-lug.svg	0	2026-02-21 18:20:00.297525+00	2026-03-28 00:12:05.357+00	Les Compagnons accueillent les esprits curieux et polyvalents, ceux qui cherchent à comprendre les mystères du passé et à transmettre la parole ancienne.\n\n<b>Ils sont portés par la curiosité et le lien à la Nature.</b>  	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/compagnons-de-lug-image.webp	0.0	0.0	1.0	0.0	0.0	0.0	0.0	2.0	50.0	Celtique
faction-byzantine	La Vieille Garde du Bosphore	#9c3088	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/les-aigles-de-byzance.svg	2	2026-02-22 16:04:38.466403+00	2026-03-28 12:18:06.252+00	La Vieille Garde accueille les esprits nostalgiques et stratèges, ceux qui observent avant d'agir et protègent ce qui a de la valeur. Téméraires, ils se dressent au crépuscule du monde.\n\n<b>Ils sont portés par l'envie de connaissance et de sens.</b>	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/faction-patterns/les-aigles-de-byzance-image.webp	0.0	1.0	2.0	0.0	0.0	0.0	50.0	0.0	0.0	Byzantin
\.


--
-- Data for Name: title_fragments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."title_fragments" ("id", "name", "description", "icon", "collection", "bonus_type", "bonus_value", "created_at", "image_url", "link_url", "visible", "icon_url", "ability_type", "ability_cooldown_hours", "ability_value") FROM stdin;
5	Avalon	L'arbre sacré des Celtes, le Pommier d'Avalon aux pommes d'immortalités 	🌲	faction-celtique	regen_energy	20.00	2026-03-24 19:32:44.984129+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-5.webp?t=1775589146365	https://runesdechene.com/collections/avalon	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-5.webp?t=1774512922624	\N	24	0.00
8	Morrigan	La déesse de la guerre Celtique, à la fois prophétesse et divinité du massacre	🌙	faction-celtique	\N	0.00	2026-03-24 19:55:24.698322+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-8.webp?t=1775589561740	https://runesdechene.com/collections/morrigan	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-8.webp?t=1774512843593	double_glory	24	2.00
7	Skjaldmö	La porteuse de bouclier qui fit trembler les champs de bataille	🛡️	faction-nordique	max_energy	1.00	2026-03-24 19:50:55.486619+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-7.webp?t=1775589556684	https://runesdechene.com/collections/skjaldmo	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-7.webp?t=1774515566327	\N	24	0.00
9	Druide	Le conseiller des Rois, sage du monde Celte	🧙‍♂️	faction-celtique	\N	0.00	2026-03-24 19:55:57.571889+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-9.webp?t=1775587368060	https://runesdechene.com/collections/druide	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-9.webp?t=1774512835643	discount_claim	24	50.00
6	Valkyrie	La créature céleste qui venait chercher les défunts	⚔️	faction-nordique	max_energy	1.00	2026-03-24 19:34:41.619755+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-6.webp?t=1775589553628	https://runesdechene.com/collections/valkyrie	t	\N	\N	24	0.00
4	L'esprit du Hibou	Le totem du Hibou - Vigilance, sagesse, mystère	🦉	faction-byzantine	\N	0.00	2026-03-24 19:07:30.041138+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-4.webp?t=1775589549774	https://runesdechene.com/collections/totem-du-hibou	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-4.webp?t=1774536000125	free_discover	24	0.00
10	Ambassadeur	\N	✨	\N	\N	0.00	2026-03-26 13:44:40.652374+00	\N	\N	f	\N	\N	24	0.00
1	Le Varègue	Le protecteur de Constantinople, élite de l'Empire Romain d'Orient	⚔️	faction-byzantine	max_energy	1.00	2026-03-24 14:05:25.948864+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-1.webp?t=1775587547967	https://runesdechene.com/collections/varegue	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-1.webp?t=1774516089235	\N	24	0.00
3	Demiurge (Admin)	Vous travaillez pour la boutique Runes de Chêne	🏅	\N	regen_construction	20.00	2026-03-24 18:58:16.678628+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-3.webp?t=1774378742855	\N	f	\N	\N	24	0.00
2	L'esprit du Loup	Le totem du Loup - Loyauté, Endurance, Vitesse	🐺	faction-nordique	regen_energy	10.00	2026-03-24 14:13:00.274957+00	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/fragment-2.webp?t=1775588621465	https://runesdechene.com/collections/lesprit-du-loup	t	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-fragments/icon-2.webp?t=1774515586846	\N	24	0.00
\.


--
-- Data for Name: enigmas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."enigmas" ("id", "type", "difficulty", "heritage_id", "place_tag", "lore_text", "question", "format", "choices", "answer", "explanation", "active", "created_at", "fragment_id") FROM stdin;
1	daily	easy	faction-celtique	\N	Pline l'Ancien raconte qu'une fois l'an, un druide vêtu de blanc grimpait dans un arbre sacré, armé d'une serpe d'or. Ce qu'il cueillait valait plus que de l'or aux yeux des Gaulois.	Quelle plante les druides récoltaient-ils cérémonieusement sur les chênes, selon Pline l'Ancien ?	qcm	["Le lierre", "Le gui", "La bruyère", "Le houx"]	Le gui	Pline (Histoire naturelle, XVI) décrit la récolte du gui au sixième jour de la lune, suivie du sacrifice de deux taureaux blancs. Le gui de chêne, extrêmement rare, était considéré comme un don divin.	t	2026-04-06 13:48:01.290258+00	\N
2	daily	easy	faction-nordique	\N	Ils partaient de Scandinavie sur des navires à fond plat, capables de remonter les fleuves. Leurs voiles rayées terrorisaient les côtes de l'Europe pendant trois siècles.	Comment appelle-t-on les navires longs des Vikings, conçus pour la guerre et l'exploration ?	qcm	["Kogge", "Drakkar", "Trirème", "Galion"]	Drakkar	Le mot "drakkar" vient du norrois "dreki" (dragon), car la proue était souvent ornée d'une tête de dragon. Ces navires pouvaient transporter 60 guerriers et naviguer aussi bien en haute mer que sur des rivières peu profondes.	t	2026-04-06 13:48:01.290258+00	\N
3	daily	easy	faction-byzantine	\N	En 330, Constantin déplace le cœur de l'Empire vers l'Orient. La ville qu'il fonde survivra mille ans à celle qu'il quitte.	Quel nom portait Constantinople avant que Constantin ne la rebaptise ?	qcm	["Nicée", "Antioche", "Byzance", "Éphèse"]	Byzance	La cité grecque de Byzance, fondée vers 657 av. J.-C. par des colons de Mégare, contrôlait le détroit du Bosphore. Constantin y vit l'emplacement stratégique parfait pour sa nouvelle capitale, entre Europe et Asie.	t	2026-04-06 13:48:01.290258+00	\N
4	daily	easy	faction-romaine	\N	Quand les légions s'arrêtaient pour la nuit, elles ne dormaient jamais à la belle étoile. En quelques heures, elles bâtissaient une forteresse temporaire — chaque soir, depuis des siècles.	Comment appelle-t-on le camp fortifié que les légions romaines construisaient chaque soir en territoire ennemi ?	qcm	["L'oppidum", "Le castrum", "Le forum", "La villa"]	Le castrum	Un castrum pouvait être érigé en 3 à 5 heures par une légion entraînée : fossé, palissade, rues en grille, tentes ordonnées. Beaucoup de villes européennes actuelles (Chester, Castra Regina/Ratisbonne) sont nées de ces camps devenus permanents.	t	2026-04-06 13:48:01.290258+00	\N
5	daily	easy	faction-celtique	\N	Avant la conquête romaine, les Gaulois frappaient monnaie. Leurs pièces d'or rivalisaient avec les statères grecs — et les motifs qu'ils y gravaient n'avaient rien de primitif.	Quel peuple gaulois a donné son nom à la ville de Paris ?	qcm	["Les Sénons", "Les Éduens", "Les Parisii", "Les Arvernes"]	Les Parisii	Les Parisii occupaient l'île de la Cité et ses environs. Leur oppidum, Lutèce, était un carrefour commercial sur la Seine. Leurs monnaies d'or, retrouvées jusqu'en Angleterre, témoignent d'un réseau d'échanges considérable.	t	2026-04-06 13:48:01.290258+00	\N
6	daily	easy	faction-nordique	\N	L'écriture des peuples germaniques et scandinaves n'utilisait ni parchemin ni encre. Chaque signe était taillé dans le bois ou la pierre, fait de lignes droites — plus faciles à graver qu'à tracer.	Comment appelle-t-on l'alphabet utilisé par les peuples nordiques avant la christianisation ?	qcm	["Les hiéroglyphes", "Les runes", "Les ogham", "Les cunéiformes"]	Les runes	Le futhark ancien (du nom de ses six premières lettres : F-U-Þ-A-R-K) compte 24 runes. Chaque signe avait un nom et une signification au-delà du son : *fehu* (bétail/richesse), *ansuz* (dieu/Odin). Les plus anciennes inscriptions runiques datent du IIe siècle.	t	2026-04-06 13:48:01.290258+00	\N
7	daily	easy	faction-byzantine	\N	Quand les barbares ont submergé Rome en 476, une moitié de l'Empire a continué comme si de rien n'était. Pendant mille ans encore, elle a maintenu le droit, la foi et les routes commerciales.	En quelle année Constantinople est-elle finalement tombée aux mains des Ottomans ?	qcm	["1204", "1389", "1453", "1492"]	1453	Le 29 mai 1453, après un siège de 53 jours, Mehmed II entre dans la ville. Les murailles théodosiennes, imprenables pendant un millénaire, ont cédé face aux canons géants de l'ingénieur hongrois Urbain. Le dernier empereur, Constantin XI, est mort les armes à la main.	t	2026-04-06 13:48:01.290258+00	\N
8	daily	easy	faction-romaine	\N	Une route droite, pavée de pierres taillées, bordée de bornes milliaires. On dit qu'elle menait partout — et c'était presque vrai.	Quelle expression latine signifie que « tous les chemins mènent à Rome » et désigne la borne d'or du Forum ?	qcm	["Via Appia", "Milliarium Aureum", "Cursus Publicum", "Pax Romana"]	Milliarium Aureum	Auguste fit ériger le Milliarium Aureum (borne milliaire dorée) au Forum en 20 av. J.-C. Toutes les distances de l'Empire étaient mesurées depuis ce point. Le réseau routier romain couvrait 400 000 km — dont certains tronçons sont encore visibles aujourd'hui.	t	2026-04-06 13:48:01.290258+00	\N
9	daily	easy	faction-celtique	\N	Des milliers de pierres dressées, alignées sur des kilomètres, dans la lande bretonne. Personne ne sait vraiment pourquoi elles sont là — et ça dure depuis 6 000 ans.	Dans quelle commune bretonne trouve-t-on le plus célèbre alignement mégalithique d'Europe ?	qcm	["Locmariaquer", "Carnac", "Brocéliande", "Stonehenge"]	Carnac	Les alignements de Carnac comptent près de 3 000 menhirs répartis sur 4 km, érigés entre 4500 et 3300 av. J.-C. — bien avant les pyramides. Leur fonction exacte reste débattue : calendrier astronomique, chemin processionnaire, marqueur territorial ?	t	2026-04-06 13:48:01.290258+00	\N
10	daily	easy	faction-nordique	\N	Chaque guerrier nordique rêvait d'y festoyer après la mort, attablé devant un sanglier éternellement renaissant, une corne d'hydromel à la main.	Comment s'appelle le palais d'Odin où les guerriers tombés au combat sont accueillis ?	qcm	["Asgard", "Le Walhalla", "Midgard", "Helheim"]	Le Walhalla	Le Valhöll ("hall des occis") n'accueillait que les guerriers morts les armes à la main, choisis par les Valkyries. Ils y combattaient chaque jour et festoyaient chaque nuit, en attendant le Ragnarök — la bataille finale des dieux.	t	2026-04-06 13:48:01.290258+00	\N
11	daily	easy	faction-romaine	\N	Sous la République puis l'Empire, un citoyen romain pouvait se baigner, faire du sport, lire, discuter philosophie et conclure des affaires — le tout dans un seul bâtiment public.	Comment appelle-t-on les grands complexes de bains publics romains ?	qcm	["Les arènes", "Les thermes", "Les basiliques", "Les gymnases"]	Les thermes	Les thermes de Caracalla à Rome (216 ap. J.-C.) pouvaient accueillir 1 600 baigneurs simultanément. On y trouvait bibliothèques, jardins, salles de sport et boutiques. L'entrée était gratuite ou quasi gratuite — c'était un service public essentiel.	t	2026-04-06 13:48:01.290258+00	\N
12	daily	easy	faction-byzantine	\N	Justinien voulait bâtir un lieu de culte qui ferait oublier le temple de Salomon. Il y a consacré les revenus fiscaux de l'Empire pendant cinq ans. Le résultat a stupéfié le monde.	Quel monument Justinien a-t-il fait construire à Constantinople en 537 ?	qcm	["Le Palais de Topkapi", "La Mosquée bleue", "Sainte-Sophie", "Sainte-Irène"]	Sainte-Sophie	La basilique Sainte-Sophie (Hagia Sophia) possédait la plus grande coupole du monde pendant près de 1 000 ans (31 mètres de diamètre). À sa consécration, Justinien aurait déclaré : « Salomon, je t'ai surpassé. »	t	2026-04-06 13:48:01.290258+00	\N
13	daily	easy	faction-celtique	\N	César écrit que les Gaulois « se considèrent tous comme descendants du même dieu ». Ce dieu de la nuit et des morts fondait leur calendrier et leur conception du temps — qui commençait par l'obscurité.	Selon César, de quel dieu les Gaulois prétendaient-ils tous descendre ?	qcm	["Toutatis", "Lug", "Dis Pater", "Cernunnos"]	Dis Pater	César (Guerre des Gaules, VI.18) écrit que les druides enseignaient cette filiation. Dis Pater est l'interprétation romaine — le nom gaulois réel nous échappe. Cette croyance explique pourquoi les Gaulois comptaient le temps par nuits et non par jours.	t	2026-04-06 13:48:01.290258+00	\N
14	daily	easy	faction-romaine	\N	Deux mille ans après sa construction, il est toujours debout, avec son oculus ouvert sur le ciel. Quand il pleut, l'eau entre — et s'évacue par un système de drainage toujours fonctionnel.	Quel temple romain, bâti sous Hadrien, possède la plus grande coupole en béton non armé jamais construite ?	qcm	["Le Colisée", "Le Panthéon", "Le temple de Jupiter", "La Maison carrée"]	Le Panthéon	La coupole du Panthéon (43,3 m de diamètre) n'a été surpassée qu'au XVe siècle par Brunelleschi à Florence. Le béton romain, à base de cendres volcaniques (pouzzolane), se renforce avec le temps au contact de l'eau — l'exact opposé du béton moderne.	t	2026-04-06 13:48:01.290258+00	\N
15	daily	easy	faction-nordique	\N	Un alphabet de glace et de feu, gravé sur des pierres dressées dans toute la Scandinavie. Chaque inscription est un message laissé aux vivants par ceux qui savaient tailler la pierre.	Combien de runes compte le futhark ancien, l'alphabet runique le plus répandu ?	qcm	["16", "20", "24", "32"]	24	Le futhark ancien (IIe-VIIIe siècle) compte 24 runes, divisées en trois groupes de huit (ættir). Les Vikings l'ont simplifié en futhark récent à 16 runes — paradoxalement, moins de signes pour noter plus de sons, rendant les inscriptions plus ambiguës.	t	2026-04-06 13:48:01.290258+00	\N
16	daily	easy	faction-byzantine	\N	Deux frères de Thessalonique, envoyés en mission chez les Slaves, ont inventé un système d'écriture pour traduire la Bible. Leur héritage se lit encore dans la moitié de l'Europe.	Quel alphabet, créé par les disciples de Cyrille et Méthode, est encore utilisé en Russie, Serbie et Bulgarie ?	qcm	["L'alphabet glagolitique", "L'alphabet cyrillique", "L'alphabet copte", "L'alphabet arménien"]	L'alphabet cyrillique	Cyrille a d'abord créé l'alphabet glagolitique vers 863. Ses disciples ont ensuite développé le cyrillique, plus simple et basé sur l'onciale grecque. Aujourd'hui, plus de 250 millions de personnes utilisent cet alphabet au quotidien.	t	2026-04-06 13:48:01.290258+00	\N
17	daily	easy	faction-celtique	\N	En 52 av. J.-C., un jeune chef arverne unit les tribus gauloises pour la première — et dernière — fois. Sa défaite finale est devenue le mythe fondateur de la résistance gauloise.	Quel chef gaulois a mené la grande révolte contre César en 52 av. J.-C. ?	qcm	["Ambiorix", "Vercingétorix", "Brennus", "Diviciacus"]	Vercingétorix	Son nom signifie « roi suprême des guerriers » (ver-cingeto-rix). Après sa victoire à Gergovie, il a été vaincu à Alésia par le siège de César. Emprisonné six ans à Rome, il a été étranglé lors du triomphe de César en 46 av. J.-C.	t	2026-04-06 13:48:01.290258+00	\N
18	daily	easy	faction-romaine	\N	En 79, le Vésuve a englouti deux villes sous des mètres de cendres. Dix-sept siècles plus tard, les archéologues ont retrouvé des pains intacts, des fresques éclatantes et des corps figés dans leur dernier geste.	Quelle ville romaine, ensevelie par le Vésuve en 79 ap. J.-C., est le site archéologique le plus visité d'Italie ?	qcm	["Herculanum", "Pompéi", "Stabies", "Oplontis"]	Pompéi	Pompéi comptait environ 11 000 habitants. Les cendres ont préservé un instantané de la vie quotidienne romaine : tavernes, lupanars, graffitis politiques. On y a retrouvé des slogans électoraux peints sur les murs — la plus ancienne propagande politique conservée.	t	2026-04-06 13:48:01.290258+00	\N
19	daily	easy	faction-nordique	\N	Un guerrier nordique pouvait entrer en transe au combat, mordant son bouclier, hurlant comme une bête. Ni la douleur ni la peur ne semblaient l'atteindre — ses ennemis le croyaient possédé.	Comment appelle-t-on ces guerriers vikings réputés combattre dans une fureur sacrée incontrôlable ?	qcm	["Les Ulfhednar", "Les Berserkers", "Les Jomsvikings", "Les Housecarls"]	Les Berserkers	Le mot vient du norrois "berserkr" — peut-être "chemise d'ours" (ber-serkr). Les sagas décrivent leur furie au combat (berserksgangr). Les théories modernes évoquent l'amanite tue-mouches, l'auto-hypnose ou un état de stress extrême. Plusieurs lois scandinaves médiévales ont fini par interdire le berserksgangr.	t	2026-04-06 13:48:01.290258+00	\N
20	daily	easy	faction-byzantine	\N	L'hippodrome de Constantinople n'était pas qu'un cirque — c'était le cœur politique de l'Empire. Les factions de supporters y faisaient et défaisaient les empereurs.	Quelles étaient les deux principales factions rivales de l'hippodrome de Constantinople ?	qcm	["Rouges et Noirs", "Bleus et Verts", "Blancs et Pourpres", "Or et Argent"]	Bleus et Verts	Les Bleus (aristocrates, orthodoxes) et les Verts (marchands, monophysites) étaient bien plus que des clubs sportifs. En 532, leur révolte commune (sédition Nika) a failli renverser Justinien et détruit la moitié de Constantinople avant d'être écrasée dans le sang — 30 000 morts dans l'hippodrome.	t	2026-04-06 13:48:01.290258+00	\N
21	daily	medium	faction-celtique	\N	Les archéologues ont retrouvé des crânes percés datant du Néolithique, avec des signes de cicatrisation — preuve que le patient a survécu. Nos ancêtres ouvraient le crâne des vivants, et certains s'en remettaient.	Comment appelle-t-on l'opération chirurgicale consistant à percer un trou dans le crâne, pratiquée dès le Néolithique en Europe ?	qcm	["La trépanation", "La craniotomie", "La lobotomie", "La cautérisation"]	La trépanation	Des crânes trépanés avec repousse osseuse (donc survie du patient) ont été retrouvés à Ensisheim (Alsace, 5000 av. J.-C.). Le taux de survie estimé dépasse 50 % — comparable à celui des chirurgiens de la guerre de Sécession, 7 000 ans plus tard.	t	2026-04-06 13:48:01.290258+00	\N
22	daily	medium	faction-nordique	\N	Bien avant Christophe Colomb, des marins nordiques ont posé le pied sur un continent inconnu. Ils y ont trouvé du raisin sauvage et des prairies verdoyantes — mais n'ont pas pu s'y maintenir.	Comment les Vikings appelaient-ils la terre qu'ils ont découverte en Amérique du Nord vers l'an 1000 ?	qcm	["Groenland", "Markland", "Vinland", "Helluland"]	Vinland	Leif Eriksson a atteint le Vinland (« terre de la vigne ») vers l'an 1000. Le site de L'Anse aux Meadows (Terre-Neuve), fouillé en 1960, a confirmé la présence viking en Amérique. Les sagas mentionnent des conflits avec les autochtones (Skrælings) qui ont forcé l'abandon de la colonie.	t	2026-04-06 13:48:01.290258+00	\N
53	daily	very_easy	faction-celtique	\N	Son vrai nom était Sétanta, mais un exploit de jeunesse lui donna un nouveau nom...	Quel héros celtique est célèbre pour sa force surhumaine et son chien de garde ?	qcm	["Cú Chulainn", "Vercingétorix", "Brennus", "Boudicca"]	Cú Chulainn	Cú Chulainn, "le chien de Culann", est le plus grand héros de la mythologie irlandaise. Enfant, il tua le chien de garde du forgeron Culann et prit sa place.	t	2026-04-08 00:13:56.638549+00	\N
23	daily	medium	faction-byzantine	\N	Sur les murs de la flotte impériale, des siphons crachaient un feu liquide que l'eau ne pouvait éteindre. L'arme la plus redoutée de la Méditerranée médiévale — et personne ne connaît la recette.	Comment appelle-t-on l'arme incendiaire secrète utilisée par la marine byzantine, dont la composition reste inconnue ?	qcm	["Le naphta", "Le feu grégeois", "L'huile ardente", "Le soufre liquide"]	Le feu grégeois	Inventé vers 672, le feu grégeois brûlait sur l'eau et ne pouvait être éteint qu'avec du sable ou du vinaigre. Sa recette était un secret d'État si bien gardé qu'il s'est perdu à la chute de l'Empire. Les historiens pensent à un mélange de naphte, résine et chaux vive, mais aucune reconstitution moderne n'a reproduit tous les effets décrits.	t	2026-04-06 13:48:01.290258+00	\N
25	daily	medium	faction-celtique	\N	Les Romains décrivent avec horreur une coutume gauloise : après la bataille, les guerriers fixaient les têtes de leurs ennemis vaincus sur les portes de leurs maisons. Pour eux, c'était un honneur — pas de la barbarie.	Selon les auteurs antiques et l'archéologie, que faisaient les Gaulois avec les têtes de leurs ennemis vaincus ?	qcm	["Ils les brûlaient en offrande", "Ils les embaumaient et les exposaient", "Ils les enterraient avec les leurs", "Ils les jetaient dans les rivières"]	Ils les embaumaient et les exposaient	Diodore de Sicile et Strabon confirment cette pratique. Au sanctuaire de Roquepertuse (Bouches-du-Rhône), des piliers percés de niches contenaient des crânes humains. Pour les Celtes, la tête était le siège de l'âme — posséder celle d'un ennemi, c'était capturer sa force.	t	2026-04-06 13:48:01.290258+00	\N
26	daily	medium	faction-nordique	\N	Des guerriers scandinaves se sont mis au service de l'empereur de Constantinople. Ils formaient sa garde personnelle — les hommes les plus grands, les mieux armés, et les plus loyaux de l'Empire.	Comment s'appelait la garde d'élite de l'empereur byzantin, composée de guerriers scandinaves ?	qcm	["Les Jomsvikings", "La Garde varangienne", "Les Housecarls", "Les Thegns"]	La Garde varangienne	La Garde varangienne (du norrois "væringi", « ceux qui ont prêté serment ») a protégé les empereurs byzantins du Xe au XIVe siècle. Harald Hardrada, futur roi de Norvège, en a fait partie. Ils étaient payés en or et avaient le droit de « piller le palais » à la mort de chaque empereur.	t	2026-04-06 13:48:01.290258+00	\N
27	daily	medium	faction-byzantine	\N	En 1204, une armée chrétienne censée libérer Jérusalem s'est retournée contre la plus grande ville chrétienne du monde. Le sac qui a suivi a choqué l'Europe entière.	Quelle croisade a abouti au sac de Constantinople par les croisés eux-mêmes en 1204 ?	qcm	["La deuxième croisade", "La troisième croisade", "La quatrième croisade", "La cinquième croisade"]	La quatrième croisade	Détournée par Venise (qui finançait la flotte), la quatrième croisade a pillé Constantinople pendant trois jours. Les croisés ont volé les chevaux de bronze de l'hippodrome (aujourd'hui à Venise), fondu des œuvres d'art en lingots, et profané Sainte-Sophie. L'Empire latin qu'ils ont fondé n'a duré que 57 ans.	t	2026-04-06 13:48:01.290258+00	\N
29	daily	medium	faction-celtique	\N	En 390 av. J.-C., des guerriers gaulois entrent dans Rome elle-même. Le chef qui mène le sac exige une rançon en or — et quand les Romains protestent contre les poids truqués, il jette son épée dans la balance.	Quel chef gaulois, lors du sac de Rome, aurait lancé « Vae victis ! » (Malheur aux vaincus !) ?	qcm	["Vercingétorix", "Ambiorix", "Brennus", "Diviciacos"]	Brennus	Brennus et ses Sénons ont pris Rome en 390 av. J.-C. (date traditionnelle). Seul le Capitole a résisté, sauvé — selon la légende — par les oies sacrées de Junon. Le traumatisme du « dies Alliensis » a hanté Rome pendant des siècles et motivé la future conquête de la Gaule.	t	2026-04-06 13:48:01.290258+00	\N
31	daily	medium	faction-romaine	\N	Les ingénieurs romains amenaient l'eau des montagnes jusqu'au cœur des villes, parfois sur plus de 50 km. Ils maintenaient une pente constante de quelques centimètres par kilomètre — sans GPS ni laser.	Quel aqueduc romain du sud de la France, classé au patrimoine mondial, enjambe le Gardon sur trois niveaux d'arches ?	qcm	["L'aqueduc de Ségovie", "Le pont du Gard", "L'aqueduc de Zaghouan", "Les arches de Valens"]	Le pont du Gard	Construit au Ier siècle pour alimenter Nîmes (Nemausus), le pont du Gard culmine à 49 mètres. L'aqueduc complet faisait 50 km avec une pente de seulement 24,8 cm par kilomètre. Les blocs de 6 tonnes sont assemblés sans mortier — et tiennent toujours.	t	2026-04-06 13:48:01.290258+00	\N
32	daily	medium	faction-byzantine	\N	Avant la boussole, avant les GPS, les marins byzantins naviguaient grâce à un texte secret : un guide détaillé de chaque port, courant et récif de la Méditerranée, mis à jour par les capitaines de la flotte impériale.	Comment appelle-t-on les manuels de navigation antiques et byzantins décrivant les côtes et les ports ?	qcm	["Les portulans", "Les périples", "Les itinéraires", "Les cosmographies"]	Les périples	Le plus ancien est le Périple de la mer Érythrée (Ier siècle), décrivant les routes commerciales jusqu'en Inde. Les Byzantins ont maintenu cette tradition de cartographie maritime pendant des siècles. Le mot vient du grec "periplus" — littéralement "navigation autour".	t	2026-04-06 13:48:01.290258+00	\N
34	daily	medium	faction-nordique	\N	Une île volcanique au milieu de l'Atlantique Nord. Les Vikings y ont fondé le premier parlement d'Europe — en plein air, au pied d'une falaise, en 930.	Comment s'appelle l'assemblée islandaise fondée en 930, considérée comme le plus ancien parlement encore en activité ?	qcm	["Le Folketing", "L'Althing", "Le Storting", "Le Løgting"]	L'Althing	L'Althing (Alþingi) se réunissait à Þingvellir, dans un rift tectonique spectaculaire. Les chefs (goðar) y débattaient des lois, réglaient les disputes et prononçaient les mises hors-la-loi. Pas de roi, pas de château — la démocratie nordique fonctionnait en plein vent, devant tout le peuple.	t	2026-04-06 13:48:01.290258+00	\N
36	daily	medium	faction-byzantine	\N	La monnaie byzantine a été la référence internationale pendant 700 ans. Stable, fiable, acceptée de l'Irlande à la Chine — le dollar de l'Antiquité tardive et du Moyen Âge.	Comment s'appelle la pièce d'or byzantine qui a servi de monnaie de référence internationale pendant des siècles ?	qcm	["Le denier", "Le solidus (bezant)", "Le ducat", "Le florin"]	Le solidus (bezant)	Le solidus, introduit par Constantin en 309, est resté à 4,5 g d'or pur pendant 700 ans — une stabilité monétaire unique dans l'histoire. En Occident, on l'appelait « bezant » (de Byzance). Il était accepté de la Scandinavie à Ceylan et a inspiré le dinar arabe.	t	2026-04-06 13:48:01.290258+00	\N
37	daily	medium	faction-celtique	\N	En 1953, au pied du mont Lassois en Bourgogne, des archéologues ouvrent la tombe d'une femme celtique du VIe siècle av. J.-C. À ses côtés : le plus grand vase en bronze jamais retrouvé du monde antique.	Dans quelle ville bourguignonne a-t-on découvert la tombe princière celtique contenant un immense cratère grec en bronze ?	qcm	["Bibracte", "Alésia", "Vix", "Gergovie"]	Vix	Le cratère de Vix mesure 1,64 m de haut et pèse 208 kg — un chef-d'œuvre grec probablement offert en cadeau diplomatique. La défunte, surnommée « la Dame de Vix », portait un torque en or de 480 g. Cette découverte prouve les liens commerciaux directs entre l'élite celtique et la Méditerranée.	t	2026-04-06 13:48:01.290258+00	\N
38	daily	medium	faction-nordique	\N	En 911, le roi de France cède un territoire à un chef viking pour qu'il arrête de piller. Le marché fonctionne — les anciens pillards deviennent les seigneurs les plus redoutables de l'Europe médiévale.	Quel chef viking a reçu la Normandie du roi Charles le Simple par le traité de Saint-Clair-sur-Epte en 911 ?	qcm	["Ragnar Lothbrok", "Ivar le Désossé", "Rollon", "Harald à la Belle Chevelure"]	Rollon	Rollon (Hrólfr) a reçu le comté de Rouen en échange de sa conversion et de la défense du territoire contre les autres Vikings. En 150 ans, ses descendants normands ont conquis l'Angleterre (1066), la Sicile, et fondé des États croisés — un retour sur investissement spectaculaire pour Charles le Simple.	t	2026-04-06 13:48:01.290258+00	\N
39	daily	medium	faction-romaine	\N	Sur les murs de Pompéi, des inscriptions peintes appellent à voter pour tel candidat, insultent des rivaux, ou annoncent des combats de gladiateurs. La plus ancienne publicité murale d'Europe.	Comment appelle-t-on les inscriptions peintes sur les murs de Pompéi qui servaient d'affiches électorales et publicitaires ?	qcm	["Les dipinti", "Les graffiti", "Les libelli", "Les acta diurna"]	Les dipinti	On a retrouvé plus de 2 800 dipinti électoraux à Pompéi. « Votez pour Lucius, c'est un homme bien ! » côtoie « Les petits voleurs demandent l'élection de Vatia ». Contrairement aux graffiti (gravés), les dipinti étaient peints — souvent par des professionnels engagés pour la campagne.	t	2026-04-06 13:48:01.290258+00	\N
40	daily	medium	\N	\N	Sur les routes de l'ambre, de la soie et de l'étain, Celtes, Romains, Vikings et Byzantins se croisaient plus souvent qu'on ne le croit. Le commerce ignorait les frontières que les historiens traceraient plus tard.	Quelle matière, résine fossile venue de la Baltique, était commercée à travers toute l'Europe et la Méditerranée depuis le Néolithique ?	qcm	["Le jade", "L'ambre", "Le corail", "Le jais"]	L'ambre	L'ambre de la Baltique a été retrouvé dans des tombes mycéniennes (Grèce, 1500 av. J.-C.) et des sépultures égyptiennes. La « route de l'ambre » reliait la mer du Nord à l'Adriatique. Les Romains l'appelaient "succinum" (suc de pierre) et Néron en faisait décorer ses arènes.	t	2026-04-06 13:48:01.290258+00	\N
41	daily	hard	faction-celtique	\N	César mentionne un calendrier gaulois complexe. En 1897, des fragments de bronze gravés ont été découverts à Coligny (Ain) — un calendrier luni-solaire de 5 ans, le plus élaboré du monde celtique.	Comment s'appelle le calendrier gaulois en bronze découvert en 1897, le plus complet vestige de l'astronomie celtique ?	qcm	["Le calendrier de Bibracte", "Le calendrier de Coligny", "Le calendrier de Hallstatt", "Le calendrier de Gournay"]	Le calendrier de Coligny	Gravé en gaulois sur des plaques de bronze, ce calendrier couvre 5 ans (62 mois lunaires + 2 mois intercalaires). Il note les jours « MAT » (favorables) et « ANM » (défavorables). Sa sophistication prouve que les druides étaient des astronomes rigoureux, pas des sorciers de village.	t	2026-04-06 13:48:01.290258+00	\N
42	daily	hard	faction-nordique	\N	Des pierres levées couvertes de runes racontent les exploits des morts. L'une d'elles, en Suède, mentionne un guerrier parti « très loin à l'est, en Serkland » — la terre des Sarrasins.	Comment appelle-t-on les pierres commémoratives couvertes de runes et d'entrelacs, typiques de la Suède viking (Xe-XIe siècle) ?	qcm	["Les menhirs", "Les pierres runiques", "Les bautasteinar", "Les dolmens"]	Les pierres runiques	La Suède compte plus de 2 500 pierres runiques, la plupart du XIe siècle. Les « pierres du Serkland » mentionnent des Vikings morts dans le monde musulman. Les pierres d'Ingvar commémorent une expédition désastreuse vers la Caspienne en 1036 — aucun des participants n'est rentré.	t	2026-04-06 13:48:01.290258+00	\N
43	daily	hard	faction-byzantine	\N	Avant que les Croisés ne la mettent à sac, Constantinople abritait la plus grande bibliothèque du monde chrétien. Des textes grecs antiques y ont survécu un millénaire — puis ont disparu.	Quel patriarche du IXe siècle a compilé le « Myriobiblon », résumé de 279 ouvrages antiques dont beaucoup sont aujourd'hui perdus ?	qcm	["Jean Chrysostome", "Photios Ier", "Basile de Césarée", "Michel Psellos"]	Photios Ier	Le Myriobiblon (ou Bibliotheca) de Photios résume des œuvres d'historiens, médecins, romanciers et théologiens grecs — nombre de ces textes n'existent plus que grâce à ses résumés. Photios, l'un des esprits les plus brillants de Byzance, a aussi provoqué le schisme avec Rome en 863.	t	2026-04-06 13:48:01.290258+00	\N
44	daily	hard	faction-romaine	\N	L'armée romaine ne se contentait pas de combattre. Chaque légionnaire portait 30 kg de matériel et creusait des tranchées chaque soir. Leur surnom en dit long sur leur quotidien.	Quel surnom les légionnaires romains se donnaient-ils eux-mêmes, en référence au poids de leur équipement de marche ?	qcm	["Les Aigles", "Les mules de Marius", "Les fils de Mars", "Les loups de Rome"]	Les mules de Marius	C'est le consul Marius (107 av. J.-C.) qui a réformé l'armée en imposant que chaque soldat porte son propre équipement au lieu de dépendre d'un train de bagages. Les légionnaires portaient armes, outils, rations et piquets — environ 30 kg — sur des marches de 30 km par jour.	t	2026-04-06 13:48:01.290258+00	\N
45	daily	hard	faction-celtique	\N	Pline l'Ancien rapporte que les Gaulois maîtrisaient une technique que les Romains leur enviaient : le placage de métaux. Ils savaient aussi « argenter » le cuivre si habilement qu'on ne voyait pas la différence.	Quel procédé métallurgique, attribué aux Gaulois par Pline l'Ancien, consistait à recouvrir un métal d'une fine couche d'étain ?	qcm	["La dorure", "L'étamage", "Le damasquinage", "L'émaillage"]	L'étamage	Pline (Histoire naturelle, XXXIV) attribue l'invention de l'étamage aux Gaulois Bituriges (Bourges). Cette technique protégeait le cuivre de la corrosion et imitait l'argent. Les artisans gaulois étaient aussi pionniers de l'émaillage — leur maîtrise métallurgique impressionnait Rome.	t	2026-04-06 13:48:01.290258+00	\N
46	daily	hard	faction-nordique	\N	Des archéologues ont retrouvé des cristaux translucides dans des épaves vikings. Certains pensent que ces « pierres de soleil » permettaient de naviguer même par temps couvert, en localisant le soleil à travers les nuages.	Quel type de cristal est aujourd'hui considéré comme la probable « pierre de soleil » des navigateurs vikings ?	qcm	["Le quartz rose", "Le spath d'Islande (calcite)", "La tourmaline", "Le feldspath"]	Le spath d'Islande (calcite)	Le spath d'Islande (cristal de calcite transparent) possède une propriété de biréfringence : il dédouble les images et, tourné face au ciel, permet de localiser la position du soleil même par temps couvert. Une étude de 2018 (Royal Society) a montré que cette méthode fonctionne avec une précision de 4°.	t	2026-04-06 13:48:01.290258+00	\N
47	daily	hard	faction-byzantine	\N	Un empereur juriste a ordonné la compilation de tout le droit romain en un seul corpus. Ce travail titanesque, achevé en 534, est devenu le fondement du droit civil dans la moitié de l'Europe.	Comment s'appelle la grande compilation du droit romain ordonnée par Justinien, base du droit civil européen ?	qcm	["Les Douze Tables", "Le Corpus Juris Civilis", "Le Code Théodosien", "Les Pandectes de Tribonien"]	Le Corpus Juris Civilis	Compilé en 4 ans par le juriste Tribonien, le Corpus comprend le Code (lois impériales), le Digeste (jurisprudence), les Institutes (manuel) et les Novelles (nouvelles lois). Redécouvert au XIe siècle à Bologne, il a fondé la tradition juridique de l'Europe continentale — du Code Napoléon au BGB allemand.	t	2026-04-06 13:48:01.290258+00	\N
48	daily	hard	faction-romaine	\N	Sous l'Empire, un réseau d'espions et d'informateurs quadrillait les provinces. Les « agentes in rebus » étaient les yeux et les oreilles de l'empereur — et personne ne savait exactement qui ils étaient.	Quel corps de fonctionnaires romains, créé au IVe siècle, servait à la fois de messagers, d'inspecteurs et d'agents de renseignement ?	qcm	["Les frumentarii", "Les agentes in rebus", "Les speculatores", "Les bénéficiaires"]	Les agentes in rebus	Les agentes in rebus (« ceux qui agissent dans les affaires ») ont remplacé les frumentarii, jugés trop corrompus. Officiellement inspecteurs du cursus publicum, ils surveillaient surtout les gouverneurs de province et rapportaient directement à l'empereur. Ammien Marcellin les décrit comme omniprésents et redoutés.	t	2026-04-06 13:48:01.290258+00	\N
49	daily	hard	\N	\N	Quatre civilisations, quatre systèmes juridiques — mais un concept traverse le temps : l'idée qu'il existe des lois supérieures au pouvoir du roi. Des lois sacrées celtes aux tables romaines, chaque peuple a cherché à limiter l'arbitraire.	Quel texte romain gravé sur des tables de bronze, vers 450 av. J.-C., est considéré comme le premier code de lois écrit de Rome ?	qcm	["Le Corpus Juris Civilis", "La Loi des Douze Tables", "L'Édit du Préteur", "Le Code Théodosien"]	La Loi des Douze Tables	Gravées en 451-449 av. J.-C. sous la pression des plébéiens, les Douze Tables fixent pour la première fois le droit par écrit, limitant l'arbitraire des patriciens. Cicéron rapporte que les écoliers les apprenaient encore par cœur 400 ans plus tard. Les tables originales ont été détruites lors du sac gaulois de 390 av. J.-C.	t	2026-04-06 13:48:01.290258+00	\N
50	daily	hard	faction-celtique	\N	Dans une grotte des Pyrénées, des archéologues ont découvert un trésor votif gaulois : des centaines d'objets en or et en argent jetés dans l'eau depuis des siècles. Les Celtes offraient leurs richesses aux eaux — rivières, lacs, sources — qu'ils considéraient comme des passages vers l'Autre Monde.	Comment appelle-t-on les dépôts d'objets précieux dans les eaux (rivières, lacs, sources) pratiqués par les Celtes ?	qcm	["Les cairns", "Les dépôts votifs aquatiques", "Les tumulus", "Les sanctuaires rupestres"]	Les dépôts votifs aquatiques	Des milliers d'épées, casques, bijoux et monnaies ont été retrouvés dans les rivières et lacs d'Europe celtique. Le lac de Toulouse (Strabon), les sources de la Seine (statuettes votives), la Tamise (bouclier de Battersea) : les Celtes considéraient l'eau comme un seuil entre les mondes, et les offrandes comme un dialogue avec les forces souterraines.	t	2026-04-06 13:48:01.290258+00	\N
51	daily	very_easy	faction-celtique	\N	Dans les forêts de Gaule, un arbre était vénéré par-dessus tous les autres...	Quel arbre est sacré chez les Celtes et a donné son nom aux druides ?	qcm	["Le chêne", "Le sapin", "Le bouleau", "L'olivier"]	Le chêne	Le mot "druide" vient du gaulois "dru-wid", signifiant "celui qui connaît le chêne". Le chêne était l'arbre sacré par excellence chez les Celtes.	t	2026-04-08 00:13:56.638549+00	\N
52	daily	very_easy	faction-celtique	\N	Ils étaient à la fois juges, médecins, poètes et gardiens du savoir...	Comment appelle-t-on les prêtres et sages de la civilisation celtique ?	qcm	["Les druides", "Les centurions", "Les scaldes", "Les moines"]	Les druides	Les druides formaient la classe savante de la société celtique. Ils transmettaient leur savoir oralement, refusant l'écriture pour les textes sacrés.	t	2026-04-08 00:13:56.638549+00	\N
55	daily	very_easy	faction-nordique	\N	Armé de son marteau, il protège les hommes et les dieux contre les géants...	Comment s'appelle le dieu du tonnerre dans la mythologie nordique ?	qcm	["Thor", "Odin", "Loki", "Freyr"]	Thor	Thor, fils d'Odin, est le dieu du tonnerre. Son marteau Mjöllnir est l'arme la plus puissante des neuf mondes.	t	2026-04-08 00:13:56.638549+00	\N
56	daily	very_easy	faction-nordique	\N	Vêtus de peaux d'ours ou de loup, ils entraient dans une transe de combat terrifiante...	Comment appelle-t-on les guerriers vikings qui combattaient dans une fureur sacrée ?	qcm	["Les berserkers", "Les druides", "Les légionnaires", "Les samouraïs"]	Les berserkers	Les berserkers (de "ber-serkr", peau d'ours) étaient des guerriers d'élite qui combattaient dans un état de fureur quasi-surnaturel.	t	2026-04-08 00:13:56.638549+00	\N
57	daily	very_easy	faction-nordique	\N	Ses racines plongent dans trois puits de sagesse, ses branches touchent le ciel...	Quel est le nom du grand arbre qui relie les neuf mondes dans la mythologie nordique ?	qcm	["Yggdrasil", "Bifröst", "Valhalla", "Midgard"]	Yggdrasil	Yggdrasil est le frêne cosmique qui soutient les neuf mondes. Un aigle vit à sa cime, un serpent ronge ses racines.	t	2026-04-08 00:13:56.638549+00	\N
59	daily	very_easy	faction-romaine	\N	Inauguré en 80 après J.-C., il pouvait accueillir plus de 50 000 spectateurs...	Quel célèbre amphithéâtre de Rome accueillait les combats de gladiateurs ?	qcm	["Le Colisée", "Le Panthéon", "Le Circus Maximus", "Les Thermes de Caracalla"]	Le Colisée	Le Colisée (amphithéâtre Flavien) est le plus grand amphithéâtre jamais construit. Les jeux pouvaient durer des semaines entières.	t	2026-04-08 00:13:56.638549+00	\N
60	daily	very_easy	faction-romaine	\N	Ses légions ont soumis la Gaule en huit ans de campagne. Puis il marcha sur Rome elle-même...	Quel général romain a conquis la Gaule et franchi le Rubicon ?	qcm	["Jules César", "Auguste", "Néron", "Marc Aurèle"]	Jules César	Jules César conquit la Gaule entre 58 et 50 av. J.-C. En franchissant le Rubicon en 49 av. J.-C., il déclencha la guerre civile qui fit de lui le maître de Rome.	t	2026-04-08 00:13:56.638549+00	\N
61	daily	very_easy	faction-romaine	\N	Cette langue a donné naissance au français, à l'espagnol, à l'italien et au portugais...	Quelle langue parlaient les Romains ?	qcm	["Le latin", "Le grec", "L'étrusque", "Le gaulois"]	Le latin	Le latin était la langue de Rome. En se transformant au fil des siècles, il a donné naissance aux langues romanes que nous parlons aujourd'hui.	t	2026-04-08 00:13:56.638549+00	\N
63	daily	very_easy	faction-byzantine	\N	Fondée par un empereur romain, elle fut le carrefour entre l'Europe et l'Asie pendant mille ans...	Quelle ville était la capitale de l'Empire byzantin ?	qcm	["Constantinople", "Athènes", "Alexandrie", "Jérusalem"]	Constantinople	Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en 330. Capitale de l'Empire byzantin pendant plus de 1000 ans, elle tomba aux mains des Ottomans en 1453.	t	2026-04-08 00:13:56.638549+00	\N
64	daily	very_easy	faction-byzantine	\N	Chef-d'œuvre d'architecture, sa coupole semblait flotter dans les airs...	Quelle célèbre basilique de Constantinople est devenue mosquée puis musée ?	qcm	["Sainte-Sophie", "Saint-Pierre", "Notre-Dame", "Saint-Marc"]	Sainte-Sophie	Sainte-Sophie (Hagia Sophia), construite en 537 sous Justinien, resta la plus grande cathédrale du monde pendant près de mille ans.	t	2026-04-08 00:13:56.638549+00	\N
65	daily	very_easy	faction-byzantine	\N	Premier empereur chrétien, il déplaça la capitale de l'Empire vers l'Orient...	Quel empereur romain a fondé Constantinople ?	qcm	["Constantin Ier", "Justinien", "Théodose", "Dioclétien"]	Constantin Ier	Constantin Ier (272-337) fonda Constantinople en 330 sur le site de l'ancienne Byzance. Il fut le premier empereur à se convertir au christianisme.	t	2026-04-08 00:13:56.638549+00	\N
24	daily	medium	faction-romaine	\N	Le béton romain résiste depuis deux millénaires. Les ports romains immergés sont toujours solides. Notre béton moderne commence à se fissurer au bout de 50 ans. Leur secret ? Une réaction chimique que nous venons à peine de comprendre.	Quel ingrédient volcanique donne au béton romain sa résistance exceptionnelle à l'eau de mer ?	free	\N	La pouzzolane	La pouzzolane (cendres volcaniques de Pouzzoles) réagit avec la chaux et l'eau de mer pour former des cristaux d'aluminium tobermorite, qui se renforcent avec le temps. Une étude de 2017 (University of Utah) a montré que l'eau de mer renforce le béton romain au lieu de le détruire — l'exact inverse du béton Portland moderne.	t	2026-04-06 13:48:01.290258+00	\N
28	daily	medium	faction-romaine	\N	Les Romains ont construit un mur de 117 km à travers l'Angleterre — puis un second, plus au nord, en Écosse. Le mur d'Écosse a été abandonné après seulement 20 ans. Trop de résistance picte.	Comment s'appelle le mur romain construit en Écosse, plus au nord que le mur d'Hadrien, et rapidement abandonné ?	free	\N	Le mur d'Antonin	Construit en 142 sous Antonin le Pieux, ce mur de tourbe et de bois s'étendait sur 63 km entre le Firth of Forth et le Firth of Clyde. Abandonné vers 162, il marque la limite nord de l'expansion romaine. Les Pictes au-delà n'ont jamais été soumis — Rome a renoncé.	t	2026-04-06 13:48:01.290258+00	\N
30	daily	medium	faction-nordique	\N	En 885, une flotte de centaines de navires remonte la Seine. Paris est assiégée pendant un an. Mais cette fois, la ville résiste — et un comte franc entre dans la légende.	Quel comte a défendu Paris lors du grand siège viking de 885-886 ?	free	\N	Eudes de Paris	Eudes (Odo), comte de Paris, a tenu la ville avec quelques centaines d'hommes contre peut-être 30 000 Vikings. Le roi Charles le Gros, arrivé avec une armée, a préféré payer les Vikings pour qu'ils partent — ce qui lui a coûté sa couronne. Eudes est devenu roi des Francs en 888.	t	2026-04-06 13:48:01.290258+00	\N
58	daily	very_easy	faction-nordique	\N	Les valkyries y emmenaient les plus braves, tombés l'épée à la main...	Comment s'appelle le paradis des guerriers morts au combat dans la mythologie nordique ?	qcm	["Le Valhalla", "L'Olympe", "Les Champs Élysées", "Avalon"]	Valhalla	Le Valhalla (Valhöll, "hall des occis") est la demeure d'Odin où festoient les einherjar, les guerriers tombés au combat, en attendant le Ragnarök.	t	2026-04-08 00:13:56.638549+00	\N
66	daily	very_easy	faction-byzantine	\N	Dans les églises d'Orient, ces images dorées étaient vénérées comme des fenêtres vers le divin...	Comment appelle-t-on les images sacrées peintes sur bois, typiques de l'art byzantin ?	qcm	["Les icônes", "Les fresques", "Les vitraux", "Les mosaïques"]	Les icônes	Les icônes sont des peintures religieuses sur panneaux de bois, caractéristiques de l'art byzantin et orthodoxe. La crise iconoclaste (726-843) divisa l'Empire sur leur vénération.	t	2026-04-08 00:13:56.638549+00	\N
33	daily	medium	faction-celtique	\N	Un chaudron d'argent retrouvé dans une tourbière danoise en 1891, couvert de scènes de sacrifices, de dieux cornus et de guerriers. Œuvre celtique retrouvée en terre germanique — un mystère en soi.	Comment s'appelle le célèbre chaudron d'argent celtique découvert au Danemark, orné de divinités gauloises ?	free	\N	Le chaudron de Gundestrup	Datant du IIe-Ier siècle av. J.-C., ce chaudron de 9 kg d'argent montre des divinités celtiques (dont Cernunnos aux bois de cerf) et une scène d'immersion rituelle. Fabriqué probablement en Thrace avec une iconographie gauloise, il illustre les réseaux d'échange à travers l'Europe celtique.	t	2026-04-06 13:48:01.290258+00	\N
35	daily	medium	faction-romaine	\N	Sous l'Empire, un réseau de messagers reliait Rome aux provinces les plus lointaines. Les relais étaient espacés de 12 à 18 km — la distance qu'un cheval pouvait galoper à pleine vitesse.	Comment s'appelait le service postal impérial romain, avec ses relais de chevaux sur toutes les routes de l'Empire ?	free	\N	Le Cursus Publicum	Créé par Auguste, le Cursus Publicum permettait de transmettre un message de Rome à la frontière du Rhin en 5-7 jours (1 500 km). Les mansiones (auberges) et mutationes (relais) jalonnaient le réseau. Seuls les porteurs d'un diploma (laissez-passer impérial) pouvaient l'utiliser.	t	2026-04-06 13:48:01.290258+00	\N
54	daily	very_easy	faction-celtique	\N	En 52 avant J.-C., un jeune chef arverne rassembla les tribus gauloises pour un dernier combat...	Quel chef gaulois a mené la résistance contre Jules César à Alésia ?	qcm	["Vercingétorix", "Brennus", "Ambiorix", "Clovis"]	Vercingétorix	Vercingétorix, chef des Arvernes, unifia les tribus gauloises contre Rome. Sa reddition à Alésia marqua la fin de l'indépendance gauloise.	t	2026-04-08 00:13:56.638549+00	\N
62	daily	very_easy	faction-romaine	\N	En un seul jour, une cité romaine prospère fut engloutie sous les cendres...	Quel volcan a enseveli la ville de Pompéi en 79 après J.-C. ?	qcm	["Le Vésuve", "L'Etna", "Le Stromboli", "L'Olympe"]	Le Vésuve	L'éruption du Vésuve le 24 octobre 79 ensevelit Pompéi et Herculanum. Les fouilles, commencées au XVIIIe siècle, ont révélé une ville figée dans le temps.	t	2026-04-08 00:13:56.638549+00	\N
67	daily	very_easy	faction-celtique	\N	Dans les forêts gauloises, croiser cet animal de bon augure était un présage de gloire...	Quel animal était considéré comme sacré et royal chez les Celtes ?	qcm	["Le sanglier", "Le loup", "Le cerf", "L'aigle"]	Le sanglier	Le sanglier était l'animal le plus emblématique des Celtes, symbole de bravoure et de puissance guerrière. Il ornait casques, boucliers et monnaies. Le festin du sanglier rôti était réservé aux guerriers les plus vaillants.	t	2026-04-08 00:40:14.570429+00	\N
68	daily	very_easy	faction-celtique	\N	Sur ce plateau de Bourgogne, la résistance gauloise s'éteignit après un siège de plusieurs semaines...	Comment s'appelait la grande défaite gauloise face à Jules César en 52 av. J.-C. ?	qcm	["La bataille d'Alésia", "La bataille de Gergovie", "La bataille de Magetobriga", "La bataille du Teutoburg"]	La bataille d'Alésia	La bataille d'Alésia marqua la fin de la résistance gauloise. César construisit deux lignes de fortifications en cercle pour piéger les assiégés et repousser les renforts. Vercingétorix capitula après plusieurs semaines.	t	2026-04-08 00:40:14.570429+00	\N
69	daily	very_easy	faction-celtique	\N	Bien avant les deniers romains, les marchands gaulois échangeaient des pièces frappées à leur propre effigie...	Quelle était la monnaie principale des Gaulois ?	qcm	["Des pièces d'or et d'argent", "Du sel", "Des lingots de bronze", "Des peaux d'animaux"]	Des pièces d'or et d'argent	Les Gaulois frappaient leurs propres monnaies depuis le IIIe siècle av. J.-C., d'abord inspirées des statères grecs. Chaque peuple gaulois (Parisii, Éduens, Arvernes...) avait ses propres monnaies reconnaissables à leurs motifs stylisés.	t	2026-04-08 00:40:14.570429+00	\N
70	daily	very_easy	faction-celtique	\N	Ils franchirent les Alpes, battirent les Romains à l'Allia et poussèrent jusqu'au Capitole...	Quel peuple celtique a brûlé Rome vers 390 av. J.-C. ?	qcm	["Les Sénons", "Les Boïens", "Les Helvètes", "Les Galates"]	Les Sénons	Les Sénons, sous la conduite de Brennus, déferlèrent sur Rome en 390 av. J.-C. Leur chef aurait déclaré "Vae victis !" (malheur aux vaincus) en jetant son épée dans la balance lors du pesage de la rançon.	t	2026-04-08 00:40:14.570429+00	\N
71	daily	very_easy	faction-celtique	\N	Ces grandes agglomérations fortifiées dominaient les collines et contrôlaient les routes commerciales...	Qu'est-ce qu'un oppidum gaulois ?	qcm	["Une ville fortifiée sur une hauteur", "Un temple druidique", "Un camp militaire romain", "Un marché saisonnier"]	Une ville fortifiée sur une hauteur	Les oppida étaient les grandes agglomérations gauloises, souvent perchées sur des hauteurs stratégiques. Bibracte (Éduens), Gergovie (Arvernes) ou Avaricum (Bituriges) comptaient plusieurs milliers d'habitants avec artisans, marchands et élites.	t	2026-04-08 00:40:14.570429+00	\N
72	daily	very_easy	faction-celtique	\N	Sur les champs de bataille irlandais, cette déesse volait au-dessus des combattants pour sceller leur destin...	Quelle déesse celtique de la guerre se manifestait souvent sous la forme d'un corbeau ?	qcm	["La Morrigane", "Brigid", "Dana", "Epona"]	La Morrigane	La Morrigane (ou Morrigan) est la déesse irlandaise de la guerre, du destin et de la mort. Elle apparaissait souvent comme une corneille ou un corbeau, tournoyant au-dessus des guerriers. Elle joua un rôle crucial dans la légende de Cú Chulainn.	t	2026-04-08 00:40:14.570429+00	\N
73	daily	very_easy	faction-celtique	\N	Son beuglement grave résonnait dans les vallées pour rassembler les guerriers ou effrayer l'ennemi...	Quel instrument de musique celtique a une forme recourbée comme une trompe d'animal ?	qcm	["Le carnyx", "La lyre", "La cornemuse", "La cithare"]	Le carnyx	Le carnyx est une trompe de guerre celtique en bronze dont l'extrémité représente une gueule d'animal ouverte (sanglier, serpent). Long de près de deux mètres, son son grave et retentissant était utilisé pour coordonner les mouvements de troupes et impressionner l'ennemi.	t	2026-04-08 00:40:14.570429+00	\N
74	daily	very_easy	faction-celtique	\N	César les força à rebrousser chemin lors de leur grande migration vers l'ouest en 58 av. J.-C...	Quel peuple celtique habitait la région qui deviendra la Suisse ?	qcm	["Les Helvètes", "Les Boïens", "Les Allobroges", "Les Séquanes"]	Les Helvètes	La migration des Helvètes en 58 av. J.-C. fut le prétexte de l'intervention de César en Gaule. Ce peuple celte tentait de rejoindre les territoires atlantiques, mais César les battit à la bataille de Bibracte et les renvoya dans leur pays d'origine.	t	2026-04-08 00:40:14.570429+00	\N
75	daily	very_easy	faction-celtique	\N	Ils mémorisaient des milliers de vers et pouvaient louer ou maudire un roi avec leurs chants...	Comment appelle-t-on les poètes et musiciens de la société celtique, gardiens de la mémoire orale ?	qcm	["Les bardes", "Les scaldes", "Les aèdes", "Les troubadours"]	Les bardes	Les bardes formaient une des trois classes savantes celtiques avec les druides et les devins (vates). Ils composaient et récitaient des poèmes épiques, des généalogies et des louanges. Un barde insulté pouvait "satirer" un roi — une malédiction en vers redoutée de tous.	t	2026-04-08 00:40:14.570429+00	\N
76	daily	very_easy	faction-celtique	\N	Sur cette île à l'ouest de la France, le breton, le gallois et le cornique témoignent d'un passé celtique résistant...	Quel pays est souvent appelé "le pays des Celtes" car il conserve encore une langue celtique vivante ?	qcm	["L'Irlande", "L'Espagne", "La Pologne", "La Norvège"]	L'Irlande	L'irlandais (gaélique irlandais) est la langue celtique la plus vivante aujourd'hui, avec le gallois. L'Irlande n'ayant jamais été conquise par Rome, sa culture celtique s'est préservée de façon exceptionnelle, notamment dans ses manuscrits enluminés et ses légendes mythologiques.	t	2026-04-08 00:40:14.570429+00	\N
77	daily	very_easy	faction-celtique	\N	Cheveux roux au vent, elle conduisit ses chars de guerre contre les légions de Néron...	Quelle reine brittonique a mené une révolte contre l'occupation romaine en 60-61 ap. J.-C. ?	qcm	["Boudicca", "La Morrigane", "Cartimandua", "Medb"]	Boudicca	Boudicca, reine des Icènes, mena une rébellion dévastatrice contre Rome : Camulodunum (Colchester), Londinium et Verulamium furent incendiées. Son armée est estimée à 100 000 hommes avant d'être finalement écrasée par le gouverneur Suetonius Paulinus.	t	2026-04-08 00:40:14.570429+00	\N
78	daily	very_easy	faction-celtique	\N	En cette nuit, le voile entre les vivants et les morts s'amincissait jusqu'à devenir transparent...	Quel est l'autre nom de la fête celtique du 31 octobre, encore célébrée aujourd'hui ?	qcm	["Samain", "Imbolc", "Lughnasadh", "Beltane"]	Samain	Samain (ou Samhain) marquait la fin de l'année celtique et le début de la saison sombre. C'est lors de cette fête que les frontières entre le monde des vivants et celui des morts s'effaçaient. Halloween est la version christianisée et populaire de cette fête ancienne.	t	2026-04-08 00:40:14.570429+00	\N
79	daily	very_easy	faction-celtique	\N	Un pays de délices où nul ne vieillit, accessible au-delà des mers ou sous les collines enchantées...	Dans la mythologie celtique irlandaise, comment s'appelle le monde des dieux et des ancêtres ?	qcm	["L'Autre Monde (Tír na nÓg)", "Le Valhalla", "L'Olympe", "L'Annwn"]	L'Autre Monde (Tír na nÓg)	Tír na nÓg ("Pays de la jeunesse éternelle") est le paradis de la mythologie irlandaise, où vivent les Tuatha Dé Danann. On y accède par des collines féeriques, des grottes ou en traversant l'océan vers l'ouest. Ni maladie, ni vieillesse, ni mort n'y existent.	t	2026-04-08 00:40:14.570429+00	\N
80	daily	very_easy	faction-celtique	\N	Retrouvé dans un marais danois, ce récipient couvert de scènes mythologiques est l'un des plus beaux objets celtes jamais découverts...	De quel matériau était fabriqué le chaudron de Gundestrup, chef-d'œuvre de l'art celtique ?	qcm	["L'argent", "L'or", "Le bronze", "Le fer"]	L'argent	Le chaudron de Gundestrup, découvert en 1891 dans un tourbière danoise, est fait de plaques d'argent presque pur. Il date du Ier siècle av. J.-C. et représente des divinités, des guerriers, des animaux sacrés et une scène de régénération dans un chaudron — peut-être le Chaudron de Dagda.	t	2026-04-08 00:40:14.570429+00	\N
81	daily	very_easy	faction-celtique	\N	Maître des arts, des métiers et de la magie, il était l'égal d'Apollon chez les Grecs...	Quel est le nom du dieu solaire et artisan des Celtes irlandais, père de nombreux héros ?	qcm	["Le Dagda", "Lug", "Nuada", "Cernunnos"]	Lug	Lug (ou Lugh) est le dieu solaire et polyvalent des Celtes irlandais — son épithète "Lamhfhada" signifie "au long bras". Il maîtrisait tous les arts et métiers à la fois : c'est lui qui tua le géant Balor de son œil maléfique lors de la bataille de Mag Tuired.	t	2026-04-08 00:40:14.570429+00	\N
82	daily	very_easy	faction-nordique	\N	Il sacrifia un œil au puit de Mimir pour obtenir la sagesse, et se pendit à Yggdrasil pour révéler les runes...	Comment s'appelle le dieu suprême de la mythologie nordique, maître de la sagesse et de la guerre ?	qcm	["Odin", "Thor", "Tyr", "Baldr"]	Odin	Odin (ou Woden en vieux germanique) est le père des dieux nordiques. Il règne sur le Valhalla, accompagné de ses deux corbeaux Huginn (pensée) et Muninn (mémoire). Le mercredi (Wednesday) tire son nom de Woden's Day en anglais.	t	2026-04-08 00:40:14.570429+00	\N
83	daily	very_easy	faction-nordique	\N	Gardé par Heimdall qui ne dort jamais, il brillait de toutes les couleurs entre Midgard et Asgard...	Quel est le nom du pont arc-en-ciel qui relie le monde des hommes au royaume des dieux nordiques ?	qcm	["Bifröst", "Niflheim", "Jörmungandr", "Gjöll"]	Bifröst	Bifröst est le pont arc-en-ciel de la mythologie nordique, reliant Midgard (le monde des hommes) à Asgard (le monde des dieux). Gardé par le dieu Heimdall, il sera détruit lors du Ragnarök quand les géants de feu le traverseront.	t	2026-04-08 00:40:14.570429+00	\N
84	daily	very_easy	faction-nordique	\N	Chaque soir les guerriers s'y régalaient, chaque matin ils ressuscitaient pour s'affronter à nouveau...	Comment s'appelle le grand festin des morts au combat dans le Valhalla ?	qcm	["Les einherjar festoient", "Le Ragnarök", "Le blót", "Le Thing"]	Les einherjar festoient	Les einherjar sont les guerriers choisis par les valkyries pour rejoindre le Valhalla. Chaque jour ils s'entraînent au combat, se blessent et meurent, puis ressuscitent le soir pour festoyer avec Odin. Ils attendent ainsi le Ragnarök, la bataille finale.	t	2026-04-08 00:40:14.570429+00	\N
85	daily	very_easy	faction-nordique	\N	Si grand qu'il peut tenir sa propre queue dans sa gueule, il dort au fond de l'océan qui entoure Midgard...	Quel est le nom du serpent géant qui encercle le monde dans la mythologie nordique ?	qcm	["Jörmungandr", "Níðhöggr", "Fáfnir", "Lindworm"]	Jörmungandr	Jörmungandr (le Serpent de Midgard) est fils de Loki et de la géante Angrboda. Odin le jeta dans l'océan où il grandit jusqu'à encercler toute la Terre. Lors du Ragnarök, il émergera pour affronter Thor — chacun tuera l'autre.	t	2026-04-08 00:40:14.570429+00	\N
86	daily	very_easy	faction-nordique	\N	Ni tout à fait ennemi, ni vraiment allié, il était le génie du chaos qui finit par trahir les dieux...	Quel dieu nordique est associé à la tromperie, au feu et au changement de forme ?	qcm	["Loki", "Baldr", "Freyr", "Tyr"]	Loki	Loki est le dieu de la ruse et du changement de forme (shapeshifter). D'abord compagnon d'Odin, il devient progressivement l'ennemi des dieux. Il est responsable de la mort de Baldr, le dieu de la lumière, et sera enchaîné jusqu'au Ragnarök.	t	2026-04-08 00:40:14.570429+00	\N
87	daily	very_easy	faction-nordique	\N	Leif Erikson y aborda et appela ce pays "Vinland" à cause des vignes sauvages qu'il y trouva...	Quel continent les Vikings ont-ils découvert vers l'an 1000, bien avant Christophe Colomb ?	qcm	["L'Amérique du Nord", "L'Afrique", "L'Australie", "L'Asie"]	L'Amérique du Nord	Leif Erikson atteignit l'Amérique du Nord vers l'an 1000, qu'il appela Vinland. Le site de L'Anse aux Meadows, découvert en 1960 à Terre-Neuve (Canada), est la seule colonie viking confirmée en Amérique. Colomb n'arrivera que 500 ans plus tard.	t	2026-04-08 00:40:14.570429+00	\N
88	daily	very_easy	faction-nordique	\N	Dieux et géants s'y affronteront en une dernière lutte, et la Terre sombrera dans l'océan avant de renaître...	Quel est le nom de la fin du monde dans la mythologie nordique, la grande bataille des dieux ?	qcm	["Le Ragnarök", "Le Niflheim", "Le Götterdämmerung", "Le Jötunheim"]	Le Ragnarök	Le Ragnarök ("Crépuscule des dieux") est la fin du monde de la mythologie nordique. Odin mourra dévoré par le loup Fenrir, Thor tuera Jörmungandr mais mourra de son venin. Après la destruction totale, une nouvelle Terre émergera des eaux, verte et fertile.	t	2026-04-08 00:40:14.570429+00	\N
89	daily	very_easy	faction-nordique	\N	Ce pendentif en métal représentait l'arme du dieu du tonnerre — des millions de Scandinaves le portaient au cou...	Quel outil était le symbole de protection le plus répandu chez les Vikings ?	qcm	["Le marteau Mjöllnir", "La croix", "La rune Algiz", "Le casque ailé"]	Le marteau Mjöllnir	Le Mjöllnir ("écraseur") est le marteau de Thor, forgé par les nains Sindri et Brokkr. Son pendentif était le symbole de protection le plus répandu en Scandinavie avant et pendant la christianisation. Archeologists en ont retrouvé des milliers sur des sites funéraires.	t	2026-04-08 00:40:14.570429+00	\N
90	daily	very_easy	faction-nordique	\N	À cheval, elles parcouraient les champs de carnage pour désigner ceux qui rejoindraient Odin...	Comment appelle-t-on les guerrières divines qui choisissaient les morts sur le champ de bataille ?	qcm	["Les valkyries", "Les nornes", "Les disir", "Les völva"]	Les valkyries	Les valkyries ("celles qui choisissent les morts") étaient des esprits guerriers qui servaient Odin. Elles désignaient les soldats qui mourraient au combat et escortaient les élus vers le Valhalla. Leurs noms évoquent la bataille : Brynhildr (cuirasse de combat), Sigrún (rune de victoire).	t	2026-04-08 00:40:14.570429+00	\N
91	daily	very_easy	faction-nordique	\N	Son nom vient du pays des "Hommes du Nord" — Nortmanni — qui s'y installèrent au Xe siècle...	Quelle ville française a été fondée par les Vikings et porte encore leur nom dans son origine ?	qcm	["Rouen (Normandie)", "Nantes", "Bordeaux", "Lyon"]	Rouen (Normandie)	La Normandie tire son nom des Normands (Nortmanni, "hommes du Nord"). En 911, le chef viking Rollon reçut cette région du roi franc Charles le Simple par le traité de Saint-Clair-sur-Epte. Les descendants de ces Vikings deviendront les ducs de Normandie, dont Guillaume le Conquérant.	t	2026-04-08 00:40:14.570429+00	\N
92	daily	very_easy	faction-nordique	\N	Fuyant le pouvoir centralisateur du roi Harald à la Belle Chevelure, des familles entières prirent la mer vers l'ouest...	Quel peuple nordique a colonisé l'Islande à partir du IXe siècle ?	qcm	["Les Norvégiens", "Les Danois", "Les Suédois", "Les Frisons"]	Les Norvégiens	L'Islande fut colonisée principalement par des Norvégiens à partir de 874 ap. J.-C., date de l'arrivée d'Ingólfr Arnarson à Reykjavik. Cette colonisation est exceptionnellement bien documentée dans le Landnámabók (Livre des Établissements), qui liste plus de 400 colons et 3 000 personnes.	t	2026-04-08 00:40:14.570429+00	\N
93	daily	very_easy	faction-nordique	\N	Mis par écrit en Islande aux XIIe-XIIIe siècles, ils racontent les aventures des rois, des héros et des explorateurs vikings...	Comment s'appellent les récits épiques en prose de la littérature nordique médiévale ?	qcm	["Les sagas", "Les eddas", "Les kenningar", "Les skaldic"]	Les sagas	Les sagas islandaises sont des récits en prose composés aux XIIe-XIVe siècles, relatant l'histoire des familles, des rois et des aventuriers nordiques. Les plus célèbres incluent la Saga de Njáll, la Saga des Groenlandais et la Saga d'Erik le Rouge qui raconte la découverte de l'Amérique.	t	2026-04-08 00:40:14.570429+00	\N
94	daily	very_easy	faction-nordique	\N	Si aimé qu'Odin demanda à toutes les créatures de jurer de ne jamais lui faire de mal — sauf une...	Quel est le nom du dieu nordique de la lumière et de la beauté, dont la mort causa le premier deuil des dieux ?	qcm	["Baldr", "Freyr", "Höðr", "Víðarr"]	Baldr	Baldr est le dieu de la lumière, de la beauté et de la pureté. Sa mort, causée par la ruse de Loki (une flèche de gui tirée par son frère aveugle Höðr), provoqua un deuil universel chez les dieux. Il reviendra après le Ragnarök pour régner sur le nouveau monde.	t	2026-04-08 00:40:14.570429+00	\N
95	daily	very_easy	faction-nordique	\N	Sa victoire à Hastings changea à jamais la langue et la culture anglaise, y introduisant des milliers de mots français...	Quel célèbre chef normand conquit l'Angleterre en 1066 ?	qcm	["Guillaume le Conquérant", "Rollon", "Ragnar Lothbrok", "Harald Hardrada"]	Guillaume le Conquérant	Guillaume le Conquérant, duc de Normandie et descendant des Vikings, vainquit le roi Harold II à la bataille de Hastings le 14 octobre 1066. Sa conquête de l'Angleterre introduisit le français normand comme langue de la cour, modifiant durablement la langue anglaise.	t	2026-04-08 00:40:14.570429+00	\N
96	daily	very_easy	faction-nordique	\N	Ni guerriers glorieux ni dieux — seulement ceux qui meurent de maladie ou de vieillesse y descendent...	Quel est le nom du monde des morts glacial et brumeux dans la mythologie nordique ?	qcm	["Niflheim", "Jötunheim", "Muspellheim", "Svartalfheim"]	Niflheim	Niflheim ("monde du brouillard") est l'un des neuf mondes nordiques, domaine des morts qui n'ont pas péri au combat. Gouverné par la déesse Hel (dont l'anglais "hell" tire son origine), c'est un lieu froid et sombre, à l'opposé de la chaleur du Valhalla.	t	2026-04-08 00:40:14.570429+00	\N
97	daily	very_easy	faction-romaine	\N	Selon la tradition, des jumeaux élevés par une louve seraient à l'origine de la plus grande ville du monde antique...	Selon la légende, qui a fondé la ville de Rome ?	qcm	["Romulus", "Remus", "Énée", "Numa Pompilius"]	Romulus	Selon la légende, Romulus et Remus, fils du dieu Mars, furent abandonnés et allaités par une louve. Romulus fonda Rome en 753 av. J.-C. et en devint le premier roi. Il tua son frère Remus qui avait sauté par-dessus les murs de la nouvelle cité en signe de mépris.	t	2026-04-08 00:40:14.570429+00	\N
98	daily	very_easy	faction-romaine	\N	Ces soldats d'élite stationnés à Rome jouèrent un rôle politique démesuré, allant jusqu'à assassiner ou vendre le trône...	Comment appelle-t-on les soldats d'élite des empereurs romains, leur garde personnelle ?	qcm	["Les prétoriens", "Les légionnaires", "Les auxiliaires", "Les triarii"]	Les prétoriens	La Garde prétorienne, créée par Auguste, était la garde personnelle de l'empereur. Mieux payés et moins soumis que les légions, les prétoriens devinrent une force politique redoutable — ils assassinèrent plusieurs empereurs (Caligula, Pertinax) et vendirent parfois le trône au plus offrant.	t	2026-04-08 00:40:14.570429+00	\N
99	daily	very_easy	faction-romaine	\N	Ces combats opposaient deux hommes avec épée et bouclier dans l'arène, sous les cris de la foule...	Quel type de combat était interdit dans les jeux romains mais pratiqué illégalement comme sport favori des paris ?	qcm	["Les combats de gladiateurs", "La chasse au sanglier", "Le char de course", "La lutte gréco-romaine"]	Les combats de gladiateurs	Contrairement aux idées reçues, les gladiateurs n'étaient pas condamnés à mort systématiquement. Un bon gladiateur était une investissement coûteux — les combats à mort étaient l'exception. Beaucoup de gladiateurs étaient des professionnels libres qui choisissaient cette carrière pour la gloire et l'argent.	t	2026-04-08 00:40:14.570429+00	\N
100	daily	very_easy	faction-romaine	\N	Sa coupole en béton, percée d'un oculus ouvert sur le ciel, reste un prodige d'ingénierie après deux mille ans...	Quel bâtiment romain en forme de dôme, encore intact aujourd'hui, était dédié à tous les dieux ?	qcm	["Le Panthéon", "Le Colisée", "L'Arc de Titus", "Les thermes de Caracalla"]	Le Panthéon	Le Panthéon de Rome, construit sous Hadrien vers 125 ap. J.-C., est l'édifice antique le mieux conservé au monde. Sa coupole de 43,3 mètres de diamètre était, jusqu'à la Renaissance, la plus grande coupole jamais construite. L'oculus central éclaire l'intérieur de lumière naturelle.	t	2026-04-08 00:40:14.570429+00	\N
101	daily	very_easy	faction-romaine	\N	Neveu adoptif de César, il mit fin aux guerres civiles et instaura deux siècles de paix romaine...	Comment s'appelait le premier empereur de Rome ?	qcm	["Auguste", "Jules César", "Néron", "Tibère"]	Auguste	Auguste (né Octave) devint le premier emperor romain en 27 av. J.-C. Son règne de 44 ans inaugura le Principat et le siècle d'or de la littérature latine (Virgile, Horace, Ovide). Son mois de naissance, Sextilis, fut rebaptisé Augustus en son honneur — d'où notre mois d'août.	t	2026-04-08 00:40:14.570429+00	\N
102	daily	very_easy	faction-romaine	\N	Ces constructions monumentales traversaient vallées et plaines sur des arches de pierre, parfois sur des dizaines de kilomètres...	Quel ouvrage hydraulique romain transportait l'eau des montagnes vers les villes ?	qcm	["L'aqueduc", "Le forum", "Le cloaque", "La voie romaine"]	L'aqueduc	Rome était alimentée par 11 aqueducs transportant 1 million de mètres cubes d'eau par jour — soit plus par habitant que la plupart des villes modernes. Le pont du Gard, en France, est un fragment d'aqueduc romain toujours debout, long de 50 km au total.	t	2026-04-08 00:40:14.570429+00	\N
103	daily	very_easy	faction-romaine	\N	Il gouverna l'Empire au IIe siècle tout en pratiquant la philosophie stoïcienne — un sage sur le trône...	Quel célèbre philosophe et emperor romain a écrit les "Pensées" (Méditations) ?	qcm	["Marc Aurèle", "Cicéron", "Sénèque", "Hadrien"]	Marc Aurèle	Marc Aurèle (121-180 ap. J.-C.) est souvent considéré comme le dernier des "Cinq bons empereurs". Ses "Méditations", écrites en grec pour lui-même, sont un chef-d'œuvre de la philosophie stoïcienne. Il gouverna avec sagesse tout en menant de longues guerres contre les Marcomans.	t	2026-04-08 00:40:14.570429+00	\N
104	daily	very_easy	faction-romaine	\N	Long de 600 mètres, il pouvait accueillir jusqu'à 250 000 spectateurs — le plus grand stade de l'Antiquité...	Quel est le nom du grand cirque de Rome où se tenaient les courses de chars ?	qcm	["Le Circus Maximus", "Le Colisée", "Le Circus Nero", "Le Stade de Domitien"]	Le Circus Maximus	Le Circus Maximus était le plus grand stade du monde antique. Les courses de chars (quadriges) y attiraient des foules fanatiques organisées en factions par couleur (Bleus, Verts, Rouges, Blancs). Un cocher victorieux pouvait devenir aussi riche et célèbre qu'une star moderne.	t	2026-04-08 00:40:14.570429+00	\N
105	daily	very_easy	faction-romaine	\N	Distribuer de la nourriture et offrir des spectacles : une recette politique vieille de deux mille ans...	Quelle expression latine signifie "pain et jeux" et décrit la politique romaine pour contenter le peuple ?	qcm	["Panem et circenses", "Veni vidi vici", "Carpe diem", "Alea jacta est"]	Panem et circenses	"Panem et circenses" (pain et jeux du cirque) est une expression du poète satirique Juvénal (Satires, X). Il critiquait ainsi la population romaine qui, ayant abandonné ses responsabilités civiques, se contentait de distributions gratuites de blé et de spectacles pour être satisfaite.	t	2026-04-08 00:40:14.570429+00	\N
106	daily	very_easy	faction-romaine	\N	Première grande route romaine construite en 312 av. J.-C., elle fut pendant des siècles l'épine dorsale de l'Italie...	Comment s'appelait la grande route militaire qui reliait Rome à Brindisi, dans le talon de l'Italie ?	qcm	["La Via Appia", "La Via Aurelia", "La Via Flaminia", "La Via Salaria"]	La Via Appia	La Via Appia ("reine des routes") fut construite en 312 av. J.-C. par le censeur Appius Claudius Caecus. Longue de 560 km, elle reliait Rome à Brindisi, port d'embarquement vers la Grèce et l'Orient. C'est sur ses bas-côtés que 6 000 esclaves de Spartacus furent crucifiés en 71 av. J.-C.	t	2026-04-08 00:40:14.570429+00	\N
107	daily	very_easy	faction-romaine	\N	Déesse de la sagesse, des arts et de la guerre stratégique, elle jaillissait armée de la tête de Jupiter...	Quelle déesse romaine est l'équivalent de la déesse grecque Athéna ?	qcm	["Minerve", "Junon", "Vénus", "Diane"]	Minerve	Minerve est la déesse romaine de la sagesse, des arts, de l'artisanat et de la guerre stratégique, équivalente à l'Athéna grecque. Avec Jupiter et Junon, elle formait la Triade Capitoline, les trois divinités principales de Rome. Sa chouette était son animal symbolique.	t	2026-04-08 00:40:14.570429+00	\N
108	daily	very_easy	faction-romaine	\N	Cette rivière marquait la frontière légale — la franchir en armes était une déclaration de guerre contre Rome...	Quel est le nom de la célèbre sentence prononcée par César lors de sa traversée du Rubicon ?	qcm	["Alea jacta est", "Veni vidi vici", "Tu quoque, Brute", "Carpe diem"]	Alea jacta est	"Alea jacta est" ("Le sort en est jeté") aurait été prononcé par Jules César en franchissant le Rubicon en 49 av. J.-C. avec sa légion. En traversant cette frontière en armes, il commettait un acte de guerre contre la République romaine, déclenchant la guerre civile contre Pompée.	t	2026-04-08 00:40:14.570429+00	\N
109	daily	very_easy	faction-romaine	\N	Ce vêtement lourd et encombrant était la marque distinctive du citoyen romain libre — les étrangers n'avaient pas le droit d'en porter...	Quel type de vêtement blanc drapé était porté par les citoyens romains lors des occasions officielles ?	qcm	["La toge", "La tunique", "Le pallium", "La stola"]	La toge	La toge était le vêtement civique officiel du citoyen romain mâle adulte. Faite d'un grand demi-cercle de laine blanche (jusqu'à 6 mètres de tissu), elle était difficile à draper et inconfortable — c'est pourquoi les Romains portaient une simple tunique au quotidien.	t	2026-04-08 00:40:14.570429+00	\N
110	daily	very_easy	faction-romaine	\N	Ses quelque 300 membres décidaient de la guerre et de la paix, des lois et des finances de la République...	Comment s'appelait le sénat de la Rome antique, assemblée de la classe dirigeante ?	qcm	["Le Sénat", "Le Comice", "La Curie", "L'Assemblée du peuple"]	Le Sénat	Le Sénat romain (de "senex", vieillard) était l'assemblée des ex-magistrats et de l'aristocratie. Sous la République, son autorité (auctoritas) était morale autant que légale. Avec l'Empire, il perdit progressivement ses pouvoirs réels mais conserva son prestige et ses fonctions formelles.	t	2026-04-08 00:40:14.570429+00	\N
111	daily	very_easy	faction-romaine	\N	Père des dieux et des hommes, son symbole — l'aigle — ornait les étendards des légions romaines...	Quel dieu romain est le maître de l'Olympe, des dieux et de la foudre ?	qcm	["Jupiter", "Mars", "Neptune", "Pluton"]	Jupiter	Jupiter (équivalent du Zeus grec) est le roi des dieux romains, maître du ciel et de la foudre. Son temple sur le Capitole était le plus important de Rome. Les légions portaient l'aigle de Jupiter (aquila) comme insigne sacré — le perdre au combat était une honte suprême.	t	2026-04-08 00:40:14.570429+00	\N
112	daily	very_easy	faction-byzantine	\N	L'Empire romain d'Orient abandonna progressivement la langue de Rome pour celle de la philosophie et des Évangiles...	En quelle langue écrivaient et gouvernaient les Byzantins, malgré leur héritage romain ?	qcm	["Le grec", "Le latin", "L'araméen", "L'hébreu"]	Le grec	Bien qu'héritiers de Rome, les Byzantins utilisaient le grec comme langue officielle depuis le VIIe siècle. Le grec était la langue de la culture, de la religion (Septante, Nouveau Testament) et de l'administration. Les empereurs portaient le titre de "Basileus" (roi en grec) plutôt que d'imperator.	t	2026-04-08 00:40:14.570429+00	\N
113	daily	very_easy	faction-byzantine	\N	Ce monument juridique, compilé en quelques années, forma la base du droit dans toute l'Europe occidentale...	Quel célèbre code de lois fut rédigé sous l'empire byzantin de Justinien ?	qcm	["Le Code Justinien", "La Loi Salique", "Les Douze Tables", "Le Code d'Hammurabi"]	Le Code Justinien	Le Corpus Juris Civilis, compilé entre 529 et 534 sous Justinien Ier, est la plus grande réalisation juridique de l'Antiquité tardive. Il rassembla des siècles de droit romain en un ensemble cohérent. Il forma la base du droit civil dans la plupart des pays européens et latino-américains.	t	2026-04-08 00:40:14.570429+00	\N
114	daily	very_easy	faction-byzantine	\N	Ces cavaliers redoutables vivaient à cheval, fondant soudainement sur les territoires frontaliers avant de disparaître...	Quel peuple nomade d'Asie centrale menaçait régulièrement les frontières byzantines depuis les steppes ?	qcm	["Les Huns", "Les Mongols", "Les Avars", "Les Petchénègues"]	Les Huns	Les Huns, sous Attila, ravagèrent les Balkans byzantins dans les années 440. L'Empire paya de lourds tributs pour acheter la paix. Après la mort d'Attila en 453, leur confédération s'effondra rapidement, mais d'autres peuples des steppes (Avars, Petchénègues, Coumans) reprirent leur rôle de menace.	t	2026-04-08 00:40:14.570429+00	\N
115	daily	very_easy	faction-byzantine	\N	Projetée depuis les navires de guerre, cette substance mystérieuse continuait à brûler même quand on l'arrosait d'eau...	Quel est le nom de l'arme secrète byzantine qui pouvait brûler sur l'eau et décima les flottes arabes ?	qcm	["Le feu grégeois", "Le naphte", "La poix ardente", "Le soufre liquide"]	Le feu grégeois	Le feu grégeois était une arme incendiaire byzantine dont la composition exacte reste un mystère. Utilisé dès le VIIe siècle, il brûlait sur l'eau et adhérait aux surfaces. Il sauva Constantinople lors des sièges arabes de 674-678 et 717-718. Sa formule exacte ne fut jamais percée.	t	2026-04-08 00:40:14.570429+00	\N
116	daily	very_easy	faction-byzantine	\N	Pour eux, ils n'étaient pas "byzantins" — ce terme est une invention d'historiens modernes. Ils se voyaient comme les héritiers directs d'une gloire millénaire...	Sous quel nom l'empire byzantin se désignait-il lui-même ?	qcm	["L'Empire romain", "L'Empire grec", "L'Empire chrétien", "L'Empire d'Orient"]	L'Empire romain	Les habitants de l'Empire byzantin se nommaient "Romaioi" (Romains) et leur empire "Basileia Rhomaion" (Empire des Romains). Le terme "byzantin" fut inventé par des historiens occidentaux au XVIe siècle, tiré de l'ancien nom de Constantinople, Byzance. Ils auraient rejeté ce nom.	t	2026-04-08 00:40:14.570429+00	\N
117	daily	very_easy	faction-byzantine	\N	L'Église de Rome et l'Église de Constantinople s'excommunièrent mutuellement, créant une fracture qui dure encore...	Quel grand schisme religieux de 1054 divisa définitivement le christianisme en deux branches ?	qcm	["Le Grand Schisme d'Orient", "La Réforme protestante", "Le schisme d'Avignon", "La querelle des investitures"]	Le Grand Schisme d'Orient	Le Schisme de 1054 divisa le christianisme en Église catholique romaine (pape de Rome) et Église orthodoxe (patriarche de Constantinople). Les divergences portaient sur la primauté du pape, le célibat des prêtres et la procession du Saint-Esprit (la querelle du Filioque). Cette division n'a jamais été réparée.	t	2026-04-08 00:40:14.570429+00	\N
118	daily	very_easy	faction-byzantine	\N	Avec des armées souvent inférieures en nombre, ce stratège de génie renversa le royaume vandale et écrase les Ostrogoths...	Quel grand général byzantin reconquit l'Afrique du Nord et l'Italie sous Justinien Ier ?	qcm	["Bélisaire", "Narsès", "Jean Troglita", "Héraclius"]	Bélisaire	Bélisaire (505-565) est considéré comme le plus grand général de l'Antiquité tardive. Il reconquit l'Afrique du Nord en 533 (en détruisant le royaume vandale en 3 mois) et l'Italie entre 535 et 540. Malgré ses succès, il fut disgrâcié plusieurs fois par un Justinien jaloux de sa gloire.	t	2026-04-08 00:40:14.570429+00	\N
119	daily	very_easy	faction-byzantine	\N	Sans instruments de musique, les voix humaines seules s'élèvent en harmonies complexes dans les cathédrales orthodoxes...	Quelle cérémonie liturgique et musicale est caractéristique de l'Église orthodoxe héritée de Byzance ?	qcm	["Le chant byzantin (a cappella)", "La polyphonie grégorienne", "Le plain-chant romain", "L'orgue liturgique"]	Le chant byzantin (a cappella)	Le chant byzantin, fondé sur des modes musicaux hérités de la Grèce antique, est exécuté sans instruments dans les offices orthodoxes. Il utilise des mélismes (de nombreuses notes sur une seule syllabe) et des modes non tempérés qui lui donnent un caractère contemplatif unique.	t	2026-04-08 00:40:14.570429+00	\N
120	daily	very_easy	faction-byzantine	\N	Cyrille et Méthode inventèrent un alphabet spécialement adapté à leur langue pour leur transmettre l'Évangile...	Quel peuple slave fut évangélisé au IXe siècle grâce à un alphabet créé par des moines byzantins ?	qcm	["Les Bulgares et Moraves (slaves)", "Les Germains", "Les Scandinaves", "Les Hongrois"]	Les Bulgares et Moraves (slaves)	Saints Cyrille et Méthode, moines byzantins, créèrent l'alphabet glagolitique vers 862 pour transcrire les langues slaves. L'alphabet cyrillique (qui porte le nom de Cyrille) en est une adaptation ultérieure. Il est encore utilisé par des centaines de millions de personnes (Russie, Serbie, Bulgarie...).	t	2026-04-08 00:40:14.570429+00	\N
121	daily	very_easy	faction-byzantine	\N	Cette avenue monumentale, bordée de colonnes et de statues, était le cœur de la vie publique byzantine...	Quel nom portait la grande rue principale de Constantinople, qui reliait la porte d'or au Grand Palais ?	qcm	["La Mésé", "Le Tétrastoon", "L'Augustéon", "La Via Sacra"]	La Mésé	La Mésé ("voie du milieu") était l'artère principale de Constantinople, l'équivalent de la Via Sacra romaine. Bordée de portiques couverts, elle abritait marchands et artisans. Elle partait du Forum de Constantin, passait par plusieurs forums monumentaux et menait au Grand Palais impérial.	t	2026-04-08 00:40:14.570429+00	\N
122	daily	very_easy	faction-byzantine	\N	Les Bleus et les Verts s'affrontaient non seulement dans l'hippodrome mais aussi dans les rues, allant jusqu'à renverser des empereurs...	Quel sport hippique divisait la population de Constantinople en factions rivales fanatiques ?	qcm	["Les courses de chars", "La joute à cheval", "Le polo", "La chasse à courre"]	Les courses de chars	L'Hippodrome de Constantinople, adjacent au Grand Palais, était le centre politique et sportif de l'Empire. Les factions des Bleus et des Verts étaient de véritables partis politiques autant que clubs sportifs. La révolte de Nika (532) faillit coûter son trône à Justinien — il fut sauvé par la détermination de sa femme, l'impératrice Théodora.	t	2026-04-08 00:40:14.570429+00	\N
123	daily	very_easy	faction-byzantine	\N	Un sultan de 21 ans, armé des plus grands canons jamais construits, mit fin à un empire millénaire...	Quelle puissance islamique a finalement conquis Constantinople en 1453 ?	qcm	["L'Empire ottoman", "Le califat abbasside", "L'Empire seldjoukide", "L'Égypte mamelouke"]	L'Empire ottoman	Mehmed II, sultan ottoman âgé de 21 ans, conquit Constantinople le 29 mai 1453 après 53 jours de siège. Les canons géants de l'ingénieur Urbain percèrent les murailles théodosiennes. Cette date est souvent citée comme marquant la fin du Moyen Âge en Europe.	t	2026-04-08 00:40:14.570429+00	\N
124	daily	very_easy	faction-byzantine	\N	D'origine modeste, elle devint l'une des femmes les plus puissantes de l'histoire, guidant son empire lors des crises les plus graves...	Quelle impératrice byzantine du VIe siècle, ancienne actrice, co-gouverna avec son mari Justinien ?	qcm	["Théodora", "Irène", "Zoé Porphyrogénète", "Eudocie"]	Théodora	Théodora (497-548) était fille d'un dompteur d'ours et actrice avant d'épouser Justinien. Impératrice, elle joua un rôle politique crucial : lors de la révolte de Nika (532), c'est elle qui convainquit Justinien de ne pas fuir : "La pourpre est le plus beau linceul." Elle réforma aussi les lois sur les femmes et la prostitution.	t	2026-04-08 00:40:14.570429+00	\N
125	daily	very_easy	faction-byzantine	\N	Ces compositions scintillantes de fonds dorés représentaient les saints dans une lumière qui semblait venue d'un autre monde...	Quel art décoratif byzantin, fait de petits cubes de verre ou pierre colorés, ornait les murs des églises ?	qcm	["La mosaïque", "La fresque", "L'enluminure", "L'émail cloisonné"]	La mosaïque	La mosaïque byzantine est considérée comme le sommet de cet art. Les tessères (petits cubes de verre coloré ou de pierre) étaient posées à des angles légèrement différents pour mieux réfléchir la lumière des bougies. Les mosaïques de Ravenne (VIe siècle), notamment celles de San Vitale, sont les plus célèbres exemples subsistant.	t	2026-04-08 00:40:14.570429+00	\N
126	daily	very_easy	faction-byzantine	\N	Ce mot grec signifiant "celle qui règne" confèrait à l'impératrice un statut sacré et une autorité réelle...	Quel titre portait l'épouse de l'emperor byzantin ?	qcm	["Basilissa", "Augusta", "Déspina", "Kyria"]	Basilissa	La Basilissa était le titre officiel de l'impératrice byzantine, équivalent féminin du Basileus. Certaines Basilissai gouvernèrent effectivement l'Empire — Irène d'Athènes (797-802) fut la première femme à régner seule à Constantinople, allant jusqu'à se proclamer "Basileus" au masculin.	t	2026-04-08 00:40:14.570429+00	\N
127	daily	easy	faction-celtique	\N	Sous les frondaisons sacrées du chêne, des hommes vêtus de blanc cueillaient le gui à la faucille d'or…	Quel était le nom des prêtres et savants celtes qui officiaient lors des rituels et transmettaient la mémoire du peuple ?	qcm	["Les Druides", "Les Augures", "Les Bardes", "Les Ovates"]	Les Druides	Les Druides formaient la classe sacerdotale et intellectuelle des sociétés celtes. Ils étaient à la fois prêtres, juges, philosophes et enseignants. César les décrit comme exemptés de service militaire et de taxes.	t	2026-04-08 00:40:23.86797+00	\N
128	daily	easy	faction-celtique	\N	De la forteresse d'Alésia, un cri de guerre traversa les collines — et l'histoire retint son nom pour toujours.	Comment s'appelait le chef gaulois qui mena la grande révolte contre César en 52 av. J.-C. ?	qcm	["Vercingétorix", "Ambiorix", "Viriatus", "Dumnorix"]	Vercingétorix	Vercingétorix, chef des Arvernes, fédéra les tribus gauloises contre Rome et remporta la bataille de Gergovie. Vaincu à Alésia, il fut emmené à Rome et exécuté six ans plus tard.	t	2026-04-08 00:40:23.86797+00	\N
129	daily	easy	faction-celtique	\N	Ses racines plongent aussi profond que ses branches s'élèvent — il est le pilier entre les trois mondes.	Quel arbre était considéré comme sacré par les Celtes et donnait son nom à leurs lieux de culte ?	qcm	["Le Chêne", "Le Frêne", "L'If", "Le Bouleau"]	Le Chêne	Le mot "druide" est probablement dérivé du proto-celtique *dru-wid, où *dru signifie chêne (ou "solide"). Le gui poussant sur le chêne était particulièrement vénéré lors des rites de cueillette.	t	2026-04-08 00:40:23.86797+00	\N
130	daily	easy	faction-celtique	\N	Les oies du Capitole criaient dans la nuit — mais les soldats romains dormaient, et les Gaulois montaient en silence.	En quel siècle les Gaulois ont-ils saccagé Rome pour la première fois ?	qcm	["IVe siècle av. J.-C.", "IIe siècle av. J.-C.", "IIIe siècle av. J.-C.", "Ve siècle av. J.-C."]	IVe siècle av. J.-C.	En 390 av. J.-C. (IVe siècle), les Gaulois Sénons commandés par Brennus défont l'armée romaine à la Allia, puis pillent Rome. La phrase attribuée à Brennus, "Vae victis !" (malheur aux vaincus !), est restée célèbre.	t	2026-04-08 00:40:23.86797+00	\N
131	daily	easy	faction-celtique	\N	La roue tourne, le soleil avance — et le dieu du ciel lance ses rayons comme autant de rayons de char.	Comment s'appelait le dieu gaulois souvent associé au soleil et représenté avec une roue ?	qcm	["Taranis", "Cernunnos", "Lugh", "Ogmios"]	Taranis	Taranis était le dieu du tonnerre et du ciel chez les Gaulois. Son attribut principal était la roue solaire, symbole du cycle cosmique. Il formait avec Esus et Toutatis une triade divine mentionnée par Lucain.	t	2026-04-08 00:40:23.86797+00	\N
132	daily	easy	faction-celtique	\N	Au creux de la forêt primordiale, entre le cerf et le serpent, siège le maître des bêtes et des passages.	Quel dieu celte cornu est souvent représenté assis en tailleur, entouré d'animaux sauvages ?	qcm	["Cernunnos", "Taranis", "Esus", "Sucellus"]	Cernunnos	Cernunnos est le dieu aux bois de cerf, maître des animaux et du monde sauvage. Il est représenté sur le chaudron de Gundestrup. Son nom même signifie probablement "le cornu" en gaulois.	t	2026-04-08 00:40:23.86797+00	\N
133	daily	easy	faction-celtique	\N	Les fossés s'étiraient sur des kilomètres, et deux armées gauloises ne purent briser l'étau romain.	Quelle est la grande forteresse gauloise où Vercingétorix fut finalement vaincu par César ?	qcm	["Alésia", "Gergovie", "Bibracte", "Uxellodunum"]	Alésia	Le siège d'Alésia (52 av. J.-C.) est un chef-d'œuvre de génie militaire romain. César fit construire deux lignes de fortifications (contrevallation et circonvallation) pour piéger Vercingétorix tout en repoussant une armée de secours.	t	2026-04-08 00:40:23.86797+00	\N
134	daily	easy	faction-celtique	\N	Sur l'île de la Seine, leurs bateaux glissaient, et leur nom resta gravé dans la pierre des siècles.	Quelle tribu gauloise habitait autour de l'actuelle Paris, donnant son nom à la ville ?	qcm	["Les Parisii", "Les Carnutes", "Les Éduens", "Les Arvernes"]	Les Parisii	Les Parisii étaient une tribu gauloise établie sur l'île de la Cité et les rives de la Seine. Leur oppidum Lutetia est à l'origine de Paris. Leur emblème, la barque, figure encore sur les armoiries de Paris.	t	2026-04-08 00:40:23.86797+00	\N
135	daily	easy	faction-celtique	\N	Le métal jaune coulait sous les doigts des orfèvres, prenant la forme de spirales et de nœuds sacrés.	Quel métal, rare et précieux, les artisans celtes maîtrisaient-ils pour fabriquer bijoux et torques ?	qcm	["L'or", "Le bronze", "L'étain", "Le fer"]	L'or	Les orfèvres celtes étaient réputés dans tout le monde antique pour leur maîtrise de l'or. Le torque (collier rigide en or torsadé) était le signe de haut rang par excellence. De nombreux trésors celtes en or ont été retrouvés en France et en Irlande.	t	2026-04-08 00:40:23.86797+00	\N
136	daily	easy	faction-celtique	\N	Les lettres tracées sur la pierre ou le bois portaient les formules des hommes d'avant — avant que Rome n'écrive sur tout.	En quelle langue les inscriptions gauloises étaient-elles rédigées, avant l'adoption du latin ?	qcm	["En alphabet grec ou latin adapté au gaulois", "En runique", "En phénicien", "En étrusque"]	En alphabet grec ou latin adapté au gaulois	Les Gaulois du Midi utilisaient d'abord l'alphabet grec de Marseille pour écrire leur langue, avant d'adopter l'alphabet latin. La langue gauloise appartenait à la famille des langues celtiques continentales.	t	2026-04-08 00:40:23.86797+00	\N
137	daily	easy	faction-celtique	\N	La corne d'abondance ne se vide jamais pour les braves — tel est le pacte de l'Autre Monde avec les vivants.	Quel festin mythique irlandais réunit les héros de l'Autre Monde autour d'un chaudron d'abondance ?	qcm	["Le festin de Bricriu", "Le Graal celtique", "L'assemblée de Tara", "Le banquet de Finn"]	Le festin de Bricriu	Le Festin de Bricriu est l'un des grands textes de la mythologie irlandaise du Cycle d'Ulster. Bricriu le "venimeux" organise un banquet pour provoquer les héros — dont Cú Chulainn — à se disputer le "morceau du champion".	t	2026-04-08 00:40:23.86797+00	\N
138	daily	easy	faction-celtique	\N	Sa naissance fut présage de gloire et de mort — et il choisit une vie brève mais lumineuse plutôt qu'une longue obscurité.	Quel héros irlandais du Cycle d'Ulster était connu pour ses exploits surhumains et sa mort tragique ?	qcm	["Cú Chulainn", "Finn Mac Cool", "Diarmuid", "Conall Cernach"]	Cú Chulainn	Cú Chulainn (le chien de Culann) est le grand héros du Cycle d'Ulster. Fils du dieu Lugh, il accomplit des exploits extraordinaires dans un état de fureur guerrière appelé le "riastrad". Il mourut jeune, conformément à la prophétie.	t	2026-04-08 00:40:23.86797+00	\N
139	daily	easy	faction-celtique	\N	La nuit où les frontières entre les vivants et les morts s'amincissent jusqu'à disparaître — les ancêtres reviennent festoyer.	Quelle cérémonie celte marquait le début de l'année au 1er novembre et est à l'origine d'Halloween ?	qcm	["Samain", "Beltaine", "Imbolc", "Lughnasadh"]	Samain	Samain (ou Samhain) était la fête celte du Nouvel An, célébrée dans la nuit du 31 octobre au 1er novembre. C'était un moment de passage entre les mondes. Les Chrétiens la transformèrent en Toussaint, et ses pratiques populaires donnèrent Halloween.	t	2026-04-08 00:40:23.86797+00	\N
140	daily	easy	faction-celtique	\N	Sur les hauteurs, derrière les remparts de bois et de pierre, bat le cœur d'une tribu tout entière.	Comment appelle-t-on les grandes enceintes fortifiées collinaires que les Gaulois utilisaient comme villes et centres politiques ?	qcm	["Des oppida", "Des villas", "Des castella", "Des castra"]	Des oppida	Les oppida (singulier : oppidum) étaient de vastes agglomérations fortifiées gauloises construites sur des hauteurs. Bibracte, Gergovie et Alésia en sont des exemples célèbres. César en décrit de nombreux dans la Guerre des Gaules.	t	2026-04-08 00:40:23.86797+00	\N
141	daily	easy	faction-nordique	\N	Forgé par les nains dans les profondeurs de la terre, il revient toujours dans la main qui le lance.	Quel est le nom du marteau du dieu nordique Thor, symbole de sa puissance sur la foudre ?	qcm	["Mjöllnir", "Gungnir", "Gram", "Tyrfing"]	Mjöllnir	Mjöllnir, le marteau de Thor, est l'arme la plus célèbre de la mythologie nordique. Son nom signifie probablement "broyeur". Il est si lourd que seul Thor peut le porter, et il revient toujours dans sa main après avoir été lancé.	t	2026-04-08 00:40:23.86797+00	\N
142	daily	easy	faction-nordique	\N	Les Valkyries choisissent les braves sur les champs de bataille — et les conduisent vers les murs d'or.	Comment s'appelle le palais céleste d'Odin où vont les guerriers morts au combat ?	qcm	["Le Valhalla", "L'Asgard", "Le Midgard", "Niflheim"]	Le Valhalla	Le Valhalla (Valhöll, "salle des tués") est la grande salle d'Odin en Asgard. Les einherjar (guerriers élus) y festoient et s'entraînent chaque jour jusqu'au Ragnarök. Seuls les guerriers morts au combat pouvaient y être admis.	t	2026-04-08 00:40:23.86797+00	\N
143	daily	easy	faction-nordique	\N	Ses racines plongent dans les puits du destin, de la sagesse et du Niflheim — et ses branches portent tout ce qui existe.	Quel est le nom du grand frêne cosmique qui soutient les neuf mondes de la cosmologie nordique ?	qcm	["Yggdrasil", "Mjöllnir", "Bifröst", "Urðarbrunnr"]	Yggdrasil	Yggdrasil est le frêne cosmique de la mythologie nordique. Son nom signifie "le destrier d'Ygg (Odin)", en référence au sacrifice d'Odin pendu à l'arbre pour découvrir les runes. Ses trois racines plongent vers Asgard, Jötunheim et Niflheim.	t	2026-04-08 00:40:23.86797+00	\N
144	daily	easy	faction-nordique	\N	Il riait quand les autres pleuraient, et pleurait quand les autres riaient — jamais on ne sut de quel côté il se rangerait.	Quel dieu nordique est le dieu de la ruse, du feu et du chaos, fils adoptif d'Odin ?	qcm	["Loki", "Tyr", "Baldr", "Heimdall"]	Loki	Loki est le dieu de la ruse (trickster) de la mythologie nordique. D'abord allié des Ases, il devient de plus en plus malveillant. Il est responsable de la mort de Baldr et sera enchaîné jusqu'au Ragnarök, où il se battra du côté des géants.	t	2026-04-08 00:40:23.86797+00	\N
145	daily	easy	faction-nordique	\N	Des drakkars surgirent de la brume, et les moines de Lindisfarne comprirent que le monde avait changé.	En quel siècle les Vikings commencèrent-ils leurs grandes expéditions en Europe occidentale ?	qcm	["VIIIe siècle", "VIe siècle", "IXe siècle", "Xe siècle"]	VIIIe siècle	Le raid sur le monastère de Lindisfarne en 793 marque traditionnellement le début de l'Âge Viking. Cette date du VIIIe siècle inaugure deux siècles d'expansion scandinave vers l'Irlande, la France, la Russie et même l'Amérique du Nord.	t	2026-04-08 00:40:23.86797+00	\N
146	daily	easy	faction-nordique	\N	Le roi des Francs lui céda la terre pour acheter la paix — et le Nord s'installa dans le cœur de la Gaule.	Quel chef viking donna son nom à la Normandie après s'y être installé au Xe siècle ?	qcm	["Rollon", "Ragnar Lothbrok", "Harald à la Belle Chevelure", "Sigurd le Serpent de l'Œil"]	Rollon	Rollon (ou Hrólf) fut le premier duc de Normandie. En 911, par le traité de Saint-Clair-sur-Epte, Charles le Simple lui céda le territoire en échange de sa conversion au christianisme et de sa protection contre d'autres raids vikings.	t	2026-04-08 00:40:23.86797+00	\N
147	daily	easy	faction-nordique	\N	Elles planaient au-dessus des mourants, invisibles mais implacables — désignant ceux qui iraient festoyer avec Odin.	Comment appelle-t-on les femmes guerrières ou esprits féminins qui choisissaient les morts sur les champs de bataille nordiques ?	qcm	["Les Valkyries", "Les Nornes", "Les Disir", "Les Shieldmaidens"]	Les Valkyries	Les Valkyries (valkyrja, "celle qui choisit les tués") étaient les servantes d'Odin chargées de sélectionner les guerriers dignes d'entrer au Valhalla. Parmi les plus connues : Brynhildr et Sigrun. Elles chevauchaient des chevaux et portaient des lances.	t	2026-04-08 00:40:23.86797+00	\N
148	daily	easy	faction-nordique	\N	Il brille de mille couleurs entre les royaumes — et seuls les dieux et les élus peuvent le traverser.	Quel est le nom du pont arc-en-ciel reliant le monde des hommes (Midgard) à celui des dieux (Asgard) ?	qcm	["Bifröst", "Yggdrasil", "Gjöll", "Ginnungagap"]	Bifröst	Le Bifröst est le pont arc-en-ciel de la mythologie nordique, gardé par Heimdall. Il sera détruit lors du Ragnarök quand les géants de feu (fils de Surtr) le traverseront en masse pour attaquer Asgard.	t	2026-04-08 00:40:23.86797+00	\N
149	daily	easy	faction-nordique	\N	La tête de dragon à la proue regardait l'horizon — et les hommes à bord ramaient comme si leur vie en dépendait.	Quel type de bateau les Vikings utilisaient-ils pour leurs raids côtiers, rapide et capable de naviguer en eaux peu profondes ?	qcm	["Le drakkar", "Le knarr", "La galère", "Le cog"]	Le drakkar	Le drakkar (longship en anglais) était le navire de guerre viking par excellence. Avec son tirant d'eau très faible, il pouvait remonter les rivières et s'échouer sur les plages. Le knarr était le navire de commerce plus large et moins rapide.	t	2026-04-08 00:40:23.86797+00	\N
150	daily	easy	faction-nordique	\N	Il tendit la main dans la gueule du loup pour que les autres dieux puissent ligoter la bête — sachant ce qu'il perdrait.	Quel dieu nordique perdit sa main droite en la sacrifiant pour enchaîner le loup Fenrir ?	qcm	["Tyr", "Odin", "Thor", "Freyr"]	Tyr	Tyr, dieu de la justice et du combat singulier, offrit sa main droite comme garantie au loup Fenrir pendant que les autres dieux l'enchaînaient avec le lien magique Gleipnir. Son sacrifice permit de retarder le Ragnarök.	t	2026-04-08 00:40:23.86797+00	\N
151	daily	easy	faction-nordique	\N	Les loups avaleront le soleil et la lune, Yggdrasil tremblera — et les dieux mourront en combattant, sachant qu'ils mourront.	Quelle est la fin du monde dans la cosmologie nordique, la bataille ultime des dieux contre les géants et les monstres ?	qcm	["Le Ragnarök", "Le Fimbulwinter", "Le Niflheim", "La Wyrd"]	Le Ragnarök	Le Ragnarök ("destin des dieux") est la grande apocalypse nordique. Odin mourra avalé par Fenrir, Thor sera tué par le Serpent du Midgard, Freyr tombera face à Surtr. Mais un nouveau monde renaîtra ensuite, plus pur.	t	2026-04-08 00:40:23.86797+00	\N
152	daily	easy	faction-nordique	\N	Au-delà de toutes les cartes connues, il vogua vers l'ouest — et trouva une terre que personne n'avait encore nommée.	Quel explorateur viking est considéré comme le premier Européen à avoir atteint l'Amérique du Nord, vers l'an 1000 ?	qcm	["Leif Erikson", "Erik le Rouge", "Bjarne Herjolfsson", "Thorvald Erikson"]	Leif Erikson	Leif Erikson, fils d'Erik le Rouge, atteignit le Vinland (probablement Terre-Neuve) vers l'an 1000. Le site archéologique de L'Anse aux Meadows au Canada confirme la présence viking en Amérique du Nord, 500 ans avant Colomb.	t	2026-04-08 00:40:23.86797+00	\N
153	daily	easy	faction-nordique	\N	Chaque signe porte une force propre — graver une rune, c'est convoquer quelque chose d'ancien et de puissant.	Comment s'appelle le système d'écriture utilisé par les peuples germaniques et nordiques, aux caractères anguleux taillés dans le bois ou la pierre ?	qcm	["Les runes", "Les glyphes", "L'ogham", "Les cunéiformes"]	Les runes	Les runes sont le système d'écriture des peuples germaniques (alphabet futhark). L'Elder Futhark (Ier-VIIe siècle) comporte 24 signes. Au-delà de leur usage pratique, les runes avaient une dimension magique et divinatoire.	t	2026-04-08 00:40:23.86797+00	\N
154	daily	easy	faction-nordique	\N	Au sommet du monde des dieux, entouré de murailles forgées par les géants, se dresse le trône du Père de Tout.	Quelle est la capitale légendaire d'Asgard, résidence principale d'Odin dans la mythologie nordique ?	qcm	["Glaðsheim / Valaskjálf", "Valhalla", "Ýdalir", "Fólkvangr"]	Glaðsheim / Valaskjálf	Valaskjálf est le palais d'Odin dans Asgard, où se trouve son trône Hliðskjálf depuis lequel il observe les neuf mondes. Glaðsheim est la grande salle où siègent les douze dieux Ases lors de leurs assemblées.	t	2026-04-08 00:40:23.86797+00	\N
155	daily	easy	faction-romaine	\N	Deux jumeaux nourris par une louve, une cité tracée au soc d'une charrue — ainsi naquit l'Éternelle.	Selon la tradition, en quelle année Rome fut-elle fondée ?	qcm	["753 av. J.-C.", "509 av. J.-C.", "264 av. J.-C.", "44 av. J.-C."]	753 av. J.-C.	La fondation de Rome par Romulus est traditionnellement datée de 753 av. J.-C. (anno urbis conditae). Cette date, calculée par l'annaliste Varron, servait de référence au calendrier romain. Archéologiquement, des traces d'occupation du Palatin remontent au VIIIe siècle av. J.-C.	t	2026-04-08 00:40:23.86797+00	\N
156	daily	easy	faction-romaine	\N	Son temple dominait le Capitole — non pas en déesse de guerre, mais en gardienne de la cité et des savoirs.	Quel est le nom de la déesse romaine de la sagesse, des arts et de la guerre stratégique, équivalente à Athéna ?	qcm	["Minerve", "Junon", "Diane", "Vénus"]	Minerve	Minerve était l'une des trois divinités de la Triade Capitoline avec Jupiter et Junon. Déesse de la sagesse, des arts et des techniques de guerre, elle était particulièrement vénérée des artisans, des médecins et des poètes.	t	2026-04-08 00:40:23.86797+00	\N
157	daily	easy	faction-romaine	\N	Dans le Forum, les voix des citoyens s'élevaient — et les décisions de la cité se prenaient en plein air.	Comment s'appelait l'assemblée de citoyens romains qui votait les lois et élisait les magistrats sous la République ?	qcm	["Le Sénat", "Les Comices", "Le Concile de la Plèbe", "Le Tribunal"]	Le Sénat	Sous la République romaine, le Sénat (Senatus) était l'organe principal de gouvernement, composé d'anciens magistrats. Il contrôlait les finances, la politique étrangère et les provinces. Les comices votaient les lois mais le Sénat restait prédominant.	t	2026-04-08 00:40:23.86797+00	\N
158	daily	easy	faction-romaine	\N	Des arches de pierre s'étirent à perte de vue — et l'eau coule sans pompe ni machine, portée par la seule pente.	Quel type de construction romaine permettait de transporter l'eau sur de longues distances grâce à un écoulement par gravité ?	qcm	["L'aqueduc", "Le cloaque", "Le castellum", "L'hypocauste"]	L'aqueduc	Les aqueducs romains sont l'une des plus grandes réalisations d'ingénierie de l'Antiquité. Rome comptait onze aqueducs principaux approvisionnant la ville en eau. Le Pont du Gard (France) est l'un des mieux conservés, avec une dénivellation de seulement 17 mètres sur 50 km.	t	2026-04-08 00:40:23.86797+00	\N
159	daily	easy	faction-romaine	\N	Ses arches encerclaient l'arène comme les bras d'un colosse — et le rugissement de la foule se mêlait au sang sur le sable.	Quel était le nom du plus grand amphithéâtre romain, construit à Rome sous les Flaviens et pouvant accueillir 50 000 spectateurs ?	qcm	["Le Colisée (Amphithéâtre Flavien)", "Le Circus Maximus", "Le Panthéon", "Le Forum de Trajan"]	Le Colisée (Amphithéâtre Flavien)	Le Colisée (Amphitheatrum Flavium) fut construit entre 70 et 80 apr. J.-C. sous les empereurs Vespasien et Titus. Il pouvait accueillir entre 50 000 et 80 000 spectateurs pour les combats de gladiateurs, les chasses aux animaux et les exécutions publiques.	t	2026-04-08 00:40:23.86797+00	\N
160	daily	easy	faction-romaine	\N	Les montagnes enneigées ne l'arrêtèrent pas — il descendit sur l'Italie comme une tempête venue du sud.	Quel général romain traversa les Alpes avec des éléphants pour attaquer Rome par le nord au IIIe siècle av. J.-C. ?	qcm	["Hannibal Barca", "Pyrrhus d'Épire", "Mithridate", "Viriatus"]	Hannibal Barca	Hannibal Barca, général carthaginois, traversa les Alpes en 218 av. J.-C. avec 37 éléphants de guerre lors de la Deuxième Guerre Punique. Il infligea plusieurs défaites sévères à Rome (Tessin, Trébie, Lac Trasimène, Cannes) mais ne put jamais prendre la ville.	t	2026-04-08 00:40:23.86797+00	\N
161	daily	easy	faction-romaine	\N	Chaque légion, une ville en marche — disciplinée, armée, prête à planter son aigle aux confins du monde connu.	Combien de légions composait environ l'armée romaine à son apogée sous le Haut-Empire ?	qcm	["Une trentaine de légions", "Dix légions", "Cent légions", "Cinq légions"]	Une trentaine de légions	Au Haut-Empire, Rome alignait entre 25 et 33 légions selon les périodes. Chaque légion comptait environ 5 000 à 6 000 hommes. L'aigle d'argent (aquila) était le symbole sacré de chaque légion — perdre son aigle était le pire déshonneur.	t	2026-04-08 00:40:23.86797+00	\N
162	daily	easy	faction-romaine	\N	Sous les colonnes du temple, dans la rumeur du marché et l'éclat des plaidoiries, battait le cœur de toute cité.	Quel mot latin désigne la grande place publique au cœur de chaque cité romaine, servant de marché et de lieu politique ?	qcm	["Forum", "Basilique", "Capitole", "Curia"]	Forum	Le forum était le centre civique, commercial et religieux de toute ville romaine. Le Forum Romanum à Rome en était le modèle. Chaque cité de province avait son propre forum reproduisant ce modèle, signe visible de la romanisation.	t	2026-04-08 00:40:23.86797+00	\N
163	daily	easy	faction-romaine	\N	Une ligne de pierre et de tourbes traversait l'île d'un bout à l'autre — derrière elle, la civilisation ; devant, l'inconnu.	Quel empereurroma romain fit construire un mur défensif en Bretagne (actuelle Angleterre) pour marquer la frontière nord de l'Empire ?	qcm	["Hadrien", "Trajan", "Constantin", "Domitien"]	Hadrien	Le mur d'Hadrien fut construit à partir de 122 apr. J.-C. sur ordre de l'empereur Hadrien. Long de 117 km, il traversait l'Angleterre de la mer du Nord à la mer d'Irlande. Il marquait la limite nord-ouest de l'Empire romain.	t	2026-04-08 00:40:23.86797+00	\N
164	daily	easy	faction-romaine	\N	Sous les mosaïques, un souffle chaud monte des entrailles de la maison — le confort romain, invisible mais omniprésent.	Quel est le nom du système de chauffage par le sol utilisé dans les thermes et villas romaines, où l'air chaud circulait sous les dalles ?	qcm	["L'hypocauste", "Le caldarium", "Le tepidarium", "L'apodyterium"]	L'hypocauste	L'hypocauste (hypocaustum) était un système de chauffage romain par le sol, inventé au Ier siècle av. J.-C. Des pilettes de briques (pilae) surélevaient le plancher, permettant à l'air chaud produit par un foyer (praefurnium) de circuler en dessous.	t	2026-04-08 00:40:23.86797+00	\N
165	daily	easy	faction-romaine	\N	Son aigle plongeait sur les armées ennemies — et son éclair annonçait que la faveur divine avait changé de camp.	Comment les Romains nommaient-ils leur dieu suprême, maître du tonnerre et des autres dieux ?	qcm	["Jupiter", "Mars", "Saturn", "Pluton"]	Jupiter	Jupiter (Iuppiter, contraction de Iovis Pater, "Père du ciel") était le dieu suprême du panthéon romain. Équivalent de Zeus grec, il était le protecteur de Rome et de son Empire. Son temple sur le Capitole était le plus sacré de la ville.	t	2026-04-08 00:40:23.86797+00	\N
166	daily	easy	faction-romaine	\N	Les aigles se posèrent, les légions rentrèrent leurs étendards — et mille ans d'histoire s'arrêtèrent en un seul jour.	En quel siècle l'Empire romain d'Occident prit-il fin officiellement ?	qcm	["Ve siècle apr. J.-C.", "IVe siècle apr. J.-C.", "VIe siècle apr. J.-C.", "IIIe siècle apr. J.-C."]	Ve siècle apr. J.-C.	L'Empire romain d'Occident prit fin en 476 apr. J.-C. (Ve siècle) quand Odoacre, chef barbare, déposa le dernier empereur Romulus Augustule. Cette date marque conventionnellement la fin de l'Antiquité et le début du Moyen Âge.	t	2026-04-08 00:40:23.86797+00	\N
167	daily	easy	faction-romaine	\N	Son dôme parfait n'a pas de fenêtres — juste un œil ouvert sur le ciel, l'oculus par lequel entre la lumière divine.	Quel bâtiment romain, recouvert d'un dôme remarquable, est dédié à "tous les dieux" et est encore debout à Rome ?	qcm	["Le Panthéon", "Le Colisée", "Les Thermes de Caracalla", "La Basilique de Maxence"]	Le Panthéon	Le Panthéon de Rome fut construit sous Hadrien vers 125 apr. J.-C. Son dôme en béton de 43 mètres de diamètre reste le plus grand dôme non renforcé du monde. L'oculus (ouverture de 8,7 m) au sommet est la seule source de lumière.	t	2026-04-08 00:40:23.86797+00	\N
168	daily	easy	faction-romaine	\N	Sur parchemin, un officier consigna les secrets de la légion victorieuse — et ses pages traversèrent les siècles.	Quel célèbre traité d'art militaire romain, rédigé au IVe siècle, reste une référence sur l'organisation des légions ?	qcm	["L'Epitoma rei militaris de Végèce", "La Guerre des Gaules de César", "L'Art de la guerre de Sun Tzu", "Les Stratégèmes de Frontin"]	L'Epitoma rei militaris de Végèce	L'Epitoma rei militaris (ou De re militari) de Flavius Végèce Renatus, rédigé fin IVe siècle, est le principal traité militaire romain conservé. Il décrit l'organisation, l'entraînement et les tactiques des légions, et fut étudié tout au long du Moyen Âge.	t	2026-04-08 00:40:23.86797+00	\N
169	daily	easy	faction-byzantine	\N	Entre deux continents, la ville aux sept collines portait la lumière d'un empire qui refusait de mourir.	Quel était le nom de la capitale de l'Empire byzantin, fondée par Constantin Ier sur le Bosphore ?	qcm	["Constantinople", "Antioche", "Thessalonique", "Alexandrie"]	Constantinople	Constantinople (aujourd'hui Istanbul) fut fondée par Constantin Ier en 330 apr. J.-C. sur le site de l'ancienne Byzance. Elle fut la capitale de l'Empire romain d'Orient puis byzantin pendant plus de mille ans, jusqu'à sa chute en 1453.	t	2026-04-08 00:40:23.86797+00	\N
170	daily	easy	faction-byzantine	\N	Son dôme semblait suspendu par des chaînes d'or invisibles — les fidèles croyaient que les anges le maintenaient en l'air.	Quel est le nom de la grande église de Constantinople, chef-d'œuvre de l'architecture byzantine construite au VIe siècle ?	qcm	["Sainte-Sophie (Hagia Sophia)", "Le Palais des Blachernes", "L'église des Saints-Apôtres", "Sainte-Irène"]	Sainte-Sophie (Hagia Sophia)	Sainte-Sophie (Hagia Sophia, "Sainte Sagesse") fut construite sous Justinien Ier et inaugurée en 537. Son immense dôme de 31 mètres de diamètre, qui semble flotter grâce à ses fenêtres à la base, révolutionna l'architecture. Elle fut cathédrale, puis mosquée, puis musée.	t	2026-04-08 00:40:23.86797+00	\N
171	daily	easy	faction-byzantine	\N	Il voulut que les lois de Rome survivent à Rome elle-même — et fit graver en latin ce que les Grecs administreraient.	Quel emperor byzantin rédigea le Code Justinien, une compilation monumentale du droit romain toujours influente aujourd'hui ?	qcm	["Justinien Ier", "Constantin Ier", "Héraclius", "Basile II"]	Justinien Ier	Justinien Ier (527-565) fit compiler le Corpus Juris Civilis sous la direction du juriste Tribonien. Ce code, achevé en 534, rassemblait des siècles de droit romain. Il fonde encore aujourd'hui les systèmes juridiques de nombreux pays européens.	t	2026-04-08 00:40:23.86797+00	\N
172	daily	easy	faction-byzantine	\N	Les navires ennemis brûlèrent sur l'eau — et même les vagues semblaient nourrir ces flammes que rien n'éteignait.	Quelle arme secrète les Byzantins utilisaient-ils pour incendier les flottes ennemies, et dont la composition resta mystérieuse ?	qcm	["Le feu grégeois", "La baliste à pétrole", "Le siphon à naphte", "Les grenades à soufre"]	Le feu grégeois	Le feu grégeois fut une arme redoutable de la flotte byzantine dès le VIIe siècle. Projeté par des siphons, il brûlait même sur l'eau. Sa composition exacte reste inconnue à ce jour, mais contenait probablement de la résine de pin, du naphte et de la chaux vive.	t	2026-04-08 00:40:23.86797+00	\N
184	daily	medium	faction-celtique	\N	Sur l'île de la Seine, un peuple de bateliers et de marchands avait établi leur oppidum. Rome en fit une ville, mais leur nom survécut dans celui de la cité.	Quel peuple gaulois habitait la région autour de l'actuelle Paris et lui donna son nom antique, Lutetia ?	free	\N	Parisii	Les Parisii étaient un peuple gaulois dont l'oppidum de Lutetia occupait l'île de la Cité. Leur nom, lié au commerce fluvial, donna directement son nom à Paris après la conquête romaine.	t	2026-04-08 00:40:33.203598+00	\N
173	daily	easy	faction-byzantine	\N	Sur le panneau de bois, le regard du saint ne vous regarde pas — il regarde au-delà, dans un espace que l'œil ne peut atteindre.	Quel style artistique byzantin plaçait des figures hiératiques sur fond d'or, sans perspective, pour signifier le sacré hors du temps ?	qcm	["L'icône", "La mosaïque antique", "La fresque romaine", "L'enluminure carolingienne"]	L'icône	L'icône (eikōn, "image") est l'image sacrée de la théologie byzantine. Sa frontalité, l'absence de perspective et le fond d'or symbolisent la réalité divine hors du temps. La querelle de l'iconoclasme (VIIIe-IXe siècle) faillit détruire cette tradition.	t	2026-04-08 00:40:23.86797+00	\N
174	daily	easy	faction-byzantine	\N	Le dernier empereur combattit jusqu'au bout dans la brèche — et le croissant remplaça la croix sur les coupoles.	En quel siècle l'Empire byzantin prit-il fin avec la chute de Constantinople ?	qcm	["XVe siècle", "XIIIe siècle", "XIVe siècle", "XVIe siècle"]	XVe siècle	Constantinople tomba le 29 mai 1453 (XVe siècle) face aux armées ottomanes de Mehmed II. Le dernier empereur, Constantin XI Paléologue, mourut au combat. Cette date marque conventionnellement la fin du Moyen Âge en Europe.	t	2026-04-08 00:40:23.86797+00	\N
175	daily	easy	faction-byzantine	\N	Ces hommes du Nord portaient leurs haches danoises au service d'un Dieu et d'un Basileus qu'ils avaient choisi librement.	Comment s'appelait la garde d'élite de l'Empereuromain byzantin, composée de guerriers étrangers dont de nombreux Vikings ?	qcm	["La Garde Varègue", "La Tagmata", "Les Cataphractoi", "Les Stratiotai"]	La Garde Varègue	La Garde Varègue (Variagoi en grec) fut créée à la fin du Xe siècle. Composée d'abord de guerriers Rus et Vikings, puis d'Anglais après 1066, elle était la garde personnelle de l'Empereur. Les Varègues étaient réputés pour leur loyauté absolue et leur redoutable habileté au combat.	t	2026-04-08 00:40:23.86797+00	\N
176	daily	easy	faction-byzantine	\N	Pour que l'Évangile parle en toutes langues, il fallut d'abord inventer les lettres qui les porteraient.	Quel patriarche de Constantinople créa au IXe siècle un alphabet pour écrire les langues slaves, ancêtre de l'alphabet cyrillique ?	qcm	["Cyrille (et Méthode)", "Photios", "Jean Chrysostome", "Basile de Césarée"]	Cyrille (et Méthode)	Saints Cyrille et Méthode, deux frères de Thessalonique, créèrent au IXe siècle l'alphabet glagolitique pour transcrire la langue slavonne liturgique. L'alphabet cyrillique, qui en dérive, fut nommé en l'honneur de Cyrille et est toujours utilisé en Russie, Bulgarie et Serbie.	t	2026-04-08 00:40:23.86797+00	\N
177	daily	easy	faction-byzantine	\N	Il ne se disait pas "Imperator" — il portait un titre plus ancien, plus chargé, héritage des monarques d'Orient.	Quel terme grec désigne l'Empereuromain byzantin, littéralement "roi des rois" dans la tradition orientale ?	qcm	["Basileus", "Autocrator", "Despote", "Sebastokrator"]	Basileus	Basileus (roi en grec) devint le titre officiel des Empereurs byzantins à partir d'Héraclius (610-641), remplaçant le latin Imperator. Le titre complet "Basileus ton Rhomaion" (Roi des Romains) soulignait la continuité avec l'Empire romain.	t	2026-04-08 00:40:23.86797+00	\N
178	daily	easy	faction-byzantine	\N	La vision d'avant la bataille avait été claire : sous ce signe, tu vaincras — et l'Empire changea de dieux.	Quel symbole, combinant les lettres grecques X (Chi) et P (Rho), fut adopté par Constantin comme signe chrétien impérial ?	qcm	["Le Chrismon (☧)", "La croix latine", "L'alpha et l'oméga", "L'ichthus"]	Le Chrismon (☧)	Le Chrismon ou Chi-Rho est formé des deux premières lettres du mot grec Christos. Constantin l'adopta comme symbole après sa vision avant la bataille du Pont Milvius (312). C'est l'un des premiers symboles chrétiens utilisés officiellement par un pouvoir impérial.	t	2026-04-08 00:40:23.86797+00	\N
179	daily	easy	faction-byzantine	\N	Dans l'arène aux cent mille voix, la couleur de votre faction valait plus que votre nom ou votre sang.	Quel est le nom du grand hippodrome de Constantinople où se déroulaient les courses de chars et les célébrations impériales ?	qcm	["L'Hippodrome de Constantinople", "Le Circus Maximus de Byzance", "Le Stade de Théodose", "L'Arène des Bleus"]	L'Hippodrome de Constantinople	L'Hippodrome de Constantinople, construit par Septime Sévère et agrandi par Constantin, pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y étaient des partis politiques autant que sportifs. La révolte de Nika (532) y fit 30 000 morts.	t	2026-04-08 00:40:23.86797+00	\N
180	daily	easy	faction-byzantine	\N	Sur la nature du Saint-Esprit et l'autorité du Pape, les deux Rome ne purent s'accorder — et la chrétienté se brisa en deux.	Quelle dispute théologique du IXe siècle divisa l'Église entre Rome et Constantinople, aboutissant au Grand Schisme de 1054 ?	qcm	["La querelle du Filioque", "La querelle des investitures", "L'iconoclasme", "L'arianisme"]	La querelle du Filioque	Le Filioque ("et du Fils") est l'ajout fait par l'Église latine au Credo : le Saint-Esprit procède du Père "et du Fils". Constantinople refusait cet ajout. Cette divergence théologique, combinée à des rivalités politiques, mena au Grand Schisme de 1054 séparant catholicisme et orthodoxie.	t	2026-04-08 00:40:23.86797+00	\N
181	daily	easy	faction-byzantine	\N	Il demandait des mercenaires — et reçut à la place des armées de pèlerins armés qui traversèrent son Empire comme un fleuve en crue.	Quel Empereuromain byzantin du XIe siècle fit appel au pape Urbain II, déclenchant indirectement la Première Croisade ?	qcm	["Alexis Ier Comnène", "Basile II", "Romain IV Diogène", "Jean II Comnène"]	Alexis Ier Comnène	En 1095, l'Empereuromain byzantin Alexis Ier Comnène envoya des ambassadeurs au Concile de Plaisance pour demander des mercenaires contre les Turcs Seldjoukides. Le Pape Urbain II lança à la place la Première Croisade au Concile de Clermont, dépassant largement les attentes d'Alexis.	t	2026-04-08 00:40:23.86797+00	\N
182	daily	medium	faction-celtique	\N	Les Arvernes dominaient le cœur de la Gaule depuis leurs oppida du Massif Central. Leur chef ultime allait unifier les tribus comme jamais auparavant.	Quel roi arverne affronta César lors de la campagne des Gaules et fut finalement capturé à Alésia en 52 av. J.-C. ?	qcm	["Ambiorix", "Vercingétorix", "Dumnorix", "Viridomarus"]	Vercingétorix	Vercingétorix réunit une coalition de tribus gauloises contre César. Sa stratégie de la terre brûlée fut efficace jusqu'à Alésia, où il fut contraint de se rendre après un siège de plusieurs semaines. Il fut exécuté à Rome en 46 av. J.-C.	t	2026-04-08 00:40:33.203598+00	\N
183	daily	medium	faction-celtique	\N	Pour les Celtes, la mort n'était pas une fin mais un passage vers un ailleurs lumineux, peuplé de dieux et d'ancêtres. Les bardes en chantaient les merveilles.	Dans la cosmologie celtique, quel terme désignait l'Autre Monde, le royaume des dieux et des morts situé au-delà des mers ou sous les collines ?	qcm	["L'Avalon", "Le Tír na nÓg", "Le Mag Mell", "L'Annwn"]	Le Tír na nÓg	Le Tír na nÓg (Terre de la Jeunesse éternelle) est le principal Autre Monde de la mythologie irlandaise. Annwn est son équivalent gallois, Mag Mell une variante irlandaise. Ces espaces coexistaient dans la tradition sans hiérarchie fixe.	t	2026-04-08 00:40:33.203598+00	\N
185	daily	medium	faction-celtique	\N	L'audace des Celtes n'avait pas de frontières : ils avaient saccagé Rome, traversé les Balkans et osèrent même défier Apollon dans son sanctuaire.	Quelle bataille de 279 av. J.-C. vit des guerriers celtes tenter de piller le sanctuaire grec de Delphes ?	qcm	["Bataille de Thermopyles", "Bataille de l'Aliakmon", "Raid de Delphes", "Bataille de Magnésie"]	Raid de Delphes	En 279 av. J.-C., des Galates menés par Brennos tentèrent de piller Delphes. Les Grecs repoussèrent l'attaque, attribuant leur victoire à des prodiges d'Apollon. L'événement marqua durablement l'imaginaire hellénique face aux "Barbares du Nord".	t	2026-04-08 00:40:33.203598+00	\N
186	daily	medium	faction-celtique	\N	Quand les jours raccourcissent et que le voile entre les vivants et les morts s'amincit, les Celtes allumaient des feux sur les collines pour traverser ensemble le seuil de l'hiver.	Comment s'appelait la grande fête celtique du début novembre, marquant l'entrée dans la saison sombre et le passage entre les mondes ?	free	\N	Samhain	Samhain (fin octobre / début novembre) était l'une des quatre grandes fêtes saisonnières celtes avec Imbolc, Beltaine et Lughnasadh. Elle marquait la fin de la saison de pâture et l'ouverture de l'Autre Monde, ancêtre direct d'Halloween.	t	2026-04-08 00:40:33.203598+00	\N
187	daily	medium	faction-celtique	\N	Les eaux immobiles des tourbières et des lacs gardaient les secrets des dieux celtes. Ce que les archéologues en ont retiré parle de sacrifices, d'offrandes et de foi.	Quelle est la principale source archéologique sur la religion druidique, découverte dans des lacs et marécages d'Europe celtique ?	qcm	["Les stèles de Carnac", "Les dépôts votifs aquatiques", "Les calendriers de Coligny", "Les tablettes de Bath"]	Les dépôts votifs aquatiques	Les Celtes jetaient dans les lacs, rivières et tourbières des armes, bijoux et parfois des humains à titre d'offrandes. Le lac de La Tène (Suisse) et le lac de Toulouse ont livré des milliers d'objets témoignant de cette pratique pan-celtique.	t	2026-04-08 00:40:33.203598+00	\N
188	daily	medium	faction-celtique	\N	Chaque chef gaulois qui se respectait avait à sa cour un homme capable de chanter ses exploits, maudire ses ennemis et préserver la mémoire des ancêtres dans la langue sacrée.	Dans la société gauloise, quelle classe sociale se situait entre les druides et le peuple ordinaire, exerçant un rôle de mémoire orale et de propagande poétique ?	qcm	["Les equites", "Les bardes", "Les vates", "Les ambactes"]	Les bardes	Les bardes (bardd en gaulois) composaient et déclamaient des poèmes épiques à la gloire des guerriers. Ils formaient, avec les druides et les vates (devins), la triade des "hommes de savoir" celtiques, seuls exemples de mobilité sociale reconnue.	t	2026-04-08 00:40:33.203598+00	\N
189	daily	medium	faction-celtique	\N	La frontière entre collaboration et résistance était mince dans la Gaule sous domination romaine. Certains jouaient des deux côtés, jusqu'au faux pas fatal.	Quel chef éduen, à la fois magistrat gaulois et citoyen romain, fut exécuté sur ordre de César pour trahison en 54 av. J.-C. ?	free	\N	Dumnorix	Dumnorix, frère de l'allié romain Diviciacos, cherchait à unir les Gaulois contre César tout en maintenant des apparences de loyauté. Arrêté alors qu'il tentait de fuir, il fut tué par la cavalerie de César en 54 av. J.-C.	t	2026-04-08 00:40:33.203598+00	\N
190	daily	medium	faction-celtique	\N	Les oppida gaulois n'étaient pas des camps rudimentaires mais de véritables cités fortifiées, dont les défenses impressionnèrent même les ingénieurs romains.	Quelle technique de construction gauloise, utilisant poutres de bois et remblai de terre avec un parement de pierre, est décrite par César dans la "Guerre des Gaules" ?	qcm	["L'opus incertum", "Le murus gallicus", "La palissade de chêne", "Le rempart vitreux"]	Le murus gallicus	Le murus gallicus est un système défensif typique des oppida gaulois : un parement de pierre retenant un remplissage de terre traversé de poutres horizontales liées par des clous de fer. César l'admire dans la "Guerre des Gaules" (VII, 23) pour sa résistance aux béliers.	t	2026-04-08 00:40:33.203598+00	\N
191	daily	medium	faction-celtique	\N	Certains Celtes ne s'arrêtèrent pas à Rome ni à Delphes : ils traversèrent la mer et fondèrent un royaume au cœur de l'actuelle Turquie, conservant leur langue pendant des siècles.	Quel peuple celte, établi en Anatolie au IIIe siècle av. J.-C., donna son nom à une région et une épître de saint Paul ?	free	\N	Galates	Les Galates (ou Gaulois d'Asie) s'installèrent en Anatolie centrale vers 278 av. J.-C. après avoir ravagé les royaumes hellénistiques. Leur région, la Galatie, est mentionnée par saint Paul dans son épître aux Galates, et leur langue celtique y survécut jusqu'au IVe siècle ap. J.-C.	t	2026-04-08 00:40:33.203598+00	\N
192	daily	medium	faction-celtique	\N	Au plus profond de l'hiver, quand les premières pousces percent la terre gelée, les Celtes savaient lire le message des dieux dans les signes de renouveau.	Quelle est la fête celtique du 1er février, associée au réveil de la nature et à la déesse Brigid, célébrée encore aujourd'hui en Irlande ?	qcm	["Beltaine", "Lughnasadh", "Imbolc", "Alban Eiler"]	Imbolc	Imbolc (1er février) marquait la lactation des brebis et le début du printemps selon le calendrier celtique. Associée à Brigid, déesse de la guérison, de la forge et de la poésie, elle fut christianisée en fête de sainte Brigitte d'Irlande.	t	2026-04-08 00:40:33.203598+00	\N
194	daily	medium	faction-celtique	\N	Gravé sur des plaques de bronze au Ier siècle de notre ère, ce calendrier lunaire est l'un des rares témoignages directs de la pensée astronomique des druides.	Le calendrier de Coligny, découvert en 1897, est rédigé dans quelle langue ?	qcm	["En latin", "En gaulois avec caractères latins", "En grec", "En ogham"]	En gaulois avec caractères latins	Le calendrier de Coligny (Ain, France) est le plus long texte gaulois connu. Rédigé en gaulois mais utilisant l'alphabet latin, il présente un cycle de 5 ans de 62 mois lunaires, témoignant d'une astronomie sophistiquée chez les druides.	t	2026-04-08 00:40:33.203598+00	\N
195	daily	medium	faction-celtique	\N	César écrivit que parmi tous les Gaulois, certains étaient les plus braves — et c'était peut-être plus un aveu d'admiration que d'objectivité.	Quel peuple belge, dont le territoire couvrait l'actuelle Champagne, résista le plus longtemps à César selon ses propres écrits ?	qcm	["Les Trévires", "Les Éburons", "Les Bellovaques", "Les Nerviens"]	Les Nerviens	César écrit dans la "Guerre des Gaules" (II, 15) que les Nerviens étaient "de loin les plus belliqueux" des Belges. Lors de la bataille de la Sambre en 57 av. J.-C., ils mirent les légions romaines en grande difficulté avant d'être presque anéantis.	t	2026-04-08 00:40:33.203598+00	\N
196	daily	medium	faction-nordique	\N	Suspendu neuf nuits à Yggdrasil, transpercé de sa propre lance, Odin acquit les runes et la sagesse du monde. Ces paroles sont sa transmission aux hommes.	Quel poème norrois du XIIIe siècle, composé de 164 strophes de sagesse attribuées à Odin, est aussi appelé "Les dits du Très-Haut" ?	qcm	["Le Völuspá", "Le Hávamál", "Le Grímnismál", "Le Skírnismál"]	Le Hávamál	Le Hávamál (Paroles du Très-Haut) est un poème de l'Edda poétique offrant conseils pratiques, maximes morales et récits mythologiques. Il constitue une des sources majeures sur l'éthique viking et la vision norroise de la sagesse.	t	2026-04-08 00:40:33.203598+00	\N
197	daily	medium	faction-nordique	\N	Dans le monde norrois, la loi ne venait pas d'un roi seul mais de la parole des hommes libres réunis sur la plaine du destin. La démocratie y avait un visage sauvage.	Comment les Vikings appelaient-ils leur assemblée législative et judiciaire populaire, tenue en plein air sur des sites désignés ?	free	\N	Thing	Le Thing (ou Þing) était l'assemblée des hommes libres où se réglaient les litiges, se votaient les lois et s'élisaient les chefs. L'Althing islandais, fondé en 930, est l'une des plus anciennes assemblées parlementaires du monde encore en activité.	t	2026-04-08 00:40:33.203598+00	\N
198	daily	medium	faction-nordique	\N	Sur le champ de bataille, certains guerriers d'Odin semblaient imperméables à la douleur et à la peur. Les sagas disent qu'ils combattaient comme des bêtes sauvages.	Quelle est la signification littérale du terme "berserker", nom donné aux guerriers vikings en état de transe furieuse ?	qcm	["Porteur de hache", "Manteau d'ours", "Sans armure", "Furieux de guerre"]	Manteau d'ours	Le mot "berserker" vient du norrois "berserkr" : "ber" (ours) + "serkr" (chemise/manteau). Ces guerriers consacrés à Odin combattaient en manteaux de peau d'ours ou sans armure, dans un état de fureur rituelle (wut) qui les rendait terrifiants.	t	2026-04-08 00:40:33.203598+00	\N
199	daily	medium	faction-nordique	\N	L'année 1066 vit deux invasions de l'Angleterre. L'une échoua dans le nord, fauchant le dernier grand conquérant viking. L'autre, au sud, allait changer l'histoire pour toujours.	Lors de quelle bataille de 1066 Harald Hardrada, roi de Norvège, fut-il tué en tentant de conquérir l'Angleterre ?	qcm	["Bataille de Maldon", "Bataille de Stamford Bridge", "Bataille d'Hastings", "Bataille de Clontarf"]	Bataille de Stamford Bridge	Harald Hardrada (Harald le Sévère) fut tué à Stamford Bridge le 25 septembre 1066 par le roi Harold II d'Angleterre. Trois jours plus tard, Harold devait marcher vers le sud pour affronter Guillaume le Conquérant à Hastings, où il mourut à son tour.	t	2026-04-08 00:40:33.203598+00	\N
200	daily	medium	faction-nordique	\N	Avant Colomb de cinq siècles, un Norrois suivit les traces de son père et toucha une terre que personne en Europe ne soupçonnait. Il l'appela Vinland.	Quel explorateur islandais est généralement crédité de la première installation européenne en Amérique du Nord, vers l'an 1000 ?	free	\N	Leif Erikson	Leif Erikson, fils d'Éric le Rouge, atteignit le continent nord-américain vers l'an 1000, fondant un établissement à L'Anse aux Meadows (Terre-Neuve, Canada). Ce site, fouillé depuis 1960, est la seule preuve archéologique confirmée d'une présence viking en Amérique.	t	2026-04-08 00:40:33.203598+00	\N
201	daily	medium	faction-nordique	\N	Au fond des océans, une créature ancienne comme le monde lui-même enserre toutes les terres connues dans ses anneaux. Thor et lui se connaissent, et leur destin est lié.	Dans la mythologie norroise, quel est le nom du serpent cosmique qui encercle Midgard et mord sa propre queue ?	qcm	["Níðhöggr", "Fenrir", "Jörmungandr", "Fáfnir"]	Jörmungandr	Jörmungandr (le Serpent du Milieu) est le fils de Loki et de la géante Angrboða. Thor et lui sont ennemis jurés : au Ragnarök, Thor le tuera mais mourra empoisonné par son venin après neuf pas. Níðhöggr est le dragon qui ronge les racines de Yggdrasil.	t	2026-04-08 00:40:33.203598+00	\N
202	daily	medium	faction-nordique	\N	Pour un Viking, mourir dans son lit était une honte si l'on n'avait pas vengé les siens. La réputation se construisait sur des actes, et se perdait en un instant de lâcheté.	Quel terme norrois désigne le code d'honneur non écrit des Vikings, centré sur la réputation, la loyauté et la vengeance des offenses ?	free	\N	Drengskapr	Le drengskapr (ou drengr) désignait l'idéal du guerrier noble : bravoure, générosité, respect de la parole donnée et sens de l'honneur. Son contraire, le níðingr (lâche, sans honneur), était la pire insulte possible dans la société norroise.	t	2026-04-08 00:40:33.203598+00	\N
203	daily	medium	faction-nordique	\N	Les hommes du Nord ne repartirent pas tous. Certains s'installèrent, se marièrent, apprirent le français — et devinrent les Normands, qui allaient conquérir l'Angleterre et la Sicile.	Quelle ville française, ancienne capitale du duché normand fondé par les Vikings, conserve un nom d'origine scandinave ?	qcm	["Caen", "Cherbourg", "Rouen", "Bayeux"]	Rouen	Rouen (Rothomagus en latin, Rúðuborg en norrois) devint la capitale du duché de Normandie accordé à Rollon en 911 par le traité de Saint-Clair-sur-Epte. Le nom "Normandie" lui-même vient de "Northmannia" (terre des hommes du Nord).	t	2026-04-08 00:40:33.203598+00	\N
204	daily	medium	faction-nordique	\N	L'univers norrois n'était pas plat ni simple : neuf royaumes s'entrelaçaient dans les branches et les racines de l'arbre éternel, depuis les profondeurs glacées jusqu'aux forges de feu.	Dans l'Edda de Snorri Sturluson, quels sont les neuf mondes reliés par l'arbre-monde Yggdrasil ?	qcm	["Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim", "Asgard, Midgard, Utgard, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim", "Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Dwarfheim, Helheim", "Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Ljosalfheim, Svartalfheim, Helheim"]	Asgard, Midgard, Jötunheim, Niflheim, Muspelheim, Vanaheim, Alfheim, Svartalfheim, Helheim	Les neuf mondes de Yggdrasil regroupent : Asgard (dieux Ases), Midgard (humains), Jötunheim (géants), Niflheim (brume/mort), Muspelheim (feu), Vanaheim (dieux Vanes), Alfheim (elfes lumineux), Svartalfheim (elfes noirs/nains), et Helheim (royaume des morts ordinaires).	t	2026-04-08 00:40:33.203598+00	\N
205	daily	medium	faction-nordique	\N	Il fallait des années d'apprentissage pour maîtriser cet art. Un seul vers pouvait honorer un roi ou le ruiner — les mots étaient des armes autant que des épées.	Quel type de poésie norroise, composée selon des règles strictes d'allitération et de kennings, était la marque des poètes de cour vikings ?	free	\N	Skaldique	La poésie skaldique (skáldskapr) se distinguait de la poésie eddique par ses règles métriques complexes (dróttkvætt) et l'usage de kennings (métaphores périphrastiques). Les skalds composaient des éloges royaux (drápur) et des mémoriaux (erfidrápur) en échange de récompenses.	t	2026-04-08 00:40:33.203598+00	\N
206	daily	medium	faction-nordique	\N	Le vieux monde des dieux nordiques résistait face à la croix. Mais quand les hommes forts tombent, les peuples changent de foi — parfois à la pointe de l'épée.	Quel jarl norvégien, gouverneur de la Norvège pour le compte danois, fut tué lors d'une révolte en 995 permettant la conversion forcée du pays au christianisme ?	qcm	["Hakon le Bon", "Jarl Sigurd", "Jarl Hakon Sigurdsson", "Erik Bloodaxe"]	Jarl Hakon Sigurdsson	Hakon Sigurdsson, jarl de Lade, gouverna la Norvège de façon quasi indépendante et maintint le culte des dieux nordiques contre la pression chrétienne danoise. Son assassinat par son propre esclave permit à Olaf Tryggvason de s'emparer du pouvoir et d'imposer le christianisme.	t	2026-04-08 00:40:33.203598+00	\N
207	daily	medium	faction-nordique	\N	Des hommes venus des fjords glacés se retrouvèrent à garder le trône le plus riche de la Méditerranée. Leur réputation de férocité était leur meilleur bouclier.	Comment s'appelait la garde d'élite byzantine composée en grande partie de guerriers scandinaves, servant l'Empereur de Constantinople ?	free	\N	Varègues	La Garde varègue (Varangian Guard) fut fondée vers 988 après qu'Olaf, prince de Kiev, envoya 6 000 guerriers à l'Empereur Basile II. Composée majoritairement de Scandinaves, puis d'Anglais après 1066, elle assura la protection personnelle des empereurs byzantins pendant trois siècles.	t	2026-04-08 00:40:33.203598+00	\N
208	daily	medium	faction-nordique	\N	Par ciel nuageux, sans étoiles, sur l'océan illimité, le Viking trouvait quand même son chemin. Son secret tenait dans un cristal qui capturait la lumière cachée.	Quel instrument les Vikings utilisaient-ils pour naviguer par temps couvert en s'orientant grâce à la lumière polarisée du soleil ?	qcm	["La boussole magnétique", "La pierre solaire", "L'astrolabe", "Le gnomon"]	La pierre solaire	La pierre solaire (sólarsteinn en norrois) était probablement de la calcite islandaise (spath d'Islande), capable de polariser la lumière et de révéler la position du soleil par ciel couvert. Des recherches récentes ont confirmé son efficacité pour la navigation en haute mer.	t	2026-04-08 00:40:33.203598+00	\N
209	daily	medium	faction-nordique	\N	Les dieux eux-mêmes savent qu'ils mourront. Odin connaît la prophétie, Thor sait qu'il tuera le serpent et succombera à son venin. Et pourtant ils combattent.	Dans la mythologie norroise, quel événement cosmique final voit les dieux combattre et périr contre les forces du chaos ?	qcm	["Fimbulwinter", "Le Ragnarök", "La Bataille des Dieux", "Le Crépuscule des Dieux"]	Le Ragnarök	Le Ragnarök (destin des puissances) est la fin du monde norrois : Odin est dévoré par Fenrir, Thor tue Jörmungandr mais meurt de son venin, Freyr périt contre Surtr. Mais le monde se renouvelle : une nouvelle terre émergera et des dieux survivants repeupleront un Asgard renaissant.	t	2026-04-08 00:40:33.203598+00	\N
210	daily	medium	faction-romaine	\N	Rome avait grandi grâce à ses légions de paysans-soldats. Mais quand la paysannerie s'effondra, un général ambitieux trouva une solution qui allait transformer la République pour toujours.	Quelle réforme militaire de la fin du IIe siècle av. J.-C. supprima le recrutement censitaire et ouvrit l'armée romaine aux prolétaires sans terre ?	qcm	["Réforme des Gracques", "Réforme marienne", "Réforme de Sylla", "Réforme de César"]	Réforme marienne	Gaius Marius (consul 7 fois entre 107 et 86 av. J.-C.) ouvrit l'armée aux capite censi (proléaires sans bien). L'État fournissait désormais l'équipement, et les légionnaires devenaient des professionnels liés à leur général plus qu'à Rome, préparant les guerres civiles.	t	2026-04-08 00:40:33.203598+00	\N
211	daily	medium	faction-romaine	\N	Un citoyen romain ne pouvait être condamné à mort sans recours. Ce droit fondamental distinguait Rome de tous les régimes despotiques qu'elle combattait — du moins en théorie.	Quel terme latin désignait le droit des citoyens romains à faire appel d'une sentence capitale devant l'assemblée du peuple ?	free	\N	Provocatio	La provocatio ad populum (appel au peuple) était un droit constitutionnel romain protégeant les citoyens contre l'arbitraire des magistrats. Codifiée par les lois Valerio-Horatiae de 449 av. J.-C., elle est l'une des premières formes de protection des droits individuels dans l'Antiquité.	t	2026-04-08 00:40:33.203598+00	\N
212	daily	medium	faction-romaine	\N	La plaine de Zama vit s'affronter le plus grand général de son époque contre un adversaire qui n'avait jamais perdu une bataille. Rome avait trouvé enfin son digne adversaire de Carthage.	Contre quel général carthaginois Rome remporta-t-elle la bataille de Zama en 202 av. J.-C., mettant fin à la Deuxième Guerre punique ?	qcm	["Hasdrubal", "Hamilcar Barca", "Hannibal Barca", "Mago Barca"]	Hannibal Barca	À Zama (202 av. J.-C.), Scipion l'Africain vainquit Hannibal en neutralisant ses éléphants et en utilisant la cavalerie numide de Massinissa retournée du côté romain. C'était la première défaite d'Hannibal en bataille rangée, après 16 ans de campagnes invincibles en Italie.	t	2026-04-08 00:40:33.203598+00	\N
213	daily	medium	faction-romaine	\N	La puissance de Rome ne résidait pas seulement dans ses légions mais dans sa capacité à bâtir : routes, aqueducs, et ces longues murailles qui séparaient le monde ordonné du chaos barbare.	Quel terme désigne la ligne de fortifications romaines construite aux frontières de l'Empire pour se protéger des peuples germaniques ?	qcm	["Le Vallum", "Le Limes", "La Via Militaris", "La Clausura"]	Le Limes	Le Limes (frontière, limite) désignait l'ensemble du système défensif aux frontières de l'Empire : fossés, palissades, tours de guet, routes militaires et forts. Le plus célèbre est le Limes germanicus (550 km), classé au patrimoine mondial de l'UNESCO.	t	2026-04-08 00:40:33.203598+00	\N
214	daily	medium	faction-romaine	\N	La République romaine avait inventé une soupape de sécurité : quand la situation devenait trop grave pour les institutions ordinaires, on nommait un seul homme pour tout décider.	Quel magistrat romain extraordinaire était investi de tous les pouvoirs pour une durée maximale de six mois en cas de crise grave de la République ?	free	\N	Dictateur	Le dictateur romain (dictator) était nommé par un consul sur recommandation du Sénat. Il disposait de l'imperium absolu mais devait abdiquer après six mois ou la fin de la crise. Cincinnatus est le dictateur modèle, qui retourna à sa charrue après avoir sauvé Rome.	t	2026-04-08 00:40:33.203598+00	\N
215	daily	medium	faction-romaine	\N	Rome aligna ce jour-là plus de 70 000 soldats. Au soir, la plupart étaient morts. Un seul général ennemi avait accompli ce que personne n'avait osé imaginer possible.	Quelle bataille de 216 av. J.-C. fut la plus catastrophique défaite militaire de Rome, où Hannibal détruisit deux armées consulaires grâce à une manœuvre d'encerclement ?	qcm	["Bataille du Tessin", "Bataille de la Trébie", "Bataille du lac Trasimène", "Bataille de Cannes"]	Bataille de Cannes	À Cannes (2 août 216 av. J.-C.), Hannibal mit en œuvre la première grande manœuvre d'encerclement documentée de l'histoire (la "tenaille de Cannes") : ses ailes reculèrent pour envelopper les légions qui avançaient au centre. Environ 50 000 Romains furent tués en une seule journée.	t	2026-04-08 00:40:33.203598+00	\N
216	daily	medium	faction-romaine	\N	Les thermes n'étaient pas de simples piscines : c'était un voyage du chaud au froid, une progression rituelle à travers des salles aux températures savamment calculées.	Comment s'appelait le bâtiment central des thermes romains où l'eau atteignait sa température maximale, le dernier bain avant de ressortir ?	free	\N	Caldarium	Le caldarium était la salle la plus chaude des thermes romains (40-45°C), chauffée par hypocauste. Le baigneur progressait du frigidarium (eau froide) au tepidarium (eau tiède) puis au caldarium. Les thermes de Caracalla à Rome pouvaient accueillir 1 600 personnes simultanément.	t	2026-04-08 00:40:33.203598+00	\N
217	daily	medium	faction-romaine	\N	L'île des druides résistait depuis des siècles aux convoitises romaines. César l'avait effleurée ; ce fut un autre qui la ceignit vraiment dans les chaînes de l'Empire.	Quel général romain conquit la Bretagne pour Claude en 43 ap. J.-C. et fut ensuite nommé gouverneur de la nouvelle province ?	qcm	["Gnaeus Julius Agricola", "Aulus Plautius", "Ostorius Scapula", "Suetonius Paulinus"]	Aulus Plautius	Aulus Plautius dirigea l'invasion de la Bretagne (Britannia) avec quatre légions en 43 ap. J.-C. Il remporta la décisive bataille de la Medway et permit à l'Empereur Claude lui-même de venir symboliquement prendre possession de la nouvelle province.	t	2026-04-08 00:40:33.203598+00	\N
218	daily	medium	faction-romaine	\N	La liberté avait plusieurs chemins à Rome : certains coûtaient une fortune, d'autres ne coûtaient qu'un geste. Mais tous laissaient une marque indélébile sur le statut social.	Quelle institution permettait aux Romains de manumissionner un esclave lors d'un repas, simplement en lui faisant toucher le sel et le pain ?	qcm	["La manumissio vindicta", "La manumissio censu", "La manumissio inter amicos", "La manumissio testamento"]	La manumissio inter amicos	La manumissio inter amicos (affranchissement entre amis) permettait à un maître de libérer son esclave lors d'un repas en présence de témoins. Moins formelle que la vindicta (par magistrat), elle créait un affranchi de statut latin plutôt que citoyen jusqu'à la loi Junia Norbana de 19 ap. J.-C.	t	2026-04-08 00:40:33.203598+00	\N
219	daily	medium	faction-romaine	\N	La démocratie romaine avait ses ruses pour protéger l'électeur des pressions des puissants. Une petite tablette permit à des milliers de citoyens de voter selon leur conscience.	Quel mot latin désignait le vote secret utilisé lors des élections et des procès romains, inscrit sur une tablette de cire ?	free	\N	Tabella	La lex Gabinia de 139 av. J.-C. introduisit le vote par tablette (tabella) pour les élections, remplaçant le vote oral qui exposait les citoyens aux pressions. Des lois similaires furent ensuite étendues aux procès et aux lois (tabella iudiciaria, tabella de legibus).	t	2026-04-08 00:40:33.203598+00	\N
220	daily	medium	faction-romaine	\N	La grandeur de Rome ne résidait pas seulement dans ses armées mais dans ses lois. Certains principes qu'elle énonça traversèrent les siècles pour fonder nos droits modernes.	Quel principe juridique romain, encore fondamental aujourd'hui, posait que nul ne peut être juge dans sa propre cause ?	qcm	["Habeas corpus", "Nemo iudex in causa sua", "In dubio pro reo", "Nullum crimen sine lege"]	Nemo iudex in causa sua	Le principe "nemo iudex in causa sua" (nul ne peut être juge dans sa propre affaire) est l'un des fondements de l'impartialité judiciaire. Présent dans le droit romain classique, il fut repris par les juristes médiévaux et reste un principe cardinal de tous les systèmes juridiques modernes.	t	2026-04-08 00:40:33.203598+00	\N
221	daily	medium	faction-romaine	\N	Face aux projectiles ennemis, les légionnaires avaient une réponse collective et géométrique. Ensemble ils devenaient une bête blindée que les flèches ne pouvaient percer.	Quel mot latin désignait la formation militaire romaine où les soldats se couvraient mutuellement de leurs boucliers, formant une carapace impénétrable ?	free	\N	Testudo	La testudo (tortue) était une formation défensive où les soldats des rangées extérieures tenaient leur bouclier devant et sur les côtés, tandis que ceux du centre les levaient au-dessus. Elle était particulièrement efficace lors des assauts de fortifications sous les projectiles.	t	2026-04-08 00:40:33.203598+00	\N
222	daily	medium	faction-romaine	\N	Des milliers d'hommes enchaînés choisirent de mourir libres plutôt que de vivre comme propriété. Leur chef devint une légende que Rome ne put effacer malgré six mille croix dressées sur la Voie Appienne.	Quelle révolte d'esclaves, menée entre 73 et 71 av. J.-C., fut l'une des plus graves crises intérieures de la République romaine tardive ?	qcm	["Révolte de Sicile de Eunous", "Révolte de Spartacus", "Révolte de Salvius Tryphon", "Révolte de Perpenna"]	Révolte de Spartacus	Spartacus, gladiateur thrace, lança sa révolte depuis Capoue en 73 av. J.-C. Son armée atteignit 120 000 hommes et infligea plusieurs défaites aux armées romaines. Crassus l'écrasa en 71 av. J.-C. et fit crucifier 6 000 survivants le long de la Via Appia de Capoue à Rome.	t	2026-04-08 00:40:33.203598+00	\N
223	daily	medium	faction-romaine	\N	Auguste avait appris de César : ne jamais nommer ouvertement ce que l'on est. En se proclamant simple citoyen parmi d'autres, il régna en fait comme aucun roi n'avait osé le faire.	Quel titre romain, signifiant littéralement "premier citoyen", fut adopté par Auguste pour voiler sa monarchie derrière une façade républicaine ?	qcm	["Imperator", "Pontifex Maximus", "Princeps", "Dictator perpetuo"]	Princeps	Auguste adopta le titre de princeps (premier citoyen) pour éviter de paraître roi, terme honni depuis l'expulsion de Tarquin. Le "Principat" qu'il inaugurea maintint les formes républicaines (Sénat, magistratures) tout en concentrant les pouvoirs militaire, civil et religieux en une seule main.	t	2026-04-08 00:40:33.203598+00	\N
224	daily	medium	faction-byzantine	\N	Un seul homme ordonna de rassembler mille ans de droit romain épars en une œuvre cohérente. Ce qu'il accomplit en quelques années allait gouverner l'Europe pendant des siècles.	Quel Empereur byzantin du VIe siècle fit compiler tout le droit romain en un seul corpus légal, encore étudié dans les facultés de droit ?	qcm	["Théodose II", "Justinien Ier", "Héraclius", "Basile II"]	Justinien Ier	Justinien Ier fit compiler le Corpus Juris Civilis entre 529 et 534, sous la direction du juriste Tribonien. Il comprend le Code (constitutions impériales), les Pandectes (jurisprudence), les Institutes (manuel) et les Novelles. C'est le fondement du droit civil continental européen.	t	2026-04-08 00:40:33.203598+00	\N
225	daily	medium	faction-byzantine	\N	Constantinople résista à des dizaines de sièges grâce à ses murailles et à un secret jalousement gardé. Ce secret brûlait sur l'eau elle-même, rendant la mer aussi dangereuse que la terre.	Quel nom portait l'arme secrète byzantine projetant un liquide enflammé impossible à éteindre par l'eau, utilisée notamment contre les flottes arabes ?	free	\N	Feu grégeois	Le feu grégeois (pyr Rhōmaïkon, "feu romain") fut utilisé dès 673 contre la flotte arabe lors du premier siège de Constantinople. Sa composition exacte reste inconnue mais incluait probablement de la chaux vive, du soufre et de la naphte. Il contribua à préserver l'Empire byzantin pendant des siècles.	t	2026-04-08 00:40:33.203598+00	\N
226	daily	medium	faction-byzantine	\N	Faut-il adorer les images de Dieu et des saints, ou est-ce une idolâtrie que même les Arabes et les Juifs moquent ? La question déchira l'Empire pendant un siècle.	Quelle crise iconoclaste byzantine, qui durait depuis 726, fut-elle définitivement résolue par le Deuxième Concile de Nicée en 787 ?	qcm	["La querelle des images", "L'iconoclasme", "La querelle monophysite", "La querelle nestorienne"]	L'iconoclasme	L'iconoclasme (destruction des images) fut lancé par Léon III en 726 et provoqua une crise majeure. Le Deuxième Concile de Nicée (787) rétablit le culte des icônes, distinguant la proskynèse (vénération) de la latreia (adoration due à Dieu seul). L'iconoclasme reprit de 814 à 842.	t	2026-04-08 00:40:33.203598+00	\N
227	daily	medium	faction-byzantine	\N	Deux frères en Christ qui s'étaient affrontés sur des mots pendant des siècles finirent par s'excommunier mutuellement. La rupture de 1054 n'a jamais été totalement réparée.	Quel Patriarche de Constantinople, excommunié par Rome en 1054, fut l'un des acteurs du Grand Schisme entre Chrétienté orientale et occidentale ?	qcm	["Michel Cérulaire", "Photius", "Jean IV le Jeûneur", "Ignace de Constantinople"]	Michel Cérulaire	Michel Cérulaire (Patriarche 1043-1058) fut excommunié par le légat papal Humbert de Moyenmoutier le 16 juillet 1054, date du Grand Schisme. Il répliqua en excommuniant les légats. Le différend portait sur le Filioque, l'autorité papale et des pratiques liturgiques divergentes.	t	2026-04-08 00:40:33.203598+00	\N
228	daily	medium	faction-byzantine	\N	Plus qu'un simple stade, c'était le cœur politique de Constantinople. Les factions colorées qui s'y affrontaient pouvaient renverser un Empereur ou en sauver un autre.	Comment s'appelait le principal hipodrome de Constantinople, adjacent au palais impérial, théâtre de courses de chars mais aussi de séditions populaires ?	free	\N	Hippodrome	L'Hippodrome de Constantinople (Ἱππόδρομος) fut agrandi par Constantin en 324. Long de 450m, il pouvait accueillir 100 000 spectateurs. Les factions des Bleus et des Verts y organisèrent la révolte de Nika en 532, qui faillit coûter le trône à Justinien avant que Bélisaire n'écrase les insurgés.	t	2026-04-08 00:40:33.203598+00	\N
229	daily	medium	faction-byzantine	\N	Un seul homme, avec peu de troupes mais un génie tactique exceptionnel, reconquit en quelques années ce que Rome avait perdu en un siècle. Justinien lui en voulut presque pour ça.	Quel général de Justinien reconquit l'Italie aux Ostrogoths et l'Afrique du Nord aux Vandales dans les années 530-540 ?	qcm	["Narsès", "Bélisaire", "Mundus", "Jean l'Arménien"]	Bélisaire	Bélisaire reconquit l'Afrique du Nord aux Vandales (533-534) et lança la reconquête de l'Italie (535-540), prenant Rome et Ravenne. Sa jalousie avec Narsès et la méfiance de Justinien limitèrent ses succès ultérieurs. Il reste l'un des plus grands généraux de l'Antiquité tardive.	t	2026-04-08 00:40:33.203598+00	\N
230	daily	medium	faction-byzantine	\N	Face aux invasions arabes et slaves qui menaçaient l'Empire de toutes parts, Constantinople réorganisa son territoire. Le nouveau système fusionna pouvoir civil et militaire pour réagir plus vite.	Quel terme byzantin désignait le système administratif divisant l'Empire en grandes provinces militaro-civiles dirigées par un stratège, mis en place au VIIe siècle ?	free	\N	Thème	Le système des thèmes (θέματα) fut développé sous Héraclius et ses successeurs au VIIe siècle. Chaque thème était gouverné par un stratège (général) qui détenait à la fois le commandement militaire et le gouvernement civil. Ce système décentralisé permit à Byzance de survivre aux invasions.	t	2026-04-08 00:40:33.203598+00	\N
231	daily	medium	faction-byzantine	\N	Une femme gouvernait au nom de son fils mineur quand elle trancha le débat qui avait déchiré l'Empire depuis un siècle. Son choix définit le visage de l'Église orthodoxe pour toujours.	Quelle impératrice byzantine du IXe siècle rétablit définitivement le culte des icônes en 843, événement célébré encore aujourd'hui comme le "Triomphe de l'Orthodoxie" ?	qcm	["Théodora (femme de Théophile)", "Irène d'Athènes", "Zoé Porphyrogénète", "Eudocie Makrembolitissa"]	Théodora (femme de Théophile)	Théodora, régente pour son fils Michel III après la mort de Théophile (842), convoqua un synode qui rétablit le culte des icônes le 11 mars 843 (premier dimanche de Carême). Ce "Triomphe de l'Orthodoxie" est encore commémoré chaque année dans les Églises orthodoxes.	t	2026-04-08 00:40:33.203598+00	\N
232	daily	medium	faction-byzantine	\N	Les guerriers de la Croix, partis pour libérer Jérusalem, se retournèrent contre leurs frères chrétiens. Ce qu'ils firent à la Reine des Villes ne fut jamais pardonné.	Quel siège de 1204 vit des Croisés catholiques saccager Constantinople, divisant l'Empire byzantin en États successeurs et provoquant un traumatisme durable dans la chrétienté orientale ?	qcm	["Quatrième Croisade", "Troisième Croisade", "Croisade des Albigeois", "Deuxième Croisade"]	Quatrième Croisade	La Quatrième Croisade (1202-1204), détournée par Venise, aboutit au sac de Constantinople du 12 avril 1204. Les croisés pillèrent l'une des villes les plus riches du monde et fondèrent l'Empire latin. Les trésors volés, dont les Chevaux de Saint-Marc, ornent encore Venise.	t	2026-04-08 00:40:33.203598+00	\N
233	daily	medium	faction-byzantine	\N	L'Empire byzantin avait trouvé une solution paradoxale au problème des ambitions dynastiques : confier le pouvoir à des hommes qui ne pouvaient pas fonder de lignées.	Quel type de fonctionnaire byzantin, castré dès l'enfance ou la jeunesse, occupait souvent les plus hautes charges de l'État et de la cour impériale ?	free	\N	Eunuque	Les eunuques (εὐνοῦχοι) occupèrent dans l'Empire byzantin des postes de confiance au palais (parakoimomenos, protovestiaire) et dans l'Église. Leur castration les excluant de la succession impériale, ils étaient considérés comme loyaux par nature. Narsès, le conquérant de l'Italie, était eunuque.	t	2026-04-08 00:40:33.203598+00	\N
234	daily	medium	faction-byzantine	\N	Certaines victoires laissent des traces dans les mémoires pour des siècles. Quand les prisonniers aveuglés rentrèrent chez eux, leur tsar mourut de saisissement.	Quel Empereur byzantin du Xe siècle, dit le "Tueur de Bulgares" (Boulgaroktonos), fit crever les yeux de 15 000 prisonniers bulgares après la bataille de Kleidion en 1014 ?	qcm	["Nicéphore Phocas", "Jean Tzimiskès", "Basile II", "Constantin VIII"]	Basile II	Basile II (976-1025) imposa la puissance byzantine dans les Balkans et fit crever les yeux de 15 000 prisonniers à Kleidion (1014), laissant un œil à chaque centième pour guider les autres. Le tsar Samuel, en voyant ses guerriers revenir ainsi, mourut d'une apoplexie deux jours après.	t	2026-04-08 00:40:33.203598+00	\N
235	daily	medium	faction-byzantine	\N	Une seule lettre de différence dans la formulation théologique put diviser des communautés chrétiennes pour des siècles. L'Égypte, la Syrie et l'Arménie choisirent leur lecture — et restèrent séparées.	Quel schéma doctrinal, affirmant que le Christ n'a qu'une seule nature (divine), causa une rupture durable entre Constantinople et les Églises d'Égypte et d'Éthiopie ?	free	\N	Monophysisme	Le monophysisme (du grec monos, seul, et physis, nature) soutient que le Christ a une seule nature divine après l'Incarnation. Condamné au Concile de Chalcédoine (451), il fut adopté par les Églises copte (Égypte), éthiopienne, arménienne et syriaque, qui se séparèrent de Constantinople.	t	2026-04-08 00:40:33.203598+00	\N
236	daily	medium	faction-byzantine	\N	En un seul après-midi, le destin d'une région fut scellé pour mille ans. L'Anatolie, cœur nourricier de l'Empire, allait lentement changer de visage, de langue et de foi.	Quelle bataille de 1071 vit la défaite décisive de Byzance face aux Seldjoukides, ouvrant l'Anatolie à la colonisation turque ?	qcm	["Bataille de Manzikert", "Bataille de Myriokephalon", "Bataille de Antioche", "Bataille de Nicée"]	Bataille de Manzikert	À Manzikert (26 août 1071), l'Empereur Romain IV Diogène fut capturé par le Sultan Alp Arslan. Cette défaite ouvrit l'Anatolie centrale aux migrations turques seldjoukides, réduisant progressivement la base démographique et économique de Byzance. Elle est souvent vue comme le début du déclin irréversible de l'Empire.	t	2026-04-08 00:40:33.203598+00	\N
237	daily	hard	faction-celtique	\N	En 279 av. J.-C., une armée de guerriers celtes envahit la Macédoine, puis la Grèce, et pilla Delphes — le centre du monde grec. Mais leur chef fut tué lors de la retraite, et les sources grecques brodèrent une légende sur leur défaite.	Quel chef gaulois mena le raid sur Delphes en 279 av. J.-C. ?	qcm	["Brenn", "Vercingétorix", "Ambiorix", "Dumnorix"]	Brenn	Brenn (ou Brennos) conduisit une coalition de tribus celtes jusqu'à Delphes, pillant le sanctuaire apollinien. Les sources grecques (Pausanias, Diodore) affirment que le dieu lui-même repoussa les Gaulois par des prodiges, mais la version historique montre simplement une retraite après la mort de Brenn, blessé. Il ne faut pas le confondre avec un autre Brenn qui avait pris Rome en 390 av. J.-C.	t	2026-04-08 00:40:42.114118+00	\N
238	daily	hard	faction-celtique	\N	Les Celtes de l'âge du fer ne vivaient pas dans des huttes misérables : certains de leurs oppida couvraient des centaines d'hectares et produisaient des biens de luxe exportés jusqu'aux rives de la Méditerranée.	Quel oppidum arverne, fouillé depuis le XIXe siècle, est considéré comme la capitale de Vercingétorix ?	qcm	["Alésia", "Gergovie", "Bibracte", "Uxellodunum"]	Gergovie	Gergovie (Gergovia) était la capitale des Arvernes, sur le plateau de Merdogne près de Clermont-Ferrand. C'est là que Vercingétorix infligea à César sa seule grande défaite tactique en 52 av. J.-C. Alésia fut sa dernière bataille. Les fouilles du XIXe et du XXe siècle ont mis au jour les remparts et des structures de l'oppidum.	t	2026-04-08 00:40:42.114118+00	\N
239	daily	hard	faction-celtique	\N	Strabon décrit une île au large des côtes armoricaines où des femmes aux pouvoirs surnaturels vivaient isolées des hommes, tisseraient des vents et soignaient les blessés de guerre. Certains y voient la survivance d'un culte réel.	Selon Strabon, quel peuple insulaire aux rites mystérieux vivait sur une île proche de l'embouchure de la Loire ?	qcm	["Les Namnètes", "Les Samnites", "Les femmes de Sena", "Les Vénètes d'Armorique"]	Les femmes de Sena	Strabon (Géographie, IV, 4) mentionne l'île de Sena (probablement l'Île de Sein) habitée par des femmes gauloises consacrées à un dieu — peut-être un écho d'un collège de prêtresses celtiques. Elles auraient le pouvoir de déchaîner tempêtes et maladies, et d'accueillir les héros mourants. Ce passage rare est l'un des seuls témoignages grecs d'un sacerdoce féminin celtique organisé.	t	2026-04-08 00:40:42.114118+00	\N
240	daily	hard	faction-celtique	\N	L'un des trésors archéologiques majeurs de l'Europe celtique est un chaudron en argent repoussé, découvert en 1891 dans un tourbière danoise. Ses plaques intérieures représentent des divinités, des serpents à cornes et des sacrifices.	Comment appelle-t-on ce chaudron en argent de l'âge du fer, trouvé à Gundestrup ?	qcm	["Le chaudron de Gundestrup", "Le chaudron de Sutton Hoo", "Le vase de Vix", "Le cratère de Hochdorf"]	Le chaudron de Gundestrup	Le chaudron de Gundestrup (Ier s. av. J.-C.) est le plus grand objet en argent de l'âge du fer européen. Il représente des scènes mythologiques celtiques, dont le célèbre panneau du Cernunnos aux bois de cerf entouré d'animaux. Son origine exacte est débattue : fabriqué peut-être en Thrace ou dans les Balkans, il représente néanmoins une iconographie clairement celtique.	t	2026-04-08 00:40:42.114118+00	\N
241	daily	hard	faction-celtique	\N	Parmi les dieux gaulois, l'un porte un maillet et un tonneau — symboles de fécondité et de l'autre monde. César l'identifie maladroitement à Dis Pater, le dieu des morts romains.	Quel dieu gaulois au maillet était assimilé par César à Dis Pater ?	qcm	["Esus", "Sucellus", "Teutates", "Épona"]	Sucellus	Sucellus (« le bon frappeur ») est représenté avec un maillet à long manche et un tonneau ou une patère. Il est associé à la forêt, à la bière, à la prospérité et aux morts. César (Guerre des Gaules, VI, 18) mentionne que les Gaulois se prétendent descendants de Dis Pater, ce que les épigraphistes modernes associent à Sucellus ou à d'autres divinités chtoniennes gauloises. Son épouse est Nantosvelta.	t	2026-04-08 00:40:42.114118+00	\N
242	daily	hard	faction-celtique	\N	La tombe d'une femme de haut rang découverte à Vix (Côte-d'Or) en 1953 a bouleversé la compréhension de la société hallstattienne. Elle renfermait l'un des plus grands vases de bronze de l'Antiquité.	Quelle est la contenance approximative du cratère de bronze retrouvé dans la tombe de Vix ?	qcm	["208 litres", "84 litres", "500 litres", "1 200 litres"]	208 litres	Le cratère de Vix (vers 500 av. J.-C.) mesure 1,64 m de hauteur et peut contenir 1 100 litres selon certaines estimations, mais sa capacité réelle estimée lors de la fouille était de 208 litres de liquide. C'est le plus grand vase métallique connu de l'Antiquité. Fabriqué en Grande-Grèce (Laconie), il témoigne des réseaux d'échange entre élites celtiques et Méditerranée.	t	2026-04-08 00:40:42.114118+00	\N
243	daily	hard	faction-celtique	\N	Les druides gaulois refusaient de coucher par écrit leurs enseignements sacrés — pourtant ils utilisaient l'alphabet grec pour leurs transactions commerciales, selon César lui-même.	Combien d'années César indique-t-il que les jeunes druides passaient à mémoriser leur enseignement oral ?	qcm	["6 ans", "20 ans", "12 ans", "40 ans"]	20 ans	César (Guerre des Gaules, VI, 14) précise que certains disciples passent jusqu'à vingt ans à apprendre par cœur les vers sacrés des druides. Ce refus de l'écriture était délibéré : il préservait le savoir de la diffusion profane et forçait une transmission vivante de maître à disciple. César note qu'ils utilisaient l'alphabet grec pour leurs lettres et comptes ordinaires.	t	2026-04-08 00:40:42.114118+00	\N
244	daily	hard	faction-celtique	\N	Le calendrier de Coligny, découvert en 1897 dans l'Ain, est la plus longue inscription gauloise connue. C'est un calendrier lunaire-solaire gravé sur bronze, datant du IIe siècle ap. J.-C.	Combien de mois le calendrier gaulois de Coligny comptait-il dans son cycle complet de 5 ans ?	qcm	["60 mois", "62 mois", "48 mois", "70 mois"]	62 mois	Le calendrier de Coligny articule un cycle de 5 ans (quinquennal) comprenant 62 mois lunaires, dont 2 mois intercalaires pour synchroniser le calendrier lunaire avec l'année solaire. Chaque mois est classé en MAT (favorable) ou ANM (défavorable). C'est la preuve que les druides avaient développé un système astronomique sophistiqué, bien avant que les Romains ne le leur attribuent.	t	2026-04-08 00:40:42.114118+00	\N
245	daily	hard	faction-celtique	\N	L'armée gauloise qui écrasa les Romains au lac Trébie en 218 av. J.-C. combattait sous les ordres d'Hannibal — mais des Gaulois cisalpins avaient déjà battu Rome seuls, un siècle et demi plus tôt.	Lors de quelle bataille les Gaulois Sénons mirent-ils Rome à sac, vers 390 av. J.-C. ?	qcm	["Bataille d'Allia", "Bataille de Cannes", "Bataille de Trasimène", "Bataille de Sentinum"]	Bataille d'Allia	La bataille de l'Allia (18 juillet 390 av. J.-C., date maudite dans le calendrier romain) vit les Sénons de Brenn écraser l'armée romaine sur les rives du fleuve Allia. Rome fut ensuite pillée pendant plusieurs mois — seul le Capitole résista. Tite-Live et Polybe décrivent l'événement comme un traumatisme fondateur. Les Romains qualifièrent le 18 juillet de dies nefastus à perpétuité.	t	2026-04-08 00:40:42.114118+00	\N
246	daily	hard	faction-celtique	\N	Les Celtes insulaires (Irlande, Galles) ont conservé une littérature mythologique orale transmise à l'écrit par des moines chrétiens à partir du VIIe siècle. Le cycle ulstérien en est le cœur.	Quel héros irlandais du cycle ulstérien est connu pour avoir tué le chien du forgeron Culann étant enfant, et pris sa place comme gardien ?	qcm	["Finn Mac Cumhaill", "Cú Chulainn", "Conall Cernach", "Lugh Lamhfhada"]	Cú Chulainn	Cú Chulainn (« le chien de Culann ») tira son nom de l'exploit qu'il accomplit enfant : ayant tué le chien de garde du forgeron Culann d'un coup de sliotar, il proposa de prendre la place de l'animal jusqu'à ce qu'un remplaçant soit élevé. Son vrai nom était Sétanta. Il est le héros central de la Táin Bó Cúailnge, l'épopée irlandaise comparable à l'Iliade.	t	2026-04-08 00:40:42.114118+00	\N
247	daily	hard	faction-celtique	\N	Parmi les objets celtiques les plus mystérieux figurent de petites roues à quatre ou six rayons en or ou en bronze, que l'on retrouve dans des contextes cultuels à travers toute l'Europe.	À quelle divinité gauloise les roues à rayons sont-elles principalement associées selon l'épigraphie et l'iconographie ?	qcm	["Taranis", "Lugh", "Ogmios", "Cernunnos"]	Taranis	Taranis (« le tonnant ») est le dieu gaulois du tonnerre, identifié parfois à Jupiter par interpretatio romana. La roue à rayons est son attribut principal — symbole solaire mais aussi sonore (le grondement du tonnerre évoquant une roue qui roule). Des roues votive en bronze miniatures ont été retrouvées dans des puits rituels et des dépôts de l'âge du fer dans toute la Gaule et en Britannie.	t	2026-04-08 00:40:42.114118+00	\N
248	daily	hard	faction-celtique	\N	Le massacre de l'île de Môn (Anglesey) en 60 ap. J.-C. est l'un des épisodes les plus dramatiques de la conquête romaine de la Bretagne. Tacite en livre un témoignage troublant.	Quel général romain détruisit le dernier grand sanctuaire druidique de l'île de Môn (Anglesey) en 60 ap. J.-C. ?	qcm	["Agricola", "Suetonius Paulinus", "Ostorius Scapula", "Vespasien"]	Suetonius Paulinus	Suetonius Paulinus mena ses légions jusqu'en Anglesey (Môn), dernier refuge des druides britanniques, et fit abattre les bois sacrés. Tacite (Annales, XIV, 30) décrit les druides et les femmes en noir brandissant des torches, les légionnaires paralysés de stupeur avant de reprendre leurs sens. La révolte de Boadicée éclata au même moment, forçant Paulinus à rebrousser chemin.	t	2026-04-08 00:40:42.114118+00	\N
249	daily	hard	faction-celtique	\N	La pratique du torque — ce collier d'or torsadé — est l'un des marqueurs les plus distinctifs de l'aristocratie celtique. Il apparaît aussi sur des représentations divines, porté non par des humains.	Le dieu Cernunnos est souvent représenté portant un torque et en tenant un autre. Quel animal tient-il généralement dans l'autre main sur les représentations les plus célèbres ?	qcm	["Un loup", "Un sanglier", "Un serpent à tête de bélier", "Un cerf"]	Un serpent à tête de bélier	Sur le chaudron de Gundestrup et d'autres représentations, Cernunnos (dieu aux bois de cerf) tient un torque d'une main et un serpent à tête de bélier de l'autre. Ce reptile cornu est un symbole de fertilité et de l'inframonde celtique, sans équivalent dans les mythologies méditerranéennes. Sa présence aux côtés de Cernunnos renforce le caractère chthonien de cette divinité.	t	2026-04-08 00:40:42.114118+00	\N
250	daily	hard	faction-celtique	\N	En 225 av. J.-C., une coalition de tribus gauloises traversa les Alpes et envahit l'Italie du Nord. Les Romains les arrêtèrent dans un étau entre deux armées consulaires.	À quelle bataille les Romains écrasèrent-ils une grande coalition gauloise en 225 av. J.-C., dans ce qui est aujourd'hui la Toscane ?	qcm	["Bataille de Télamon", "Bataille de Clastidium", "Bataille de Sentinum", "Bataille du Tessin"]	Bataille de Télamon	La bataille de Télamon (Talamone, Toscane) en 225 av. J.-C. vit les armées consulaires de Lucius Aemilius Papus et de Caius Atilius Regulus prendre en tenaille une coalition de Gaesates (mercenaires celtes transalpins), d'Insubres et de Boïens. Polybe (II, 27-31) décrit les Gaesates combattant nus — leur nudité rituelle étant à la fois un geste sacré et une démonstration de bravoure. 40 000 Gaulois furent tués.	t	2026-04-08 00:40:42.114118+00	\N
251	daily	hard	faction-celtique	\N	L'archéologie a mis au jour de nombreux sanctuaires gaulois appelés "enclos cultuels" — des espaces quadrangulaires clos où l'on déposait des offrandes, parfois des restes humains. Les Romains les désignaient par un terme latin.	Comment appelle-t-on en latin ces enclos cultuels gaulois quadrangulaires, souvent trouvés en fouille ?	qcm	["Fanum", "Templum", "Mundus", "Lucus"]	Fanum	Le fanum (pl. fana) est le terme latin désignant les sanctuaires indigènes gaulois — souvent de plan carré avec une cella centrale entourée d'une galerie. Ils perdurent et s'adaptent à l'époque gallo-romaine. On les distingue des temples romains classiques (templum) par leur plan et leur contexte. Des milliers ont été fouillés à travers la Gaule, certains révélant des dépôts d'armes, d'ossements animaux et d'offrandes.	t	2026-04-08 00:40:42.114118+00	\N
252	daily	hard	faction-celtique	\N	Ammien Marcellin, historien du IVe siècle, décrit les Gaulois comme de grands orateurs mais aussi comme des mangeurs voraces, leur donnant un trait culturel précis qui les distinguait des Romains.	Selon Ammien Marcellin, quel comportement à table était caractéristique des Gaulois nobles et étrangeait les Romains ?	qcm	["Manger debout", "Partager leur repas avec des inconnus", "Se battre pour la meilleure portion", "Boire de la bière plutôt que du vin"]	Se battre pour la meilleure portion	Ammien Marcellin (Res Gestae, XV, 12) note que lors des banquets, les Gaulois se disputaient parfois la portion d'honneur (la cuisse du porc rôti) au point d'en venir aux mains. Cette coutume — la "portion du héros" ou curadmír — est confirmée par les sources irlandaises médiévales : le meilleur morceau revenait de droit au plus brave, et la contester était une déclaration de supériorité.	t	2026-04-08 00:40:42.114118+00	\N
253	daily	hard	faction-celtique	\N	L'or gaulois ne venait pas que du pillage. Les Gaulois exploitaient des mines et des rivières aurifères, notamment dans le Massif Central et les Pyrénées. Certaines tribus en tiraient une richesse considérable.	Quelle tribu gauloise du sud de la Gaule était particulièrement renommée pour ses mines d'or et sa richesse métallurgique, selon Strabon ?	qcm	["Les Rutènes", "Les Volques Tectosages", "Les Bituriges", "Les Lingons"]	Les Volques Tectosages	Strabon (Géographie, IV, 1) décrit les Volques Tectosages (autour de Toulouse/Tolosa) comme détenteurs d'immenses richesses en or, en partie issues de pillages (dont le trésor de Delphes selon la légende), en partie de mines locales. Le "trésor de Toulouse" (Aurum Tolosanum), saisi par le consul Caepio en 106 av. J.-C. et mystérieusement disparu, est entré dans la légende comme l'or maudit des Tectosages.	t	2026-04-08 00:40:42.114118+00	\N
254	daily	hard	faction-nordique	\N	L'Edda poétique et l'Edda en prose contiennent les deux sources principales de la mythologie nordique — mais elles furent rédigées des siècles après la christianisation, par des lettrés islandais qui cherchaient à sauver une mémoire.	Qui rédigea l'Edda en prose vers 1220, synthétisant la mythologie nordique pour les poètes skaldiques ?	qcm	["Saxo Grammaticus", "Snorri Sturluson", "Adam de Brême", "Ari Þorgilsson"]	Snorri Sturluson	Snorri Sturluson (1179-1241), chef politique islandais et poète, rédigea l'Edda en prose (Prose Edda) vers 1220 comme manuel de poésie skaldique — incluant la Gylfaginning (tromperie de Gylfi), récit de la mythologie nordique. Saxo Grammaticus rédigit les Gesta Danorum au même siècle, mais en latin et avec une vision différente. Sans Snorri, une grande partie de la mythologie nordique aurait été perdue.	t	2026-04-08 00:40:42.114118+00	\N
255	daily	hard	faction-nordique	\N	Les Vikings ne se contentaient pas de razzier : ils fondèrent des États durables. L'un d'eux créa la première assemblée parlementaire d'Europe occidentale, sur une île isolée au milieu de l'Atlantique Nord.	En quelle année fut fondé l'Althing islandais, considéré comme l'un des plus anciens parlements du monde ?	qcm	["930", "870", "1000", "1066"]	930	L'Althing (Alþingi) fut fondé en 930 à Þingvellir (les Plaines du Parlement), dans une fissure tectonique entre les plaques eurasienne et nord-américaine. C'était une assemblée annuelle de chefs locaux (goðar) qui légiférait et rendait la justice. L'Islande n'avait pas de roi — l'Althing était sa structure politique unique. En l'an 1000, c'est l'Althing qui vota la christianisation de l'île.	t	2026-04-08 00:40:42.114118+00	\N
256	daily	hard	faction-nordique	\N	Dans la cosmologie nordique, le monde n'est pas sphérique mais plat, suspendu dans le vide cosmique. Les neuf mondes sont organisés autour d'un axe vertical dont la nature exacte est souvent mal rappelée.	Yggdrasil est l'arbre cosmique nordique. Quelle essence d'arbre est-il selon les textes de l'Edda ?	qcm	["Un chêne", "Un frêne", "Un if", "Un orme"]	Un frêne	Yggdrasil est explicitement décrit comme un frêne (askr) dans l'Edda poétique (Völuspá, Grímnismál). L'association du frêne avec la magie et la connaissance est répandue dans les cultures germaniques. Le nom Yggdrasil signifie probablement "le destrier d'Ygg" (Ygg étant un surnom d'Odin) — en référence à la pendaison d'Odin sur l'arbre pour obtenir les runes. C'est une confusion fréquente de l'associer au chêne (symbole des Celtes).	t	2026-04-08 00:40:42.114118+00	\N
257	daily	hard	faction-nordique	\N	La ruée vers l'est des Vikings — les Varègues — est moins connue que leurs raids à l'ouest. Ils descendirent les fleuves russes jusqu'à la mer Noire et Caspienne, fondant des comptoirs qui devinrent des villes.	Quel prince varègue est traditionnellement considéré comme le fondateur de la Rus' de Kiev, vers 882 ?	qcm	["Rurik", "Oleg", "Sviatoslav", "Igor"]	Oleg	Selon la Chronique des temps passés (Povest' vremennykh let), c'est Oleg (Helgi en norrois) qui s'empara de Kiev vers 882, en tuant Askold et Dir, et en fit sa capitale, déclarant : "Que Kiev soit la mère des villes russes." Rurik fonda Novgorod (~862) mais mourut avant Kiev. Oleg étendit le territoire jusqu'à Constantinople, contre laquelle il mena deux expéditions et obtint des traités commerciaux favorables en 907 et 911.	t	2026-04-08 00:40:42.114118+00	\N
258	daily	hard	faction-nordique	\N	La poésie skaldique est l'une des formes littéraires les plus complexes de l'histoire européenne — ses kenningar (périphrases poétiques) transforment chaque concept en une énigme élaborée.	Dans la poésie skaldique nordique, que désigne la kenning "sang de Kvasir" ou "miel de Kvasir" ?	qcm	["L'hydromel de la poésie", "Le sang versé au combat", "La bière sacrée d'Odin", "Le miel de l'immortalité"]	L'hydromel de la poésie	Selon le mythe nordique, Kvasir fut créé du crachat mêlé des Ases et des Vanes lors de leur traité de paix. Les nains Fjalarr et Galarr le tuèrent et mélangèrent son sang avec du miel pour créer le Mead of Poetry (hydromel poétique), qui confère le don de poésie et de sagesse à qui le boit. "Sang de Kvasir" est donc une kenning classique pour désigner ce breuvage — et par extension, la poésie elle-même.	t	2026-04-08 00:40:42.114118+00	\N
259	daily	hard	faction-nordique	\N	Les Vikings en Amérique du Nord ne sont pas une légende : ils y établirent un campement archéologiquement attesté, cinq siècles avant Christophe Colomb. Son nom norrois signifie "Anse aux Méduses".	Dans quelle province canadienne actuelle se trouve le site archéologique viking de L'Anse aux Meadows, inscrit à l'UNESCO ?	qcm	["Nouvelle-Écosse", "Terre-Neuve", "Labrador", "Île-du-Prince-Édouard"]	Terre-Neuve	L'Anse aux Meadows, à la pointe nord de Terre-Neuve, fut découvert en 1960 par Helge et Anne Ingstad. Les fouilles révélèrent des vestiges norrois datés autour de l'an 1000, correspondant aux sagas de Leif Erikson. C'est le seul site viking authentifié en Amérique du Nord. Les Norrois y fabriquaient du métal — preuve qu'il ne s'agissait pas d'un simple camp de pêche mais d'un établissement plus ambitieux.	t	2026-04-08 00:40:42.114118+00	\N
260	daily	hard	faction-nordique	\N	Le rituel funéraire nordique le plus élaboré n'était pas toujours la crémation sur bateau. L'archéologie révèle une grande diversité de pratiques, dont certaines inhumations de femmes de haut rang avec du matériel exceptionnel.	La tombe d'Oseberg (Norvège, 834 ap. J.-C.) contenait deux femmes et un navire intact. Quelle hypothèse sur l'identité de la principale défunte est aujourd'hui la plus acceptée ?	qcm	["Une reine consort", "Une völva (voyante-chamane)", "Une valkyrie divinisée", "Une marchande de luxe"]	Une völva (voyante-chamane)	La tombe d'Oseberg (fouillée en 1904) contenait un navire de 22 mètres, deux femmes (l'une âgée, l'autre jeune), et une richesse matérielle extraordinaire. La femme plus âgée présente des signes de haute noblesse ou de statut sacerdotal. Le contenu — seau de cannabis, plantes hallucinogènes, bâton de voyante — a conduit Neil Price et d'autres chercheurs à identifier la défunte principale comme une völva, chamane de haut rang dans la société nordique.	t	2026-04-08 00:40:42.114118+00	\N
261	daily	hard	faction-nordique	\N	Ragnarök n'est pas simplement une "fin du monde" — c'est un cycle. Les textes nordiques prévoient ce qui advient après la destruction, et certains dieux survivent.	Lequel de ces dieux survit à Ragnarök selon l'Edda poétique ?	qcm	["Thor", "Odin", "Víðarr", "Tyr"]	Víðarr	Víðarr (le silencieux) survit à Ragnarök en vengeant la mort d'Odin : il tue le loup Fenrir en lui perçant le palais avec sa chaussure renforcée (symbole des rognures de cuir données par les cordonniers à Víðarr). Baldr, revenu de Hel, et Höðr survivent également. Thor et Odin meurent — le premier tué par le serpent Jörmungandr, le second avalé par Fenrir. Tyr et Freyr tombent aussi lors de la bataille finale.	t	2026-04-08 00:40:42.114118+00	\N
262	daily	hard	faction-nordique	\N	La grande armée viking (Micel Here) qui débarqua en Angleterre en 865 ne venait pas piller et repartir — elle cherchait à conquérir. En quelques années, elle mit à bas trois royaumes anglo-saxons.	Qui était le chef légendaire de cette Grande Armée Danoise de 865, fils de Ragnar selon la tradition ?	qcm	["Sigurd Serpent-dans-l'Œil", "Ivar le Désossé", "Halfdan Ragnarsson", "Björn Côte-de-Fer"]	Ivar le Désossé	Ivar le Désossé (Ívarr hinn Beinlausi) est mentionné dans les sagas comme le stratège principal de la Grande Armée Danoise. Son surnom énigmatique ("désossé") pourrait désigner une maladie osseuse, une souplesse exceptionnelle, ou être une métaphore poétique de sa cruauté. Il fut l'un des architectes de la chute de Northumbrie (867) et fit exécuter le roi Ælla par le rituel du "l'aigle de sang" selon les sagas. L'historicité de certains éléments reste débattue.	t	2026-04-08 00:40:42.114118+00	\N
263	daily	hard	faction-nordique	\N	Les runes ne sont pas qu'un alphabet — elles sont une cosmologie. Chaque rune porte un nom, un poème associé, et des usages magiques codifiés. Mais les systèmes runiques diffèrent selon les époques et les régions.	Combien de runes compte le Futhark ancien (Elder Futhark), utilisé jusqu'au VIIIe siècle environ ?	qcm	["16", "24", "33", "18"]	24	Le Futhark ancien (Elder Futhark) comprend 24 runes, réparties en trois groupes de 8 (les ættir). C'est le système runique le plus répandu en Europe du Nord entre le IIe et le VIIIe siècle, attesté sur des objets allant de la Scandinavie à l'Europe centrale. Au VIIIe siècle, il fut réduit au Younger Futhark (16 runes) en Scandinavie — paradoxalement, une simplification qui coïncide avec l'âge des Vikings. L'Anglo-Saxon Futhorc étendit le système à 28-33 runes.	t	2026-04-08 00:40:42.114118+00	\N
264	daily	hard	faction-nordique	\N	Le siège de Paris par les Vikings en 885-886 est l'un des événements fondateurs de la France. La résistance de la ville contre une flotte immense décida du sort de la Francie occidentale.	Quel comte carolingien défendit Paris contre le siège viking de 885-886 et devint une légende de son vivant ?	qcm	["Robert le Fort", "Eudes de Paris", "Charles le Gros", "Hugues l'Abbé"]	Eudes de Paris	Eudes (Odo), comte de Paris, mena la défense héroïque de la ville contre la flotte de Sigfried et Rollo pendant plus d'un an. Quand Charles le Gros (roi carolingien) arriva avec son armée et préféra payer les Vikings plutôt que les combattre, sa réputation s'effondra. Eudes devint tellement populaire qu'il fut élu roi de Francie occidentale en 888 — premier roi non carolingien. Sa famille donnera plus tard les Capétiens.	t	2026-04-08 00:40:42.114118+00	\N
265	daily	hard	faction-nordique	\N	Harald à la Belle Chevelure n'unifia pas la Norvège par la diplomatie — mais par la conquête. Sa victoire lors d'une bataille navale décisive scella l'unification du pays vers 872.	Lors de quelle bataille navale Harald Hårfagre unifia-t-il la Norvège vers 872 ?	qcm	["Bataille de Hafrsfjord", "Bataille de Stiklestad", "Bataille de Svolder", "Bataille de Bråvalla"]	Bataille de Hafrsfjord	La bataille de Hafrsfjord (près de Stavanger) vers 872 opposa Harald Hårfagre à une coalition de rois régionaux norvégiens. Sa victoire lui permit de contrôler l'ensemble du pays. Selon Snorri Sturluson, Harald avait promis de ne pas couper ses cheveux avant d'avoir unifié la Norvège — d'où son surnom. L'émigration massive vers l'Islande qui suivit fut partiellement provoquée par le refus de nombreux chefs de se soumettre à son autorité.	t	2026-04-08 00:40:42.114118+00	\N
266	daily	hard	faction-nordique	\N	La coutume nordique du "holmgang" est souvent romanisée comme un simple duel d'honneur. Mais ses règles codifiées en faisaient une procédure juridique précise, avec des conséquences légales définies.	Qu'advenait-il légalement à un homme qui refusait un holmgang (duel) en Scandinavie médiévale ?	qcm	["Il était banni", "Il perdait sa réputation mais rien de juridique", "Il était déclaré niding (lâche hors-la-loi)", "Il payait une amende au roi"]	Il était déclaré niding (lâche hors-la-loi)	Refuser un holmgang était une honte absolue — on était déclaré niding (níðingr), terme désignant le pire des lâches, un homme sans honneur. Le statut de niding impliquait une mise hors-la-loi sociale : on pouvait être tué sans conséquences juridiques, on perdait ses droits et sa propriété, et aucun homme d'honneur ne vous adressait plus la parole. Le holmgang avait lieu sur une peau de bête délimitant le terrain, avec des règles strictes sur les coups portés.	t	2026-04-08 00:40:42.114118+00	\N
267	daily	hard	faction-nordique	\N	L'archéologie nordique a mis au jour une figure de proue de bateau exceptionnelle, sculptée avec une sophistication qui stupéfia les historiens de l'art. Elle fut découverte dans un marais irlandais au XIXe siècle.	Quel trésor archéologique viking, découvert à Killaloe en Irlande en 1840, représente une tête de dragon en bois sculpté ?	qcm	["La tête de Borre", "La tête de Ringerike", "La figure de Scheibe", "La figure de Lough Derg"]	La figure de Lough Derg	La figure de proue de Lough Derg (Killaloe, Irlande), découverte en 1840 dans le lac, est l'un des rares exemples de sculpture sur bois viking conservée. Elle date probablement du Xe siècle et représente une tête zoomorphe finement décorée de style Ringerike. Les bois celtes conservent les sculptures organiques là où d'autres environnements les détruisent. Ce type de trouvaille permet de comprendre l'art décoratif nordique en dehors des pierres runiques.	t	2026-04-08 00:40:42.114118+00	\N
268	daily	hard	faction-nordique	\N	La ville de Hedeby (Haithabu), sur le territoire du Danemark actuel, était l'une des plus grandes villes du monde viking — un carrefour commercial entre mer du Nord et Baltique, entre Francie et Scandinavie.	Quelle armée mit définitivement fin à la ville de Hedeby en la brûlant vers 1050 ?	qcm	["L'armée norvégienne de Harald Hardrada", "Les Slaves Obodrites", "L'armée des Croisés", "Les Saxons de l'Empire"]	L'armée norvégienne de Harald Hardrada	Hedeby fut pillée et brûlée par Harald Hardrada (Harald III de Norvège) vers 1049-1050, lors d'un conflit avec le roi danois Sven Estridsen. La ville, déjà affaiblie par des raids précédents (notamment des Obodrites vers 983 et un incendie de 1000), ne se releva pas. La population migra vers Schleswig, de l'autre côté du fjord. Les fouilles d'Hedeby ont mis au jour des artefacts de toute l'Europe : soie de Byzance, épices d'Orient, verre rhénan.	t	2026-04-08 00:40:42.114118+00	\N
269	daily	hard	faction-nordique	\N	Odin n'est pas seulement le dieu de la guerre — c'est le dieu de la connaissance obtenue par le sacrifice de soi. Il pendit neuf nuits sur Yggdrasil pour acquérir les runes, et sacrifia un œil pour boire à la source de Mimir.	Quel nom porte la source où Odin sacrifia un œil pour obtenir la sagesse, selon l'Edda ?	qcm	["La source d'Urðr", "La source de Mimir", "La source de Hvergelmir", "La fontaine de Gjöll"]	La source de Mimir	La source de Mimir (Mímisbrunnr) se trouve sous l'une des racines d'Yggdrasil, du côté des Géants du Givre. Mimir en est le gardien — une figure de sagesse primordiale, parfois décrite comme un géant, parfois comme un être distinct. Odin lui offrit son œil en gage pour obtenir le droit de boire. La source d'Urðr (Urðarbrunnr) est celle des Nornes, sous la racine du côté des Ases. Hvergelmir est la source originelle de tous les fleuves, sous la racine du côté de Niflheim.	t	2026-04-08 00:40:42.114118+00	\N
270	daily	hard	faction-romaine	\N	La réforme militaire qui transforma l'armée romaine d'une milice de citoyens propriétaires en une armée professionnelle des pauvres fut l'une des plus lourdes de conséquences de toute l'histoire de Rome.	Quel général romain reforma l'armée vers 107 av. J.-C. en ouvrant le service aux citoyens sans propriété (capite censi) ?	qcm	["Scipion l'Africain", "Caius Marius", "Sylla", "Pompée"]	Caius Marius	La réforme de Marius (107 av. J.-C.) permit aux capite censi — citoyens trop pauvres pour s'équiper eux-mêmes — de rejoindre les légions, l'équipement étant fourni par l'État. En contrepartie, ces soldats devinrent fidèles à leur général plutôt qu'à Rome, puisque c'est lui qui garantissait leur solde et leur retraite (une concession de terres). Cette transformation explique directement les guerres civiles du Ier siècle av. J.-C. : Marius lui-même l'utilisa le premier.	t	2026-04-08 00:40:42.114118+00	\N
271	daily	hard	faction-romaine	\N	Les Romains classifiaient leurs légions avec une précision maniaque — numéros, cognomina, symboles animaux. Certaines légions portaient des numéros identiques à d'autres en simultané, ce qui confond encore les historiens.	Quelle légion romaine, surnommée "Fulminata" (la Foudroyante), est associée à l'épisode du "Miracle de la Pluie" sous Marc Aurèle vers 172 ap. J.-C. ?	qcm	["Legio XII Fulminata", "Legio III Augusta", "Legio X Gemina", "Legio I Adiutrix"]	Legio XII Fulminata	La Legio XII Fulminata est au cœur du "Miracle de la Pluie" (Columna de Marc Aurèle, colonne de Trajan) : assoiffée lors d'une campagne contre les Quades, la légion aurait été sauvée par une pluie providentielle. Chrétiens et partisans des cultes romains se disputaient la paternité du miracle. Tertullien l'attribuait à des soldats chrétiens en prière ; les sources officielles à Jupiter ou à des pratiques égyptiennes. La Legio XII est attestée en Orient depuis Auguste.	t	2026-04-08 00:40:42.114118+00	\N
272	daily	hard	faction-romaine	\N	Le droit romain est l'une des contributions intellectuelles les plus durables de Rome — mais sa codification définitive n'eut lieu que sous un empereur qui ne parlait pas latin couramment.	Sous quel empereur fut compilé le Corpus Juris Civilis, la codification majeure du droit romain, au VIe siècle ?	qcm	["Théodose II", "Justinien Ier", "Dioclétien", "Constantin Ier"]	Justinien Ier	Le Corpus Juris Civilis fut compilé entre 529 et 534 sous Justinien Ier, par une commission dirigée par le juriste Tribonien. Il comprend le Code (constitutions impériales), le Digeste (jurisprudence classique), les Institutes (manuel) et les Novelles (nouvelles lois). Justinien, natif d'Illyrie latinophone, parlait le grec comme langue de cour — son empire était en réalité grec dans sa culture quotidienne. Le Corpus est le fondement de la quasi-totalité des systèmes juridiques européens continentaux.	t	2026-04-08 00:40:42.114118+00	\N
273	daily	hard	faction-romaine	\N	Rome n'a pas toujours été une République, ni toujours un Empire. Entre la royauté légendaire et la République, une transition violente eut lieu qui imprima durablement la haine des rois dans l'ADN politique romain.	En quelle année traditionnelle les Romains chassèrent-ils leur dernier roi Tarquin le Superbe, fondant la République ?	qcm	["509 av. J.-C.", "476 av. J.-C.", "264 av. J.-C.", "753 av. J.-C."]	509 av. J.-C.	La tradition romaine (Tite-Live, Denys d'Halicarnasse) fixe la fondation de la République en 509 av. J.-C., après l'expulsion de Tarquin le Superbe par Brutus et ses alliés, en réaction au viol de Lucrèce par le fils du roi. Cette date, bien que symbolique et peut-être partiellement légendaire, est ancrée dans la conscience romaine : l'interdiction du titre de "roi" (rex) dura jusqu'à la fin de Rome. César fut assassiné en partie parce qu'on le soupçonnait de vouloir ce titre.	t	2026-04-08 00:40:42.114118+00	\N
274	daily	hard	faction-romaine	\N	La formation de combat romaine la plus célèbre n'est pas la légion entière — c'est l'unité tactique qui la composait, capable de manœuvrer indépendamment sur un terrain accidenté.	Comment appelle-t-on l'unité tactique de base de la légion romaine de l'époque républicaine tardive, composée d'environ 80 légionnaires ?	qcm	["La cohorte", "Le manipule", "Le century", "L'ala"]	Le century	Le century (centuria, littéralement "centurie") était la cellule de base de la légion impériale, commandée par un centurion. Dans la légion républicaine, le manipule (80-160 hommes, deux centuries) était l'unité tactique clé — c'est lui qui permettait la manœuvrabilité supérieure face aux phalanges hellénistiques. Avec la réforme marienne, la cohorte (6 centuries, ~480 hommes) devint l'unité tactique principale. L'ala désignait la cavalerie alliée sur les flancs.	t	2026-04-08 00:40:42.114118+00	\N
275	daily	hard	faction-romaine	\N	Certains empereurs romains ne moururent pas à Rome — ni même en Italie. L'Empire était si vaste que ses maîtres passaient parfois toute leur règne en campagne, mourant sur les marches d'un monde inconnu.	Où mourut l'empereur Julien, dit "l'Apostat", en 363 ap. J.-C. ?	qcm	["En Perse, lors de la retraite après sa campagne contre Ctésiphon", "En Gaule, lors d'une rébellion", "À Constantinople, de maladie", "En Bretagne, lors d'une campagne contre les Pictes"]	En Perse, lors de la retraite après sa campagne contre Ctésiphon	Julien (l'Apostat) mourut le 26 juin 363, frappé d'une lance lors de la retraite de son armée après l'échec à prendre Ctésiphon (capitale sassanide, dans l'Iraq actuel). Ses hommes avaient brûlé la flotte romaine pour couper la retraite — une décision catastrophique. Julien refusa les médecins et mourut en philosophe, selon ses biographes. Ammien Marcellin, présent lors de la campagne, en donne un récit détaillé. Jovien lui succéda et signa une paix humiliante avec les Perses.	t	2026-04-08 00:40:42.114118+00	\N
276	daily	hard	faction-romaine	\N	L'aqueduc romain n'est pas seulement un chef-d'œuvre hydraulique — c'est un système politique. L'accès à l'eau conditionnait la hiérarchie sociale des villes romaines, avec des droits d'eau accordés comme privilèges impériaux.	Quel aqueduc romain, le plus long jamais construit, atteignait 132 km de longueur pour alimenter Carthage en Afrique du Nord ?	qcm	["Aqueduc de Zaghouan", "Aqueduc de Carthage", "Aqua Claudia", "Aqueduc de Valens"]	Aqueduc de Zaghouan	L'aqueduc de Zaghouan (ou aqueduc de Carthage), construit sous Hadrien et Antonin le Pieux (IIe siècle), s'étendait sur environ 132 km depuis les sources du Jebel Zaghouan jusqu'à Carthage — le plus long aqueduc romain connu. Il alimentait les thermes d'Antonin, parmi les plus grands de l'Empire. Des vestiges importants subsistent en Tunisie. L'aqua Claudia (Rome) et l'aqueduc de Valens (Constantinople) sont également remarquables mais plus courts.	t	2026-04-08 00:40:42.114118+00	\N
277	daily	hard	faction-romaine	\N	La bataille qui mit fin à la République romaine ne fut pas Actium — ce fut une série de batailles. Mais Actium scella définitivement la victoire d'Auguste sur son dernier rival.	Lors de la bataille d'Actium (31 av. J.-C.), quel était le général commandant les forces d'Antoine et de Cléopâtre, qui trahit en traversant avec ses navires vers Auguste ?	qcm	["Quintus Dellius", "Agrippa", "Ahenobarbus", "Canidius Crassus"]	Ahenobarbus	Gnaeus Domitius Ahenobarbus (arrière-grand-père de Néron) commanda une partie de la flotte d'Antoine et déserta vers Octave peu avant la bataille d'Actium, malade et désenchanté par la politique orientale d'Antoine. Agrippa commandait la flotte d'Octave — c'est lui le vrai vainqueur naval d'Actium. Quintus Dellius avait trahi encore plus tôt. La bataille réelle fut peut-être moins héroïque qu'on ne le dit : la fuite de Cléopâtre et d'Antoine décida du sort avant même la fin des combats.	t	2026-04-08 00:40:42.114118+00	\N
278	daily	hard	faction-romaine	\N	Les Romains appelaient "naumachie" une reconstitution navale de bataille — un spectacle si coûteux et complexe qu'il était réservé aux occasions les plus exceptionnelles de l'histoire impériale.	Combien de combattants Suétone dit-il que César engagea dans la première grande naumachie romaine organisée en 46 av. J.-C. ?	qcm	["4 000 rameurs et 1 000 combattants", "6 000 hommes", "16 000 hommes", "2 000 gladiateurs"]	16 000 hommes	Suétone (Vie de César, 39) indique que César fit creuser un lac artificiel dans le Champ de Mars pour sa naumachie de 46 av. J.-C., qui opposa des trirèmes et quadrirèmes tyriennes contre égyptiennes, avec 4 000 rameurs et 1 000 combattants selon certaines sources — mais d'autres références antiques évoquent jusqu'à 16 000 participants (rameurs inclus). C'est la première naumachie romaine attestée à grande échelle. Auguste, Claude et Domitien en organisèrent d'autres encore plus spectaculaires.	t	2026-04-08 00:40:42.114118+00	\N
279	daily	hard	faction-romaine	\N	Le réseau routier romain n'était pas qu'une infrastructure militaire — c'était un système de communication politique et économique. Mais toutes les routes ne se valaient pas : leur classification avait des implications juridiques précises.	Comment appelait-on les voies romaines privées, construites et entretenues par des propriétaires fonciers, par opposition aux voies publiques ?	qcm	["Viae vicinales", "Viae privatae", "Viae municipales", "Actus"]	Viae privatae	Le droit romain distinguait plusieurs catégories de voies : les viae publicae (routes d'État, entretenues par les caisses publiques), les viae vicinales (chemins de villages, entretenus par les riverains), et les viae privatae (propriété de particuliers, accessibles ou non selon leur bon vouloir). Les juristes romains (notamment Ulpien dans le Digeste) définissent avec précision ces catégories et les droits de passage (jus eundi, jus agendi) associés à chacune.	t	2026-04-08 00:40:42.114118+00	\N
280	daily	hard	faction-romaine	\N	Le ciment romain (opus caementicium) est un mystère de la technologie ancienne — ses formules permettaient de construire sous l'eau et de résister aux séismes mieux que certains bétons modernes.	Quel ingrédient volcanique spécifique, extrait des environs de Pouzzoles (Campanie), donnait au ciment romain sa résistance à l'eau ?	qcm	["La pozzolane", "La chaux vive", "Le tuf volcanique", "Le basalte"]	La pozzolane	La pouzzolane (pulvis puteolanus, "poussière de Pouzzoles") est une cendre volcanique riche en silicates alumino-alumineux qui réagit avec la chaux et l'eau pour former un ciment hydraulique — capable de durcir même sous l'eau. Vitruve (De Architectura) en décrit l'usage. Des études récentes (2017, UC Berkeley) ont montré que les cristaux d'aluminosilicate de tobermorite qui se forment dans le béton romain au fil des siècles le rendent plus résistant avec le temps, contrairement au béton Portland moderne qui se dégrade.	t	2026-04-08 00:40:42.114118+00	\N
281	daily	hard	faction-romaine	\N	Le Sénat romain n'était pas élu — ses membres y siégeaient à vie une fois qualifiés. Mais l'institution avait ses propres rites, ses propres tabous, et ses propres formes de violence institutionnelle.	Que signifiait la procédure de "damnatio memoriae" décidée par le Sénat contre un empereur défunt ?	qcm	["L'exil posthume de sa famille", "L'effacement systématique de son nom et de son image dans tout l'Empire", "L'annulation de toutes ses lois", "La confiscation de ses biens au profit du peuple"]	L'effacement systématique de son nom et de son image dans tout l'Empire	La damnatio memoriae ("condamnation de la mémoire") visait à effacer l'existence d'un individu de la mémoire officielle : martelage des inscriptions, suppression du visage sur les statues (souvent remplacé par celui du successeur), suppression du nom dans les documents officiels. Elle frappa des empereurs comme Domitien, Commode et Caracalla. Paradoxalement, nous connaissons bien ces empereurs précisément parce que les sources historiques mentionnent cette condamnation — ce qui préserva leur souvenir.	t	2026-04-08 00:40:42.114118+00	\N
282	daily	hard	faction-romaine	\N	La gens Julia prétendait descendre d'Énée, fils de la déesse Vénus. Cette généalogie divine était un instrument politique autant qu'une conviction religieuse — Auguste l'exploita habilement.	Quel culte Auguste établit-il à Rome pour honorer l'ancêtre divin de la gens Julia, en construisant un temple sur le Forum d'Auguste ?	qcm	["Mars Ultor", "Vénus Genetrix", "Apollon Palatin", "Jupiter Capitolin"]	Mars Ultor	Auguste fit construire le temple de Mars Ultor ("Mars le Vengeur") sur le Forum d'Auguste, promis après la bataille de Philippes (42 av. J.-C.) où il vengea César. Mais le culte dynastique de Vénus Genetrix (Vénus mère, ancêtre de la gens Julia) avait été établi par César lui-même sur le Forum de César. Auguste joua des deux références divines : Vénus pour la légitimité julienne, Mars pour la légitimité militaire. L'Ara Pacis combina les deux thèmes dans la sculpture officielle.	t	2026-04-08 00:40:42.114118+00	\N
283	daily	hard	faction-romaine	\N	La période des "empereurs-soldats" (235-284 ap. J.-C.) vit Rome traverser une crise d'une violence exceptionnelle — des dizaines d'empereurs en cinquante ans, la plupart assassinés.	Quel est l'unique "empereur-soldat" de la période 235-284 à avoir abdiqué volontairement et survécu pour cultiver ses choux ?	qcm	["Aurélien", "Dioclétien", "Gallien", "Dèce"]	Dioclétien	Dioclétien (règne 284-305) est le seul des empereurs de la crise du IIIe siècle à avoir abdiqué volontairement (1er mai 305), se retirant dans son palais de Split (Croatie actuelle). À des courtisans qui le suppliaient de reprendre le pouvoir, il répondit — selon une anecdote peut-être apocryphe mais célèbre — qu'ils devraient voir les choux qu'il cultivait. La crise des empereurs-soldats (235-284) vit 26 empereurs reconnus, presque tous assassinés. Dioclétien réorganisa l'Empire en tétrarchie.	t	2026-04-08 00:40:42.114118+00	\N
284	daily	hard	faction-romaine	\N	La frontière romaine du Rhin et du Danube n'était pas un simple mur — c'était un système défensif en profondeur, avec des forts, des tours de guet, et des routes de patrouille. Son nom latin est encore utilisé en archéologie.	Quel terme latin désigne le système de fortifications frontalières romaines (murs, fossés, tours, forts) formant la frontière de l'Empire ?	qcm	["Limes", "Vallum", "Fossa", "Clausura"]	Limes	Le limes (pl. limites) désignait à l'origine simplement une "voie de frontière" ou un "chemin". Il prit progressivement le sens de frontière militarisée sous les empereurs. Le Limes Germanicus (entre Rhin et Danube) s'étendait sur 550 km, le Limes Raeticus sur 166 km — inscrits à l'UNESCO. Le vallum désigne spécifiquement le fossé derrière le Mur d'Hadrien. La fossa est un fossé simple. Le terme limes est aujourd'hui utilisé pour désigner toute frontière romaine fortifiée.	t	2026-04-08 00:40:42.114118+00	\N
285	daily	hard	faction-romaine	\N	Rome avait ses banquiers, ses spéculateurs et ses sociétés de capitalistes. Le système financier romain était bien plus sophistiqué que ce qu'on imagine souvent, avec des instruments proches des actions modernes.	Comment appelait-on les sociétés de fermiers de l'impôt romain qui émettaient des parts (partes) négociables, ancêtres des sociétés par actions ?	qcm	["Les negotiatores", "Les argentarii", "Les societates publicanorum", "Les mensarii"]	Les societates publicanorum	Les societates publicanorum (sociétés de publicains) collectaient les impôts pour l'État romain en échange d'un contrat de concession. Elles émettaient des partes — des parts de propriété négociables sur le Forum — que les investisseurs achetaient et vendaient. Polybe mentionne que ces parts étaient très répandues. Cicéron (De Republique, De Officiis) décrit leur fonctionnement. Certains historiens (Ulrike Malmendier) les considèrent comme les premières sociétés par actions de l'histoire.	t	2026-04-08 00:40:42.114118+00	\N
286	daily	hard	faction-byzantine	\N	Le feu grégeois reste l'une des armes les plus mystérieuses de l'histoire militaire. Son secret, jalousement gardé par Constantinople, lui permit de survivre à des assauts navals qui auraient détruit tout autre empire.	Lors de quel siège arabe de Constantinople le feu grégeois fut-il utilisé pour la première fois avec un effet décisif, vers 672-678 ap. J.-C. ?	qcm	["Premier siège arabe de Constantinople (672-678)", "Siège de Thessalonique (904)", "Siège de Syracuse (827)", "Siège de Dorostolon (971)"]	Premier siège arabe de Constantinople (672-678)	C'est lors du premier grand siège arabe de Constantinople (672-678) que le feu grégeois, inventé selon la tradition par Callínicos d'Héliopolis (un ingénieur grec réfugié de Syrie), fut utilisé contre la flotte omeyyade. L'amiral arabe fut repoussé avec de lourdes pertes. La composition exacte du feu grégeois reste inconnue (probablement naphte, chaux vive, résine), mais il brûlait sur l'eau et ne pouvait être éteint — ce qui en faisait une arme psychologique autant que militaire.	t	2026-04-08 00:40:42.114118+00	\N
287	daily	hard	faction-byzantine	\N	La querelle iconoclaste déchira l'Empire byzantin pendant plus d'un siècle, mêlant théologie, politique impériale et pression islamique. Elle eut deux phases distinctes, séparées par une restauration orthodoxe.	En quelle année le Concile de Nicée II restaura-t-il officiellement le culte des images dans l'Empire byzantin, mettant fin à la première iconoclasie ?	qcm	["787", "843", "726", "815"]	787	Le Concile de Nicée II (7e concile œcuménique, 787) présidé par la régente Irène d'Athènes restaura le culte des icônes, distinguant la "vénération" (proskynesis) de l'"adoration" (latrie) réservée à Dieu seul. La seconde iconoclasie éclata en 815 sous Léon V l'Arménien et prit fin définitivement en 843 — date célébrée comme le "Triomphe de l'Orthodoxie" dans l'Église orthodoxe jusqu'à aujourd'hui. L'icône de la Vierge Hodegetria fut au cœur de ces conflits.	t	2026-04-08 00:40:42.114118+00	\N
288	daily	hard	faction-byzantine	\N	Byzance ne se contentait pas de résister — elle reconquérait. Le Xe siècle fut un âge d'or militaire, avec des généraux qui repoussèrent les frontières de l'Empire jusqu'en Syrie et en Mésopotamie.	Quel général byzantin, surnommé "Pâle-de-Mort" (Nikephoros Phokas), reconquit la Crète aux Arabes en 961 ap. J.-C. ?	qcm	["Jean Tzimiskès", "Niképhore II Phokas", "Basile II", "Bardas Sklèros"]	Niképhore II Phokas	Niképhore Phokas (futur Niképhore II, r. 963-969) reconquit la Crète en 961 après un siège de plusieurs mois d'Héraklion (Chandax), mettant fin à 135 ans de domination arabe sur l'île. Il reconquit ensuite Chypre et Cilicie, et ses campagnes syriennes atteignirent Alep. Il devint empereur en 963 et fut assassiné en 969 par son neveu Jean Tzimiskès (avec la complicité de l'impératrice Théophano). Liutprand de Crémone, ambassadeur à Byzance, le décrit avec une antipathie teintée d'admiration.	t	2026-04-08 00:40:42.114118+00	\N
289	daily	hard	faction-byzantine	\N	La garde varègue de Constantinople était l'élite personnelle des empereurs byzantins — des guerriers nordiques recrutés pour leur loyauté envers l'or plutôt que pour des liens dynastiques byzantins.	En quelle année et à la suite de quel événement Basile II reçut-il les 6 000 guerriers varègues qui formèrent le noyau de la garde varègue ?	qcm	["En 988, à la suite de l'alliance avec Vladimir de Kiev", "En 1000, après la conquête bulgare", "En 960, lors de la campagne de Crète", "En 1025, à la mort de Basile II"]	En 988, à la suite de l'alliance avec Vladimir de Kiev	Basile II, menacé par la rébellion de Bardas Phocas, demanda l'aide de Vladimir Ier de Kiev (le Grand). Vladimir envoya 6 000 Varègues en échange de la main de la princesse Anne (sœur de Basile) — condition extraordinaire pour un "barbare". Ces guerriers aidèrent à écraser la rébellion. Vladimir se convertit au christianisme orthodoxe (988) et fit baptiser la Rus' de Kiev — décision aux conséquences historiques incalculables pour la civilisation russe.	t	2026-04-08 00:40:42.114118+00	\N
290	daily	hard	faction-byzantine	\N	La diplomatie byzantine était aussi sophistiquée que son armée — peut-être plus. L'Empire convertissait ses voisins au christianisme, créait des alphabets pour les barbares, et piégeait ses ennemis dans des dépendances spirituelles et commerciales.	Quels missionnaires byzantins créèrent l'alphabet glagolitique pour écrire le slave au IXe siècle, ouvrant la voie à la civilisation slave chrétienne ?	qcm	["Photios et Méthode", "Cyrille et Méthode", "Clément et Naum", "Basile et Méthode"]	Cyrille et Méthode	Cyrille (Constantin, 826-869) et Méthode (815-885), frères thessaloniciens envoyés en mission en Moravie en 863, créèrent le premier alphabet slave : le glagolitique (l'alphabet cyrillique, nommé en l'honneur de Cyrille, fut développé par leurs disciples). Ils traduisirent les Évangiles en vieux-slave liturgique. Leur mission fut contestée par les évêques francs qui exigeaient le latin comme seule langue liturgique — Rome trancha en leur faveur. Ils sont considérés comme les "apôtres des Slaves".	t	2026-04-08 00:40:42.114118+00	\N
291	daily	hard	faction-byzantine	\N	La chute de Constantinople en 1453 n'était pas inévitable — plusieurs tentatives de sauvetage occidental échouèrent, en partie à cause des divisions religieuses entre orthodoxes et catholiques.	Quelle bataille de 1444, si elle avait été une victoire chrétienne, aurait peut-être sauvé Constantinople de la chute ottomane ?	qcm	["Bataille de Varna", "Bataille de Kosovo (1389)", "Bataille de Nicopolis", "Bataille de Mohács"]	Bataille de Varna	La bataille de Varna (10 novembre 1444) opposa une croisade chrétienne (Hongrois, Polonais, Valaques, chevaliers occidentaux) à Murad II. La mort du roi Vladislas III de Pologne/Hongrie et la désintégration de la coalition entraînèrent une défaite totale. Constantinople tomba neuf ans plus tard. Si la croisade avait gagné, elle aurait pu consolider les Balkans et peut-être renverser la pression ottomane. La bataille de Nicopolis (1396) avait été la première grande défaite croisée dans la région.	t	2026-04-08 00:40:42.114118+00	\N
292	daily	hard	faction-byzantine	\N	L'administration byzantine était remarquablement centralisée — et les titres honorifiques étaient distribués avec une précision calculée pour créer des hiérarchies de loyauté autour de l'empereur.	Comment appelait-on le haut dignitaire byzantin qui gérait les finances impériales et la trésorerie, deuxième personnage de l'administration civile ?	qcm	["Le logothète du drome", "Le sacellaire", "Le mégas logariaste", "Le sakellarios"]	Le sakellarios	Le sakellarios (σακελλάριος) était le haut fonctionnaire responsable du trésor impérial (sakellion) et de la surveillance des finances de l'État byzantin. Il contrôlait les autres logothètes (ministres de département). Le logothète du drome gérait les postes et la diplomatie. Au fil des siècles, les titres et fonctions byzantins évolèrent considérablement — le mégas logariaste devint plus tard le chef de la comptabilité impériale sous les Paléologues. La complexité de la bureaucratie byzantine est un trait distinctif de l'Empire.	t	2026-04-08 00:40:42.114118+00	\N
293	daily	hard	faction-byzantine	\N	Le schisme de 1054 entre Rome et Constantinople n'est pas une séparation soudaine — il fut la conclusion d'une longue dérive qui dura des siècles. Son acte symbolique fut spectaculairement précis.	Qui fut le légat papal qui déposa la bulle d'excommunication sur l'autel de Sainte-Sophie en 1054, provoquant le Grand Schisme ?	qcm	["Humbert de Moyenmoutier", "Hildebrand (futur Grégoire VII)", "Pierre Damien", "Anselme de Canterbury"]	Humbert de Moyenmoutier	Humbert de Moyenmoutier (ou Humbert de Silva Candida), cardinal légat du pape Léon IX (déjà mort à ce moment), déposa une bulle d'excommunication sur l'autel de Sainte-Sophie le 16 juillet 1054, visant le patriarche Cérulaire. La réponse de Cérulaire fut d'excommunier les légats. Le schisme résulta d'un cumul de griefs : le Filioque (ajout au Credo), la primauté papale, les rites azymes latins vs levés orthodoxes. Il ne fut "formellement" reconnu irréversible que beaucoup plus tard.	t	2026-04-08 00:40:42.114118+00	\N
294	daily	hard	faction-byzantine	\N	L'art byzantin est rarement compris dans sa logique interne — ce n'est pas un art "primitif" figé, mais un art théologique où chaque détail (la couleur, la position des mains, le regard) a une signification codifiée.	Dans l'iconographie byzantine, que signifie le fond d'or (chrysos) omniprésent sur les icônes ?	qcm	["La richesse de l'Église", "La lumière divine incréée", "La royauté impériale", "La sainteté du personnage représenté"]	La lumière divine incréée	Le fond d'or des icônes byzantines représente la lumière divine incréée (la lumière de la Tabor, selon la théologie hésychaste développée par Grégoire Palamas au XIVe siècle). Ce n'est pas un fond décoratif : c'est l'absence de perspective spatiale — le personnage sacré n'existe pas dans l'espace terrestre mais dans l'éternité divine. L'or est une lumière, pas une surface. Cette théologie explique pourquoi l'art byzantin refusa délibérément le naturalisme occidental jusqu'à sa fin.	t	2026-04-08 00:40:42.114118+00	\N
295	daily	hard	faction-byzantine	\N	L'Empire byzantin pratiquait une politique matrimoniale complexe, mariant ses princesses à des souverains étrangers pour créer des liens diplomatiques — mais refusant parfois ce qu'il accordait à d'autres, selon des calculs de prestige précis.	Quel titre honorifique l'Empire byzantin accordait-il aux souverains étrangers qui entraient dans son système d'alliances, les intégrant symboliquement à la "famille des rois" centrée sur l'empereur ?	qcm	["César", "Patricios", "Fils spirituel", "Protospatharios"]	Fils spirituel	La diplomatie byzantine créait des relations de "parenté spirituelle" — l'empereur devenait le parrain (koumbaros) ou le père spirituel de rois étrangers après leur conversion ou leur alliance. Ce titre de "fils spirituel" (teknon) intégrait symboliquement le roi barbare dans la hiérarchie universelle centrée sur Constantinople. Constantine VII Porphyrogénète (De Administrando Imperio) décrit en détail quels peuples méritaient quels titres — et surtout lesquels ne devaient JAMAIS recevoir la pourpre impériale ni épouser des princesses de sang.	t	2026-04-08 00:40:42.114118+00	\N
296	daily	hard	faction-byzantine	\N	La bataille de Manzikert (1071) est souvent présentée comme le coup mortel porté à Byzance — mais les Byzantins auraient pu survivre à cette défaite si leurs propres élites ne les avaient pas déchirés de l'intérieur.	Qui captura l'empereur byzantin Romain IV Diogène lors de la bataille de Manzikert en 1071 ?	qcm	["Alp Arslan", "Toghrul Beg", "Kilij Arslan", "Malik-Chah"]	Alp Arslan	Alp Arslan, sultan seldjoukide, captura l'empereur Romain IV Diogène lors de la bataille de Manzikert (26 août 1071, en Arménie actuelle). Il traita son prisonnier avec une courtoisie notable — libération contre rançon et traité de paix. Mais à son retour, Romain IV fut destitué, aveuglé et tué par ses rivaux byzantins. Le traité fut ignoré. Les Seldjoukides envahirent alors massivement l'Anatolie, privant Byzance de ses provinces les plus riches et de ses réserves de recrutement.	t	2026-04-08 00:40:42.114118+00	\N
297	daily	hard	faction-byzantine	\N	La quatrième croisade (1202-1204) n'atteignit jamais l'Égypte — elle se perdit à Constantinople, qu'elle prit d'assaut et pilla pendant trois jours. Cet événement divisa la chrétienté pour toujours.	Quel doge de Venise, âgé et presque aveugle, dirigea personnellement la prise de Constantinople en 1204 depuis la proue de son navire ?	qcm	["Enrico Dandolo", "Pietro Ziani", "Giovanni Michiel", "Raniero Zeno"]	Enrico Dandolo	Enrico Dandolo, doge de Venise, avait environ 90 ans lors de la prise de Constantinople (avril 1204). Aveugle ou presque — peut-être à la suite d'un séjour à Constantinople dans sa jeunesse où il aurait été maltraité par les Byzantins — il monta le premier sur les murailles ou dirigea l'assaut depuis son navire selon les chroniques. Il mourut à Constantinople en 1205 et y fut enterré dans Sainte-Sophie. La prise de Constantinople par des croisés chrétiens choqua même le pape Innocent III.	t	2026-04-08 00:40:42.114118+00	\N
298	daily	hard	faction-byzantine	\N	Les Byzantins n'oublièrent jamais la prise de leur capitale — même après sa restauration, ils gardèrent la mémoire du sac latin. Et quand Constantinople tomba definitvement en 1453, certains Byzantins choisirent les Turcs aux Latins.	Quelle formule prononcée par le Grand Duc Lucas Notaras avant 1453 résume le sentiment de nombreux Byzantins envers l'union avec Rome ?	qcm	["\\"Mieux vaut la mort que l'union latine\\"", "\\"Mieux vaut le turban du sultan que la tiare du pape\\"", "\\"Constantinople mourra mais jamais ne se rendra\\"", "\\"La Croix vaut plus que la couronne\\""]	"Mieux vaut le turban du sultan que la tiare du pape"	Lucas Notaras (Loukas Notaras), mégas doux (amiral en chef) byzantin, aurait dit : "Je préfère voir dans cette ville le turban des Turcs que la tiare latine" — une formule qui résume le ressentiment orthodoxe après des siècles d'humiliations latines culminant avec 1204. Notaras s'opposa à l'Union de Florence (1439). Paradoxalement, il fut exécuté par Mehmed II après la chute de Constantinople en 1453, ses fils étant réclamés pour le harem du sultan.	t	2026-04-08 00:40:42.114118+00	\N
299	daily	hard	faction-byzantine	\N	La science et la philosophie ne moururent pas à la chute de Rome — elles survécurent à Byzance, et les Byzantins transmirent à l'Occident renaissant les textes grecs que les Arabes avaient déjà en partie préservés.	Quelle académie ou école philosophique byzantine, active au XVe siècle à Mistra (Péloponnèse), influença directement la Renaissance florentine ?	qcm	["L'école de Trébizonde", "L'école de Thessalonique", "L'école de Mistra (Pléthon)", "L'Académie de Nicée"]	L'école de Mistra (Pléthon)	Gémiste Pléthon (vers 1355-1452/54), philosophe byzantin platonicien basé à Mistra (cité byzantine du Péloponnèse), participa au Concile de Florence (1438-39) et y répandit l'enthousiasme pour Platon parmi les humanistes italiens. Côme de Médicis, impressionné, fonda l'Académie platonicienne de Florence. Pléthon lui-même proposa de remplacer le christianisme par un néo-paganisme grec — une œuvre brûlée après sa mort par le patriarche Gennadios. Il fut l'un des catalyseurs de la Renaissance.	t	2026-04-08 00:40:42.114118+00	\N
300	daily	hard	faction-byzantine	\N	La succession impériale byzantine n'obéissait pas à des règles fixes de primogéniture — la légitimité se gagnait aussi par la naissance dans la chambre pourpre du palais, une distinction aux conséquences durables.	Que signifiait le titre de "Porphyrogénète" (né dans la pourpre) dans la hiérarchie byzantine ?	qcm	["Né pendant le règne de son père", "Né dans la chambre pourpre du Palais Sacré", "Baptisé avec la pourpre impériale", "Désigné héritier avant sa naissance"]	Né dans la chambre pourpre du Palais Sacré	Le titre de Porphyrogénète (Πορφυρογέννητος, "né dans la pourpre") désignait un enfant né dans la chambre revêtue de porphyre rouge du Palais Sacré de Constantinople, réservée aux accouchements impériaux. Cela donnait une légitimité spéciale — une naissance "dans la pourpre" valait plus qu'une naissance royale ordinaire. Constantin VII, qui régna au Xe siècle, était si fier de ce titre qu'il signa de nombreux ouvrages "Constantin Porphyrogénète". Le porphyre rouge, extrait d'une seule carrière en Égypte, était la couleur du pouvoir impérial.	t	2026-04-08 00:40:42.114118+00	\N
301	daily	hard	faction-byzantine	\N	L'Empire byzantin survécut à sa propre chute — de petits États successeurs se proclamèrent héritiers de Byzance pendant des décennies après 1453, dont l'un persista jusqu'en 1461.	Quel empire byzantin en exil, fondé après 1204, survécut à la chute de Constantinople de 1453 et ne fut conquis par les Ottomans qu'en 1461 ?	qcm	["L'Empire de Nicée", "L'Empire de Trébizonde", "L'Despotat de Mistra", "L'Empire de Thessalonique"]	L'Empire de Trébizonde	L'Empire de Trébizonde (1204-1461), fondé par Alexis et David Comnène sur les rives de la mer Noire (Trabzon, Turquie actuelle), fut le dernier État successeur byzantin. Il survécut à la chute de Constantinople de 1453 de huit ans, avant d'être conquis par Mehmed II en 1461. Riche grâce au commerce de la Route de la Soie et aux mines d'argent pontiques, il avait maintenu une culture byzantine remarquable et des contacts avec la Géorgie, l'Arménie et les khans mongols.	t	2026-04-08 00:40:42.114118+00	\N
193	daily	medium	faction-celtique	\N	Sur un plateau de Bourgogne, cerné par les légions romaines et leurs doubles fortifications, les Gaulois jouèrent leur dernière carte. Ce nom résonne encore dans toute l'histoire de France.	Quel oppidum mandubien, situé sur un plateau naturellement défendu, fut le théâtre du siège décisif de 52 av. J.-C. où Vercingétorix dut se rendre à César ?	free	\N	Alésia	Alésia (Alesia en gaulois) fut le site du siège final de la guerre des Gaules. César y fit construire deux lignes de fortification : la contrevallation (face aux assiégés) et la circumvallation (face aux renforts gaulois). La défaite de Vercingétorix y sella le sort de la Gaule indépendante.	t	2026-04-08 00:40:33.203598+00	\N
\.


--
-- Data for Name: eras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."eras" ("id", "name", "year_start", "year_end", "sort_order") FROM stdin;
prehistory	Préhistoire	\N	-3300	1
bronze-age	Âge du Bronze	-3300	-1200	2
iron-age	Âge du Fer	-1200	-500	3
classical-antiquity	Antiquité classique	-500	476	4
early-middle-ages	Haut Moyen Âge	476	1000	5
late-middle-ages	Bas Moyen Âge	1000	1453	6
renaissance	Renaissance	1453	1600	7
early-modern	Époque moderne	1600	1789	8
contemporary	Époque contemporaine	1789	1945	9
post-1945	Monde post-1945	1945	2020	10
digital-era	Ère digitale	2020	\N	11
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tags" ("id", "created_at", "updated_at", "title", "color", "background", "icon", "order", "reward_energy", "reward_conquest", "reward_construction", "gauge", "base_cost") FROM stdin;
DKZsetA4osbrXnntY8D8	2024-09-30 07:58:36.48+00	2026-03-27 16:53:47.837+00	Lieu de bivouac	#3F5A93	#ECF3FC	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/DKZsetA4osbrXnntY8D8-1773736646896.svg	1	0	0	0	vitalite	1.0
5yOutD8Lp	2024-09-30 07:58:36.442+00	2026-03-28 17:42:54.719+00	Monts et promontoires	#708d44	#F1FCEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/5yOutD8Lp.svg	4	0	0	0	energy	1.0
3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402	2024-09-30 07:58:36.638+00	2026-03-27 17:17:49.257+00	Grottes & Cairns	#555353	#d9d9d9	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402-1773736568936.svg	5	0	0	0	vitalite	1.0
qFgH3VtCz	2024-09-30 07:58:36.52+00	2026-03-27 17:17:49.257+00	Temples anciens	#84352F	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/qFgH3VtCz-1773736398848.svg	4	0	0	0	construction	1.0
uileM8JGQ	2024-09-30 07:58:36.444+00	2026-03-27 20:18:49.773+00	Sanctuaires	#6e487f	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/uileM8JGQ-1771778578386.svg	9	0	0	0	construction	1.0
DwlWijqgg	2024-09-30 07:58:36.447+00	2026-03-27 17:17:49.257+00	Ruines et vestiges	#745744	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/DwlWijqgg.svg	8	0	0	0	conquest	1.0
musees	2026-03-28 17:28:28.642936+00	2026-03-28 18:04:53.311+00	Musées	#6e5d6f	#e2dcd5	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/musees-1774719302603.svg	11	0	0	0	energy	1.0
spot-de-van	2026-03-28 17:40:08.241407+00	2026-03-28 18:04:53.311+00	Spot de van	#6672cc	#e6e5ff	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/spot-de-van-1774719619065.svg	12	0	0	0	energy	1.0
_cjvj91BX	2024-09-30 07:58:36.417+00	2026-03-27 17:17:49.257+00	Cathédrales & basiliques	#6556ae	#e7e4f1	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/_cjvj91BX.svg	10	0	0	0	construction	1.0
zz6Kc6zGd	2024-09-30 07:58:36.413+00	2026-03-28 17:34:10.052+00	Abris naturels	#5a7c60	#ECF3FC	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/zz6Kc6zGd-1774719247852.svg	3	0	0	0	vitalite	1.0
xMFhmfmYa	2024-09-30 07:58:36.452+00	2026-03-27 17:18:08.288+00	Gites et refuges	#5d3c3c	#dbdbdb	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/xMFhmfmYa-1773736506114.svg	2	0	0	0	vitalite	1.0
4zC0EoxJr	2024-09-30 07:58:36.422+00	2026-03-27 17:18:08.288+00	Arbres maîtres	#527E4F	#F1FCEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/4zC0EoxJr.svg	1	0	0	0	vitalite	1.0
Jvo33GomD75u41Q3y8ox	2024-09-30 07:58:36.413+00	2026-03-28 17:36:56.925+00	Historique	#84352F	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/Jvo33GomD75u41Q3y8ox-1774719415241.svg	4	0	0	0	energy	1.0
3fQyu5KCU	2024-09-30 07:58:36.419+00	2026-03-28 17:37:47.288+00	Châteaux & fortins	#a9260f	#e6c0b7	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/3fQyu5KCU-1774719465798.svg	1	0	0	0	energy	1.0
EaeTGcHV2	2024-09-30 07:58:36.416+00	2026-03-27 17:18:08.288+00	Dolmens & mégalithes	#8c3166	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/EaeTGcHV2.svg	2	0	0	0	construction	1.0
esgo0rr1G	2024-09-30 07:58:36.432+00	2026-03-28 17:42:06.607+00	Statues	#bb5d6b	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/esgo0rr1G-1773736345963.svg	6	0	0	0	conquest	1.0
panoramique	2026-03-28 18:03:16.995477+00	2026-03-28 18:06:10.41+00	Vue emblématique	#80974e	#ebf1df	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/panoramique-1774721015044.svg	13	0	0	0	energy	1.0
wkiO3xOVaoztd6FGiLps	2024-09-30 07:58:36.41+00	2026-03-27 17:18:08.288+00	Curiosité locale	#b68d35	#FCF9EF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/wkiO3xOVaoztd6FGiLps-1771776390943.svg	3	0	0	0	construction	1.0
zWGn-Bles	2024-09-30 07:58:36.408+00	2026-03-28 17:42:06.607+00	Monuments	#b75292	#FDEFEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/zWGn-Bles-1773736494795.svg	7	0	0	0	conquest	1.0
WC51eGlMy	2024-09-30 07:58:36.411+00	2026-03-28 17:42:18.264+00	Sources, lacs & rivières	#4f9ac9	#ebebeb	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/WC51eGlMy-1773736655081.svg	3	0	0	0	vitalite	1.0
Y2QJZIKnAfhvL7PSeiNF	2024-09-30 07:58:36.443+00	2026-03-28 17:42:29.815+00	Naturel	#5da654	#F1FCEF	https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/tag-icons/Y2QJZIKnAfhvL7PSeiNF.svg	2	0	0	0	vitalite	1.0
\.


--
-- Data for Name: faction_tag_bonuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."faction_tag_bonuses" ("faction_id", "tag_id", "cost_reduction") FROM stdin;
faction-byzantine	qFgH3VtCz	50.00
faction-byzantine	5yOutD8Lp	25.00
faction-byzantine	3fQyu5KCU	25.00
faction-byzantine	Jvo33GomD75u41Q3y8ox	50.00
faction-byzantine	wkiO3xOVaoztd6FGiLps	50.00
faction-byzantine	uileM8JGQ	25.00
faction-romaine	DwlWijqgg	50.00
faction-romaine	zWGn-Bles	25.00
faction-romaine	Jvo33GomD75u41Q3y8ox	25.00
faction-romaine	3fQyu5KCU	50.00
faction-romaine	xMFhmfmYa	25.00
faction-romaine	DKZsetA4osbrXnntY8D8	50.00
faction-nordique	xMFhmfmYa	25.00
faction-nordique	zz6Kc6zGd	25.00
faction-nordique	WC51eGlMy	50.00
faction-nordique	DwlWijqgg	50.00
faction-nordique	3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402	50.00
faction-nordique	esgo0rr1G	25.00
faction-celtique	4zC0EoxJr	50.00
faction-celtique	EaeTGcHV2	50.00
faction-celtique	WC51eGlMy	25.00
faction-celtique	uileM8JGQ	25.00
faction-celtique	DwlWijqgg	50.00
faction-celtique	musees	25.00
\.


--
-- Data for Name: fragment_tag_affinities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."fragment_tag_affinities" ("fragment_id", "tag_id", "bonus_points") FROM stdin;
1	qFgH3VtCz	1
9	Y2QJZIKnAfhvL7PSeiNF	2
8	3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402	1
8	DwlWijqgg	1
7	3fQyu5KCU	1
6	uileM8JGQ	2
1	3fQyu5KCU	1
2	DKZsetA4osbrXnntY8D8	1
2	Y2QJZIKnAfhvL7PSeiNF	1
4	xMFhmfmYa	2
5	4zC0EoxJr	2
7	WC51eGlMy	1
\.


--
-- Data for Name: fragment_words; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."fragment_words" ("id", "fragment_id", "word", "slot", "gender", "created_at") FROM stdin;
41	10	Ambassadeur Runes de Chêne	nom	n	2026-03-26 13:53:41.706354+00
42	10	Ambassadrice Runes de Chêne	nom	n	2026-03-26 13:53:51.914067+00
10	4	Oeil de hibou	nom	n	2026-03-24 19:31:09.060843+00
1	1	Varègue	nom	n	2026-03-24 14:08:53.335843+00
37	7	Porteur de bouclier	nom	n	2026-03-25 18:24:48.382439+00
32	9	Druide	nom	n	2026-03-24 19:56:26.744249+00
19	6	Valkyrie	nom	n	2026-03-24 19:34:51.373189+00
36	8	Prêtre de la Morrigan	nom	n	2026-03-25 18:24:26.02536+00
24	7	Porteuse de bouclier	nom	n	2026-03-24 19:51:20.281742+00
38	9	Druidesse	nom	n	2026-03-25 18:24:52.572591+00
39	6	Hersir	nom	n	2026-03-25 18:25:01.069408+00
17	5	Héritier arthurien	nom	n	2026-03-24 19:33:49.173237+00
4	2	Loup gris	nom	n	2026-03-24 14:13:29.567408+00
8	3	Demiurge	nom	n	2026-03-24 18:59:23.76013+00
28	8	Prêtresse de la Morrigan 	nom	n	2026-03-24 19:55:30.128976+00
\.


--
-- Data for Name: place_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."place_types" ("id", "created_at", "updated_at", "parent_id", "title", "form_description", "long_description", "images", "color", "order", "background", "border", "faded_color", "hidden") FROM stdin;
lieu	2026-02-21 11:00:08.311214+00	2026-02-21 11:00:08.311214+00	\N	Lieu			{}	#C19A6B	1	#F5E6D3	#000000	#CCCCCC	f
anecdote	2026-02-21 11:00:08.311214+00	2026-02-21 11:00:08.311214+00	\N	Anecdote			{}	#7D5A3C	2	#F5E6D3	#000000	#CCCCCC	f
produit	2026-02-21 11:00:08.311214+00	2026-02-21 11:00:08.311214+00	\N	Produit			{}	#A0784C	3	#EDE0CE	#000000	#CCCCCC	f
evenement	2026-02-21 11:00:08.311214+00	2026-02-21 11:00:08.311214+00	\N	Événement			{}	#4A3728	4	#E8D5BE	#000000	#CCCCCC	f
\.


--
-- Data for Name: tag_gauge_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tag_gauge_mapping" ("tag_id", "gauge") FROM stdin;
Jvo33GomD75u41Q3y8ox	energy
zz6Kc6zGd	energy
5yOutD8Lp	energy
uileM8JGQ	energy
3fQyu5KCU	energy
EaeTGcHV2	energy
qFgH3VtCz	energy
esgo0rr1G	energy
DwlWijqgg	energy
zWGn-Bles	energy
Y2QJZIKnAfhvL7PSeiNF	energy
_cjvj91BX	energy
4zC0EoxJr	energy
3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402	energy
DKZsetA4osbrXnntY8D8	energy
WC51eGlMy	energy
wkiO3xOVaoztd6FGiLps	energy
xMFhmfmYa	energy
\.


--
-- Data for Name: territory_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."territory_tiers" ("id", "min_places", "title") FROM stdin;
1	3	Campement
2	5	Avant-Poste
3	8	Domaine
4	12	Seigneurie
5	17	Baronnie
6	22	Comté
7	30	Duché
8	45	Royaume
9	70	Empire
\.


--
-- Data for Name: titles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."titles" ("id", "name", "type", "faction_id", "order", "icon", "unlocks", "created_at", "condition", "description") FROM stdin;
12	Vercingétorix	faction	faction-celtique	11	👑	{}	2026-02-25 13:20:12.436722+00	{"rank": 1, "stat": "notoriety"}	\N
11	Rex Imperator	faction	faction-romaine	10	👑	{}	2026-02-24 19:03:01.970639+00	{"rank": 1, "stat": "notoriety"}	\N
18	Bâtisseur	general	\N	6	🪚	{}	2026-03-25 19:28:19.077811+00	{"min": 100, "stat": "fortifications"}	Vous avez construit + de 100 fortifications
19	Bâtisseur de cathédrales	general	\N	7	⚒️	{}	2026-03-25 19:29:06.020258+00	{"min": 500, "stat": "fortifications"}	Vous avez érigés + de 500 fortifications
10	Basiléus	faction	faction-byzantine	10	🥇	{}	2026-02-24 19:02:51.893512+00	{"rank": 1, "stat": "notoriety"}	Vous êtes le chef de votre faction. Bravo ! 
13	Prélat	faction	faction-byzantine	1	🥈	{}	2026-02-25 14:14:24.460562+00	{"rank": 5, "stat": "notoriety"}	Vous êtes un officier de votre faction
5	Veilleur	general	\N	4	⚔️	{}	2026-02-24 18:18:21.610771+00	{"min": 25, "stat": "claims"}	Vous veillez sur plus de 25 lieux.
17	Protecteur émérite	general	\N	5	⚔️	{}	2026-03-25 19:27:26.848402+00	{"min": 100, "stat": "claims"}	Vous veillez sur plus de 100 lieux 
2	Explorateur	general	\N	1	🧭	{add_place}	2026-02-24 18:18:21.610771+00	{"min": 5, "stat": "discoveries"}	Vous avez découverts + de 5 lieux.
22	Grand Chroniqueur	general	\N	9	📜	{}	2026-04-03 15:26:10.059261+00	{"min": 100, "stat": "places_added"}	Ajoutez plus de 100 lieux
23	Héros local	general	\N	20	🏛️	{}	2026-04-09 00:09:28.311061+00	{"rank": 5, "stat": "glory"}	Top 5 Gloire
14	Ambacte	faction	faction-celtique	1	🌿	{}	2026-02-25 23:14:05.80435+00	{"rank": 5, "stat": "notoriety"}	\N
8	Roi	faction	faction-nordique	10	👑	{}	2026-02-24 18:20:35.843557+00	{"rank": 1, "stat": "notoriety"}	\N
15	Centurion	faction	faction-romaine	1	⚡	{}	2026-02-25 23:14:28.530559+00	{"rank": 5, "stat": "notoriety"}	\N
9	Jarl	faction	faction-nordique	2	⚓	{}	2026-02-24 19:01:47.436991+00	{"rank": 5, "stat": "notoriety"}	\N
24	Héros régional	general	\N	21	🦅	{}	2026-04-09 00:09:28.311061+00	{"rank": 3, "stat": "glory"}	Top 3 Gloire
20	Légende	general	\N	8	⭐	{}	2026-03-25 19:30:26.556406+00	{"rank": 1, "stat": "glory"}	Vous avez la meilleure notoriété de la carte
25	Pèlerin	general	\N	30	🥾	{}	2026-04-09 00:09:28.311061+00	{"rank": 5, "stat": "exploration"}	Top 5 Exploration
26	Arpenteur	general	\N	31	🧭	{}	2026-04-09 00:09:28.311061+00	{"rank": 3, "stat": "exploration"}	Top 3 Exploration
27	Marcheur des Mondes	general	\N	32	🌍	{}	2026-04-09 00:09:28.311061+00	{"rank": 1, "stat": "exploration"}	Top 1 Exploration
28	Érudit	general	\N	40	📜	{}	2026-04-09 00:09:28.311061+00	{"rank": 5, "stat": "erudition"}	Top 5 Érudition
16	Hersir	faction	faction-nordique	0	\N	{}	2026-03-25 17:09:06.314924+00	{"min": 15, "stat": "notoriety"}	\N
1	Novice	general	\N	0	🌱	{}	2026-02-24 18:18:21.610771+00	{"min": 0, "stat": "discoveries"}	Vous venez de vous inscrire... c'est déjà bien 🥳
3	Arpenteur	general	\N	2	🗺️	{}	2026-02-24 18:18:21.610771+00	{"min": 50, "stat": "discoveries"}	Vous avez découverts + de 50 lieux.
29	Philosophe	general	\N	41	🦉	{}	2026-04-09 00:09:28.311061+00	{"rank": 3, "stat": "erudition"}	Top 3 Érudition
30	Grand Sage	general	\N	42	📖	{}	2026-04-09 00:09:28.311061+00	{"rank": 1, "stat": "erudition"}	Top 1 Érudition
31	Éclaireur	general	\N	50	🗺️	{}	2026-04-09 00:09:28.311061+00	{"rank": 5, "stat": "places_added"}	Top 5 Lieux ajoutés
32	Cartographe	general	\N	51	📐	{}	2026-04-09 00:09:28.311061+00	{"rank": 3, "stat": "places_added"}	Top 3 Lieux ajoutés
33	Maître-Cartographe	general	\N	52	🏗️	{}	2026-04-09 00:09:28.311061+00	{"rank": 1, "stat": "places_added"}	Top 1 Lieux ajoutés
\.


--
-- Data for Name: tutorial_slides; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tutorial_slides" ("id", "phase", "position", "title", "body", "image_url", "active", "created_at", "updated_at") FROM stdin;
11	after	1	4 Maisons d'Héritages, 1 Communauté	Choisissez une Maison d'Héritage qui vous correspond ! Chaque saison, les Héritages se disputent amicalement l'influence des lieux, colorant leurs territoires et créant des stratégies. Mais le soir venu, ils sont tous compagnons, et font fleurir ensemble la Rune de Chêne (votre symbole de reconnaissance) sur toutes les contrées.	/res/tuto-heritages.svg	t	2026-04-09 01:57:49.539428+00	2026-04-09 02:20:50.62+00
12	after	2	Explorez des lieux atypiques !	Découvrez ou ajoutez des lieux, de loin ou sur place pour avoir des bonus. Participez en ajoutant vos photos, votre récit, et des informations utiles. Mais attention, vous devrez avant les sortir du brouillard avec vos points d'énergie ⚡	/res/tuto-lieux.svg	t	2026-04-09 01:57:49.620335+00	2026-04-09 02:20:50.695+00
4	after	3	Les Fragments	Chaque achat de vêtements sur le stand ou la boutique officielle vous offre des avantages dans le jeu. Vous pouvez voir les Fragments sur le profil des autres joueurs.\n	/res/tuto-fragments.svg	t	2026-04-09 01:41:14.115523+00	2026-04-09 02:20:50.773+00
5	after	4	Les Enigmes du jour	Chaque jour, 3 énigmes vous attendent dans le coffre. Répondez correctement pour gagner de 📖 l'Erudition et de 🏴 l'Influence. Placez ensuite votre 🏴 influence sur les lieux pour les faire basculer vers votre Héritage.\n	/res/tuto-enigmes.svg	t	2026-04-09 01:41:20.92407+00	2026-04-09 02:20:50.85+00
6	after	5	Gloire et classement	Votre 🎖️ Gloire = 🧭 Exploration + 📖 Erudition. Grimpez le classement et portez votre Héritage vers la victoire. Devenez un Explorateur Erudit. Un porteur de la Runes de Chêne.	/res/tuto-gloire.svg	t	2026-04-09 01:41:24.892109+00	2026-04-09 02:20:50.933+00
1	before	1	Bienvenue, voyageur !	La Carte Runes de Chêne est un jeu d'exploration historique et culturelle développé par la marque de vêtement éponyme. Ici, chaque lieu est une invitation à redécouvrir sa contrée et à s'évader du monde moderne.	/res/tuto-bienvenue.svg	t	2026-04-09 01:40:51.893031+00	2026-04-09 02:20:51.024+00
2	before	2	Notre philosophie	Nous croyons que la connaissance du passé forge l'avenir et participe à créer des âmes valeureuses, capables d'éclairer le XXIème siècle. Ce jeu est une invitation a redécouvrir et à veiller sur le patrimoine qui vous entoure, a pied, ou à distance. Seul, ou avec des compagnons d'aventure solidaires.	/res/tuto-philosophie.svg	t	2026-04-09 01:41:07.331766+00	2026-04-09 02:20:51.098+00
\.


--
-- Name: activity_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."activity_log_id_seq"', 34931, true);


--
-- Name: ad_screens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."ad_screens_id_seq"', 8, true);


--
-- Name: ad_tips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."ad_tips_id_seq"', 8, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."chat_messages_id_seq"', 1887, true);


--
-- Name: contribution_votes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."contribution_votes_id_seq"', 188, true);


--
-- Name: enigma_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."enigma_responses_id_seq"', 772, true);


--
-- Name: enigmas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."enigmas_id_seq"', 301, true);


--
-- Name: fragment_words_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."fragment_words_id_seq"', 42, true);


--
-- Name: mikro_orm_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."mikro_orm_migrations_id_seq"', 10, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."notifications_id_seq"', 256, true);


--
-- Name: place_claims_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_claims_id_seq"', 1610, true);


--
-- Name: place_contributions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_contributions_id_seq"', 2705, true);


--
-- Name: place_explorers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_explorers_id_seq"', 13090, true);


--
-- Name: place_influence_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_influence_id_seq"', 9489, true);


--
-- Name: place_ratings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_ratings_id_seq"', 15, true);


--
-- Name: place_wishlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."place_wishlist_id_seq"', 85, true);


--
-- Name: purchase_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."purchase_log_id_seq"', 125, true);


--
-- Name: shopify_unlocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."shopify_unlocks_id_seq"', 8, true);


--
-- Name: territory_tiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."territory_tiers_id_seq"', 9, true);


--
-- Name: title_fragments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."title_fragments_id_seq"', 10, true);


--
-- Name: titles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."titles_id_seq"', 33, true);


--
-- Name: tutorial_slides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."tutorial_slides_id_seq"', 12, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict xI89Ik6qEvlLid4fisXO3jfmrgSVlLoLdO7mbVBHCSmWrvRT9svt6dP1DygFGJS

RESET ALL;
