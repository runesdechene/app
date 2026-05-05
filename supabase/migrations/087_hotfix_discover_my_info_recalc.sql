-- 087_hotfix_discover_my_info_recalc.sql
-- WHY : HOTFIX URGENT 3/3. La mig 077 a droppé influence_stock + tables
-- place_influence + user_place_influence. 3 RPCs encore actives plantent
-- en cascade :
--
--   1. discover_place (baseline mig 001 ligne 1998) — retourne 'newInfluenceStock'
--      (SELECT influence_stock FROM users …) → plante. Conséquence : impossible
--      de découvrir un lieu, énergie ne décroît pas (signalé Uriel 5/05 nuit).
--
--   2. get_my_informations (mig 012, dernière version) — JSON contient
--      'influenceStock' → plante. Cascade : usePlayer rate son init au login.
--
--   3. recalc_place_content_points (mig 014, dernière version) — UPDATE/INSERT
--      sur place_influence + user_place_influence droppées → plante.
--      Appelée en PERFORM par 8 fonctions baseline (contribute, etc.).
--
-- FIX :
--   1+2 : retirer la ligne 'newInfluenceStock' / 'influenceStock' du retour JSON.
--   3 : transformer recalc_place_content_points en NO-OP (la mécanique V0.5
--       de content_points est obsolète depuis V0.7 — la veille remplace).
--
-- Cause profonde : encore une fois, audit DROP TABLE/COLUMN incomplet. La mig 077
-- aurait dû lister ALL fonctions encore actives qui touchent place_influence,
-- user_place_influence ou users.influence_stock, et les réécrire toutes.

BEGIN;

-- ============================================================
-- 1. discover_place — verbatim baseline sans newInfluenceStock
-- ============================================================

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id    text,
  p_place_id   text,
  p_method     text DEFAULT 'remote',
  p_user_lat   numeric DEFAULT NULL,
  p_user_lng   numeric DEFAULT NULL,
  p_free       boolean DEFAULT false,
  p_glory_mult numeric DEFAULT 1
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
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

  SELECT latitude, longitude INTO v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_method := 'remote';
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_m := 6371000 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_place_lat - p_user_lat) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(v_place_lat)) *
      POWER(SIN(RADIANS(v_place_lng - p_user_lng) / 2), 2)
    ));
    IF v_distance_m <= v_proximity_m THEN
      v_method := 'gps';
    END IF;
  END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF v_method = 'gps' THEN
    v_cost := 0;
  ELSE
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

  IF v_method = 'gps' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := 1;
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  -- V087 : retiré 'newInfluenceStock' (colonne droppée mig 077)
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0
  );
END;
$$;

GRANT ALL ON FUNCTION public.discover_place(text, text, text, numeric, numeric, boolean, numeric)
  TO anon, authenticated, service_role;

-- ============================================================
-- 2. get_my_informations — verbatim mig 012 sans influenceStock
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_informations(p_user_id text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
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

  -- V087 : retiré 'influenceStock' (colonne droppée mig 077)
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
    'glory', COALESCE(v_user.exploration_points, 0) + COALESCE(v_user.erudition_points, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_informations(text)
  TO authenticated, anon, service_role;

-- ============================================================
-- 3. recalc_place_content_points — NO-OP
-- ============================================================
-- La mécanique V0.5 de content_points dans place_influence est obsolète.
-- La fonction est appelée en PERFORM par 8 fonctions baseline (contribute,
-- vote_carnet, etc.). On la garde existante pour ne pas casser ces appels,
-- mais elle ne fait plus rien.

CREATE OR REPLACE FUNCTION public.recalc_place_content_points(p_place_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- V087 : NO-OP. place_influence + user_place_influence droppées par mig 077.
  -- Le système V0.5 de content_points est remplacé par la Veille V0.7 (place_veille)
  -- et la Cour V0.7 phase 5 (place_court_score). Cette RPC n'a plus d'effet.
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_place_content_points(text)
  TO authenticated, anon, service_role;

COMMIT;
