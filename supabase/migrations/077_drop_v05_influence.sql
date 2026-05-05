-- 077_drop_v05_influence.sql
-- WHY : Phase 5 (La Cour) remplace tout le système d'influence V0.5. Avant de
-- pouvoir DROP les tables `place_influence` / `user_place_influence` et la
-- colonne `users.influence_stock`, on doit réécrire les RPCs encore actives
-- qui les référencent. Ordre :
--   1. Réécrire `revisit_place_gps` sans influence_stock (verbatim mig 006 - 4 lignes).
--   2. Réécrire `get_player_profile` sans influenceStock dans le retour JSON
--      (verbatim mig 032 - cette ligne).
--   3. DROP les RPCs V0.5 (place_influence_action, _place_influence_action_internal).
--   4. DROP les tables V0.5 (user_place_influence, place_influence).
--   5. ALTER TABLE users DROP COLUMN influence_stock.
--
-- Les RPCs `_answer_enigma_internal` (mig 069) et `_answer_fragment_enigma_internal`
-- (mig 070) écrivent aussi influence_stock — elles seront réécrites par la
-- mig 080 (Couronnes énigmes) APPLIQUÉE IMMÉDIATEMENT APRÈS celle-ci. Entre 077
-- et 080, ces deux RPCs planteront en cas d'appel (colonne droppée). Donc :
-- appliquer 077 → 080 en série rapprochée. Pas de fenêtre prod intermédiaire.
--
-- favoritePlaces et influencePlaced de get_player_profile lisent activity_log
-- type='place_influence' (logs historiques V0.5) — pas la colonne droppée. On
-- garde tel quel, ces calculs continueront de fonctionner sur les logs existants.

BEGIN;

-- ============================================================
-- 1. revisit_place_gps — verbatim mig 006 sans influence_stock
-- ============================================================

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

  -- V077 : retiré `influence_stock = influence_stock + v_stock_gain,` (colonne droppée).
  -- Le `stockGain` reste retourné dans le JSON (sémantique conservée pour le frontend),
  -- mais n'a plus d'effet sur DB. À terme, retirer aussi `stockGain` du JSON et de
  -- la grille de calcul si plus jamais consommé côté frontend.
  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING exploration_points INTO v_new_exploration;

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
    'newExploration',    v_new_exploration,
    'visitNumber',       v_visit_count + 1,
    'nextVisitGain',     v_next_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO service_role;

-- ============================================================
-- 2. get_player_profile — verbatim mig 032 sans influenceStock dans le JSON
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_favorite_places JSON;
  v_veilled_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_influence_placed INT;
  v_glory INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
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

  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at
    ) AS place_data,
    stats.last_visited_at
    FROM (
      SELECT pe.place_id,
             COUNT(*) AS visits_count,
             MAX(pe.visited_at) AS last_visited_at
      FROM public.place_explorers pe
      WHERE pe.user_id = p_user_id
      GROUP BY pe.place_id
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points,
      'lastActionAt', stats.last_action_at
    ) AS place_data,
    stats.total_points
    FROM (
      SELECT al.place_id,
             SUM((al.data->>'points')::INT) AS total_points,
             MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id
        AND al.type = 'place_influence'
        AND al.place_id IS NOT NULL
      GROUP BY al.place_id
      ORDER BY total_points DESC
      LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
  ) sub;

  -- V0.7 phase 3.5 — Lieux ACTUELLEMENT veillés (state en cours)
  -- pour l'onglet "Veillés" du profil (remplace "Influencés").
  SELECT COALESCE(json_agg(place_data ORDER BY planted_at DESC), '[]'::json) INTO v_veilled_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'plantedAt', pv.planted_at,
      'memberCount', (SELECT count(*)::int FROM public.expedition_members em2 WHERE em2.expedition_id = pv.expedition_id)
    ) AS place_data,
    pv.planted_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    JOIN public.places p ON p.id = pv.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    ORDER BY pv.planted_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(SUM((al.data->>'points')::INT), 0) INTO v_influence_placed
  FROM activity_log al
  WHERE al.actor_id = p_user_id AND al.type = 'place_influence';

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores
  FROM public.place_explorers WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE em.user_id = p_user_id;

  SELECT COUNT(*) INTO v_enigmas_solved
  FROM public.enigma_responses
  WHERE user_id = p_user_id AND correct = TRUE;

  v_glory :=
      COALESCE(v_lieux_explores, 0) * 1
    + COALESCE((SELECT COUNT(*)            FROM public.places              WHERE author_id = p_user_id), 0) * 7
    + COALESCE((SELECT COUNT(*)            FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet'), 0) * 3
    + COALESCE((SELECT SUM(
          COALESCE(jsonb_array_length(images), 0)
          + CASE
              WHEN (images IS NULL OR jsonb_array_length(images) = 0)
               AND image_url IS NOT NULL AND image_url != ''
              THEN 1 ELSE 0
            END
        )::int FROM public.place_contributions WHERE user_id = p_user_id), 0) * 1
    + COALESCE((SELECT COUNT(*)            FROM public.veille_history     WHERE user_id = p_user_id), 0) * 5
    + COALESCE(v_enigmas_solved, 0) * 1;

  -- V077 : retiré `'influenceStock', COALESCE(u.influence_stock, 0),` du JSON.
  -- influencePlaced reste calculé depuis activity_log historique (V0.5).
  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'explorationPoints', COALESCE(u.exploration_points, 0),
    'eruditionPoints', COALESCE(u.erudition_points, 0),
    'influencePlaced', v_influence_placed,
    'glory', v_glory,
    'lieuxExplores', COALESCE(v_lieux_explores, 0),
    'lieuxVeilles',  COALESCE(v_lieux_veilles, 0),
    'enigmasSolved', COALESCE(v_enigmas_solved, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'veilledPlaces', v_veilled_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(text) TO authenticated, anon, service_role;

-- ============================================================
-- 3. DROP RPCs V0.5
-- ============================================================

DROP FUNCTION IF EXISTS public.place_influence_action(text, text, integer, numeric, numeric, text);
DROP FUNCTION IF EXISTS public._place_influence_action_internal(text, text, integer, numeric, numeric, text);

-- ============================================================
-- 4. DROP tables V0.5
-- ============================================================

DROP TABLE IF EXISTS public.user_place_influence;
DROP TABLE IF EXISTS public.place_influence;

-- ============================================================
-- 5. DROP colonne users.influence_stock
-- ============================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS influence_stock;

COMMIT;
