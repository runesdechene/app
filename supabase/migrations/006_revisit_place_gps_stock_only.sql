-- 006_revisit_place_gps_stock_only.sql
-- WHY : restaure la spec V0.5.7 (commit b3027fb du 8 avril) qui a été perdue
-- par le commit 52e98b9 "restaurer 32 RPCs régressées par re-run accidentel" — la
-- restauration s'est faite à partir d'une version trop ancienne et a écrasé V0.5.7.
--
-- Comportement V0.5.7 attendu :
--   - 1 revisite/jour/lieu (pas 3)
--   - Stock only : pas de place_influence (territoire), uniquement influence_stock perso
--   - Dégressif sur revisites cumulées du couple (user, place) — décourage le farm
--   - Distance: 100m strict (haversine_km > 0.1 → too_far)
--
-- Évolution vs V0.5.7 décidée le 28 avril 2026 :
--   - Base 15 au lieu de 10 (revisite plus généreuse — récompense l'effort de retour)
--   - Grille : 15 / 10 / 5 / 3 / 3 / ... (1ère / 2e / 3e / 4e+ revisite cumulée)
--   - Exploration = stock / 2 (la moitié, comme avant — sera probablement retirée à terme)
--
-- Aussi :
--   - Drop de _revisit_place_gps_internal (plus utilisé après collapse dans le wrapper)
--   - Return shape aligné avec visit_place_gps (stockGain, newInfluenceStock, newExploration,
--     visitNumber, nextVisitGain) pour éviter les mismatches que le frontend a aujourd'hui
--   - Erreur 'already_revisited_today' (et plus 'daily_revisit_limit')
--   - Activity_log enrichi avec actorName, placeTitle, factionColor, factionPattern (ne casse
--     pas les toasts existants côté frontend)

DROP FUNCTION IF EXISTS public.revisit_place_gps(text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public._revisit_place_gps_internal(text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id  text,
  p_place_id text,
  p_user_lat numeric,
  p_user_lng numeric
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id          text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_visit_count         int;
  v_stock_gain          int;
  v_exploration_gain    int;
  v_new_influence_stock int;
  v_new_exploration     int;
  v_actor_name          text;
  v_actor_avatar        text;
  v_faction_color       text;
  v_faction_pattern     text;
  v_next_gain           int;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_visited_yet');
  END IF;

  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
      AND created_at::date = CURRENT_DATE
  ) THEN
    RETURN json_build_object('error', 'already_revisited_today');
  END IF;

  -- Compteur lifetime des revisites de ce couple (user, place)
  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id;

  -- Grille dégressive (lifetime) : 15 / 10 / 5 / 3 / 3 / ...
  v_stock_gain := CASE
    WHEN v_visit_count = 0 THEN 15
    WHEN v_visit_count = 1 THEN 10
    WHEN v_visit_count = 2 THEN 5
    ELSE 3
  END;
  v_exploration_gain := GREATEST(1, v_stock_gain / 2);

  v_next_gain := CASE
    WHEN v_visit_count + 1 = 1 THEN 10
    WHEN v_visit_count + 1 = 2 THEN 5
    ELSE 3
  END;

  UPDATE users SET
    influence_stock    = influence_stock + v_stock_gain,
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING influence_stock, exploration_points INTO v_new_influence_stock, v_new_exploration;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un'), avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'stockGain',       v_stock_gain,
      'explorationGain', v_exploration_gain,
      'visitNumber',     v_visit_count + 1,
      'actorName',       v_actor_name,
      'actorAvatarUrl',  v_actor_avatar,
      'placeTitle',      v_place_title,
      'factionColor',    v_faction_color,
      'factionPattern',  v_faction_pattern
    ));

  RETURN json_build_object(
    'success',           true,
    'stockGain',         v_stock_gain,
    'explorationGain',   v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration',    v_new_exploration,
    'visitNumber',       v_visit_count + 1,
    'nextVisitGain',     v_next_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO service_role;
