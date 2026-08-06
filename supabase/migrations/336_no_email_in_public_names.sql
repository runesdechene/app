-- 336 — Aucun email dans un nom affiche publiquement (RGPD)
--
-- WHY : les comptes qui ne terminent pas l'inscription n'ont ni display_name ni
-- first_name. Or 6 fonctions live retombaient sur `email_address` comme dernier
-- COALESCE pour construire le nom PUBLIC d'un joueur. Resultat constate le
-- 6 aout 2026 : 444 comptes sur 4904 affichaient leur adresse email comme pseudo
-- (profil, classement, membres de compagnie, votes de territoire) et 122 entrees
-- du fil d'activite public contenaient une adresse email en clair.
-- Donnee personnelle publiee sans base legale -> a corriger et a purger.
--
-- QUOI :
--   1. helper `user_public_name()` — seule source du nom public, ne peut PAS
--      retomber sur un email (et rejette toute valeur contenant '@').
--   2. les 6 fonctions concernees repartent de leur definition LIVE
--      (pg_get_functiondef), delta email_address uniquement.
--   3. purge des 122 activity_log deja publies.
--   4. la colonne users.email_address n'est plus lisible par le role `anon`
--      (la cle anon est publique : elle permettait un dump des 4904 emails).
--
-- Reste a faire hors de cette migration (casse le boot de l'app si fait ici) :
-- le role `authenticated` peut encore lire email_address sur toutes les lignes,
-- car usePlayer.ts identifie le joueur par `.eq('email_address', user.email)`.

-- ---------------------------------------------------------------------------
-- 1. Helper : le nom public d'un joueur
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_public_name(
  p_user_id      text,
  p_display_name text,
  p_first_name   text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN btrim(COALESCE(p_display_name, '')) <> ''
         AND p_display_name NOT LIKE '%@%'  THEN btrim(p_display_name)
    WHEN btrim(COALESCE(p_first_name, '')) <> ''
         AND p_first_name   NOT LIKE '%@%'  THEN btrim(p_first_name)
    ELSE 'Explorateur ' || upper(substr(md5(COALESCE(p_user_id, 'anon')), 1, 4))
  END;
$fn$;

COMMENT ON FUNCTION public.user_public_name(text, text, text) IS
  'Nom public d''un joueur. Ne retombe JAMAIS sur email_address (RGPD, mig 336).';

-- ---------------------------------------------------------------------------
-- 2. Fonctions repatchees (bases sur pg_get_functiondef du 6 aout 2026)
-- ---------------------------------------------------------------------------

-- log_new_user_activity
CREATE OR REPLACE FUNCTION public.log_new_user_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$

DECLARE

  v_name TEXT;

BEGIN

  v_name := public.user_public_name(NEW.id, NEW.display_name, NEW.first_name);



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

-- _create_place_internal
CREATE OR REPLACE FUNCTION public._create_place_internal(p_user_id text, p_title text, p_latitude real, p_longitude real, p_tag_id text, p_images jsonb DEFAULT '[]'::jsonb, p_address text DEFAULT ''::text, p_text text DEFAULT ''::text, p_user_lat real DEFAULT NULL::real, p_user_lng real DEFAULT NULL::real, p_carnet_title text DEFAULT NULL::text, p_era_id text DEFAULT NULL::text, p_year_exact integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  v_desc_text      text;
  v_user_pos_provided boolean;
  v_auto_expedition_id uuid;
  v_solo_bonus         integer;
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

  v_user_pos_provided := (p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL);

  IF v_user_pos_provided THEN
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

    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;

    IF v_faction_id IS NOT NULL THEN
      v_solo_bonus := COALESCE(
        (SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),
        50
      );

      INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
      VALUES (v_new_id, false, v_faction_id, NULL, NOW())
      RETURNING id INTO v_auto_expedition_id;

      INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
      VALUES (v_auto_expedition_id, p_user_id, v_faction_id);

      INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
      VALUES (v_new_id, v_auto_expedition_id, v_faction_id, false, NOW(), false, NULL, p_user_id);

      INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
      VALUES (v_new_id, p_user_id, v_auto_expedition_id, p_user_id, 'plant_bonus', v_solo_bonus);

      INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
      VALUES (v_new_id, v_auto_expedition_id, p_user_id, v_faction_id, false, NOW());

      INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
      VALUES ('plant_flag', p_user_id, v_new_id, v_faction_id,
        jsonb_build_object(
          'placeTitle',   p_title,
          'isNeutral',    false,
          'expeditionId', v_auto_expedition_id,
          'memberCount',  1,
          'fromCreate',   true,
          'plantBonus',   v_solo_bonus
        ));
    END IF;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  v_desc_text := NULLIF(TRIM(p_text), '');
  IF v_desc_text IS NOT NULL THEN
    INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
    VALUES (v_new_id, p_user_id, v_faction_id, 'description', v_desc_text, NOW(), NOW());

    INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
    VALUES (v_new_id, v_desc_text, p_user_id, NOW());
  END IF;

  PERFORM recalc_place_content_points(v_new_id);

  SELECT public.user_public_name(id, display_name, first_name) INTO v_actor_name
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
      'permanent', v_is_gps,
      'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
      'userPosProvided', v_user_pos_provided,
      'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
    'userPosProvided', v_user_pos_provided,
    'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps,
      'plantBonus', CASE WHEN v_is_gps AND v_faction_id IS NOT NULL THEN COALESCE(v_solo_bonus, 50) ELSE 0 END
    )
  );
END;
$$;

-- get_faction_members
CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
DECLARE
  v_season_start timestamptz;
  v_season_end   timestamptz;
  v_result json;
BEGIN
  SELECT started_at, COALESCE(ended_at, now())
  INTO v_season_start, v_season_end
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  IF v_season_start IS NULL THEN
    v_season_start := 'epoch'::timestamptz;
    v_season_end   := now();
  END IF;

  SELECT COALESCE(json_agg(member ORDER BY coupe_score DESC, glory DESC, user_id), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      json_build_object(
        'userId',        u.id,
        'name',          public.user_public_name(u.id, u.display_name, u.first_name),
        'profileImage',  u.avatar_url,
        'glory',         s.glory,
        'coupeScore',    s.coupe_score,
        'factionTitle2', t.title_obj
      ) AS member,
      s.glory       AS glory,
      s.coupe_score AS coupe_score,
      u.id          AS user_id
    FROM public._faction_member_scores(p_faction_id, v_season_start, v_season_end) s
    JOIN public.users u ON u.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT json_build_object(
        'id',      tt.id,
        'name',    tt.name,
        'icon',    tt.icon,
        'unlocks', tt.unlocks,
        'type',    'faction'
      ) AS title_obj
      FROM public.titles tt
      WHERE tt.type = 'faction'
        AND tt.faction_id = p_faction_id
        AND tt.condition IS NOT NULL
        AND (tt.condition->>'rank') IS NOT NULL
        AND s.coupe_score > 0
        AND s.faction_rank <= (tt.condition->>'rank')::int
      ORDER BY (tt.condition->>'rank')::int ASC
      LIMIT 1
    ) t ON TRUE
  ) sub;

  RETURN v_result;
END;
$$;

-- get_leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_type text, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY u.xp_total DESC, u.id),
        'userId',       u.id,
        'name',         public.user_public_name(u.id, u.display_name, u.first_name),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        public._level_from_xp(u.xp_total),
        'xpTotal',      u.xp_total
      ) AS row_data
      FROM public.users u
      LEFT JOIN public.factions f ON f.id = u.faction_id
      WHERE u.xp_total > 0
      ORDER BY u.xp_total DESC, u.id
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    -- Inchangé (mig 038)
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId',       u.id,
        'name',         public.user_public_name(u.id, u.display_name, u.first_name),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(*)::int
      ) AS row_data
      FROM public.users u
      JOIN public.places p ON p.author_id = u.id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'veilled' THEN
    -- Inchangé (mig 027)
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT pv.place_id) DESC),
        'userId',       u.id,
        'name',         public.user_public_name(u.id, u.display_name, u.first_name),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(DISTINCT pv.place_id)::int
      ) AS row_data
      FROM public.users u
      JOIN public.expedition_members em ON em.user_id = u.id
      JOIN public.place_veille pv ON pv.expedition_id = em.expedition_id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.avatar_url, f.color
      ORDER BY COUNT(DISTINCT pv.place_id) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

-- get_player_profile
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id text)
 RETURNS json
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
  v_favorite_places JSON;
  v_veilled_places JSON;
  v_wishlist_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_xp_total INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_for_next_level INT;
  v_xp_for_current_level INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
  v_crowns_balance INT;
  v_coupe_season public.coupe_seasons%ROWTYPE;
  v_coupe_window_end timestamptz;
  v_coupe_score_current_season INT;
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

  SELECT COALESCE(displayed_title_ids_v3, '{}'), COALESCE(xp_total, 0)
    INTO v_displayed_v3, v_xp_total
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);
  v_xp_for_current_level := public._xp_for_level(v_level);
  v_xp_for_next_level := public._xp_for_level(v_level + 1);
  v_xp_to_next := GREATEST(0, v_xp_for_next_level - v_xp_total);

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
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data,
    stats.last_visited_at
    FROM (
      SELECT pe.place_id, COUNT(*) AS visits_count, MAX(pe.visited_at) AS last_visited_at
      FROM public.place_explorers pe
      WHERE pe.user_id = p_user_id
      GROUP BY pe.place_id
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points, 'lastActionAt', stats.last_action_at,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, stats.total_points
    FROM (
      SELECT al.place_id, SUM((al.data->>'points')::INT) AS total_points, MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id AND al.type = 'place_influence' AND al.place_id IS NOT NULL
      GROUP BY al.place_id ORDER BY total_points DESC LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY planted_at DESC), '[]'::json) INTO v_veilled_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'plantedAt', pv.planted_at,
      'memberCount', (SELECT count(*)::int FROM public.expedition_members em2 WHERE em2.expedition_id = pv.expedition_id),
      'byInfluence', COALESCE(pv.by_influence, false),
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, pv.planted_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    JOIN public.places p ON p.id = pv.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    ORDER BY pv.planted_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY created_at DESC), '[]'::json) INTO v_wishlist_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, w.created_at
    FROM public.place_wishlist w
    JOIN public.places p ON p.id = w.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    WHERE w.user_id = p_user_id
    ORDER BY w.created_at DESC LIMIT 500
  ) sub;

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
    WHERE em.user_id = p_user_id;
  SELECT COUNT(*) INTO v_enigmas_solved FROM public.enigma_responses WHERE user_id = p_user_id AND correct = TRUE;

  SELECT COALESCE(balance, 0) INTO v_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_crowns_balance := COALESCE(v_crowns_balance, 0);

  SELECT * INTO v_coupe_season
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  IF v_coupe_season.id IS NOT NULL THEN
    v_coupe_window_end := COALESCE(v_coupe_season.ended_at, now());
    v_coupe_score_current_season := public._user_coupe_score(
      p_user_id, v_coupe_season.started_at, v_coupe_window_end
    );
  ELSE
    v_coupe_score_current_season := 0;
  END IF;

  SELECT json_build_object(
    'userId', u.id, 'name', public.user_public_name(u.id, u.display_name, u.first_name),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'factionImage', f.image_url,
    'allyFactionId', ally.id, 'allyFactionTitle', ally.title,
    'allyFactionColor', ally.color, 'allyFactionPattern', ally.pattern,
    'profileImage', u.avatar_url,
    'level', v_level,
    'xpTotal', v_xp_total,
    'xpToNextLevel', v_xp_to_next,
    'xpForNextLevel', v_xp_for_next_level,
    'xpForCurrentLevel', v_xp_for_current_level,
    'veteranFirstEra', COALESCE(u.veteran_first_era, false),
    'lieuxExplores', COALESCE(v_lieux_explores, 0),
    'lieuxVeilles',  COALESCE(v_lieux_veilles, 0),
    'enigmasSolved', COALESCE(v_enigmas_solved, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'placesAdded', (v_titles_data->'stats'->>'places_added')::INT,
    'carnetsCount', (v_titles_data->'stats'->>'carnets')::INT,
    'plantagesCount', (v_titles_data->'stats'->>'plantages')::INT,
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'veilledPlaces', v_veilled_places,
    'wishlistPlaces', v_wishlist_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles',
    'crownsBalance', CASE WHEN p_user_id = auth.uid()::text THEN COALESCE(v_crowns_balance, 0) ELSE NULL END,
    'coupeScoreCurrentSeason', COALESCE(v_coupe_score_current_season, 0),
    'coupeSeasonName', v_coupe_season.name
  ) INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  LEFT JOIN LATERAL (
    SELECT af.id, af.title, af.color, af.pattern
    FROM faction_members fm JOIN factions af ON af.id = fm.faction_id
    WHERE fm.user_id = u.id AND u.faction_id IS NOT NULL
      AND fm.faction_id <> u.faction_id AND af.retired = false
    ORDER BY fm.joined_at LIMIT 1
  ) ally ON true
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- get_territory_votes
CREATE OR REPLACE FUNCTION public.get_territory_votes(p_anchor_place_id text, p_user_id text, p_blob_place_ids text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_faction         TEXT;
  v_territory_faction    TEXT;
  v_personal_inf         INT;
  v_threshold            INT;
  v_vote_power           INT;
  v_proposals            JSON;
  v_used_votes           INT;
  v_proposals_count      INT;
  v_my_veilled_place_ids TEXT[];
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
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

  -- 3. Supprimer les propositions orphelines elles-mêmes
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 1)
      INTO v_threshold;
    v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));
  ELSE
    v_vote_power := 0;
  END IF;

  -- V103 — liste des lieux du blob où l'user est veilleur direct (pour pill UI)
  SELECT COALESCE(array_agg(DISTINCT pv.place_id), '{}')
  INTO v_my_veilled_place_ids
  FROM place_veille pv
  JOIN expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE pv.place_id = ANY(p_blob_place_ids)
    AND em.user_id = p_user_id
    AND pv.is_neutral = false;

  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

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
          (SELECT json_agg(json_build_object('name', public.user_public_name(u.id, u.display_name, u.first_name), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
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
    'threshold',         COALESCE(v_threshold, 1),
    'myVeilledPlaceIds', COALESCE(v_my_veilled_place_ids, '{}'::text[])
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Purge des emails deja publies dans le fil d'activite
-- ---------------------------------------------------------------------------

UPDATE public.activity_log a
SET data = jsonb_set(
      a.data, '{actorName}',
      to_jsonb(public.user_public_name(a.actor_id, u.display_name, u.first_name)))
FROM public.users u
WHERE u.id = a.actor_id
  AND a.data->>'actorName' LIKE '%@%';

-- Filet : actor_id orphelin ou nul (aucune ligne users en face).
UPDATE public.activity_log a
SET data = jsonb_set(
      a.data, '{actorName}',
      to_jsonb('Explorateur ' || upper(substr(md5(COALESCE(a.actor_id, 'anon')), 1, 4))))
WHERE a.data->>'actorName' LIKE '%@%';

-- ---------------------------------------------------------------------------
-- 4. Coupe l'acces direct de `anon` aux colonnes sensibles de users
-- ---------------------------------------------------------------------------
-- La policy RLS « Allow public read » (USING true) laissait la cle anon —
-- embarquee dans le bundle JS public — faire GET /rest/v1/users?select=email_address
-- et aspirer les 4904 adresses. Les RPC publiques sont SECURITY DEFINER : elles
-- tournent en owner et ne sont pas affectees. Les lectures anon legitimes
-- (nom d'auteur + avatar sur les surfaces publiques) restent ouvertes.
--
-- Un REVOKE par colonne serait sans effet : `anon` detient le SELECT au niveau
-- TABLE, qui prime. On retire donc le SELECT table puis on re-accorde la liste
-- blanche. Effet de bord voulu : toute colonne ajoutee plus tard est invisible
-- a `anon` par defaut.

REVOKE SELECT ON public.users FROM anon;
GRANT  SELECT (id, first_name, display_name, avatar_url, faction_id)
  ON public.users TO anon;
