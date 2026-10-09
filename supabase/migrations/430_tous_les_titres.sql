-- WHY: la page « Tous les titres » (spec 2026-10-06-v2-tous-les-titres-design). Un nouveau chemin
--      récompense l'enrichissement : places_enriched = lieux des autres où l'on a écrit au moins une
--      version (versions_lieu, historique V1 compris depuis la mig 416), comptés une fois chacun.
--      get_mes_titres() range tous les titres par chemin pour la page, en lecture seule.
-- SCHEMA CHECKED (06/10/2026) : versions_lieu(place_id, auteur varchar) ; places(id, author_id varchar) ;
--      users(id, displayed_title_ids_v3 int[]) ; titles(id, name, type, "order", icon, unlocks,
--      condition, description, faction_id) ; max("order") général = 83 ; les quatre noms n'existent pas.
--      get_user_titles : définition live (pg_get_functiondef, 06/10) copiée entière, identique à la
--      mig 082 ; quatre ajouts marqués « 430 ».

-- 1. get_user_titles : le compteur places_enriched
CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_faction_id TEXT;
  v_xp_total INT;
  v_level INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_places_visited INT;
  v_places_added INT;
  v_places_enriched INT;
  v_carnets INT;
  v_plantages INT;
  v_enigma_score INT;
  v_mecenat_total INT;
  v_mecenat_top1_count INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
  v_player_coupe_score INT;
  v_season_start timestamptz;
  v_season_end   timestamptz;
BEGIN
  -- Compteurs joueur (V0.7)
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT place_id) INTO v_places_visited FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;
  -- 430 : lieux des autres enrichis, une fois chacun
  SELECT COUNT(DISTINCT v.place_id) INTO v_places_enriched
  FROM public.versions_lieu v JOIN public.places p ON p.id = v.place_id
  WHERE v.auteur = p_user_id AND p.author_id IS DISTINCT FROM p_user_id;
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';
  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;
  v_enigma_score := public._enigma_score_weighted(p_user_id);

  -- V082 : compteurs Mécénat
  SELECT COALESCE(SUM(amount), 0)::INT INTO v_mecenat_total
  FROM public.place_court_action
  WHERE user_id = p_user_id;

  -- Nombre de lieux où le user est #1 mécène (cumulatif à vie)
  WITH per_place AS (
    SELECT place_id, user_id, SUM(amount) AS total
    FROM public.place_court_action
    GROUP BY place_id, user_id
  ),
  ranked AS (
    SELECT place_id, user_id, total,
           ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY total DESC, user_id) AS rk
    FROM per_place
  )
  SELECT COUNT(*)::INT INTO v_mecenat_top1_count
  FROM ranked WHERE rk = 1 AND user_id = p_user_id;

  -- xp_total + niveau dérivé
  SELECT COALESCE(xp_total, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_xp_total, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);

  -- Évaluation des titres généraux (threshold sur les compteurs étendus)
  -- V082 : ajout 2 nouvelles stats (mecenat_total, mecenat_top1_count)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'order', t."order", 'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'level'              THEN v_level >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'discoveries'        THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_visited'     THEN v_places_visited >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'enigma_score'       THEN v_enigma_score >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'plantages'          THEN v_plantages >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added'       THEN v_places_added >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'carnets'            THEN v_carnets >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_total'      THEN v_mecenat_total >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_top1_count' THEN v_mecenat_top1_count >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_enriched'    THEN v_places_enriched >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t WHERE t.type = 'general' ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction (verbatim mig 068)
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
    IF v_season_start IS NULL THEN
      v_season_start := 'epoch'::timestamptz;
      v_season_end   := now();
    END IF;

    SELECT s.faction_rank, s.coupe_score
    INTO v_player_rank, v_player_coupe_score
    FROM public._faction_member_scores(v_faction_id, v_season_start, v_season_end) s
    WHERE s.user_id = p_user_id;

    IF v_player_coupe_score IS NULL OR v_player_coupe_score <= 0 THEN
      v_faction2 := NULL;
    ELSE
      SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'type', 'faction')
      INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
        AND t.condition IS NOT NULL AND (t.condition->>'rank') IS NOT NULL
        AND v_player_rank <= (t.condition->>'rank')::INT
      ORDER BY (t.condition->>'rank')::INT ASC
      LIMIT 1;
    END IF;
  END IF;

  -- V082 : ajout mecenat_total et mecenat_top1_count dans stats
  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((SELECT json_agg(elem) FROM unnest(v_general_arr) AS elem WHERE (elem->>'unlocked')::boolean = true), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'level', v_level,
      'xpTotal', v_xp_total,
      'discoveries', v_discoveries,
      'places_visited', v_places_visited,
      'places_added', v_places_added,
      'carnets', v_carnets,
      'plantages', v_plantages,
      'enigma_score', v_enigma_score,
      'mecenat_total', v_mecenat_total,
      'mecenat_top1_count', v_mecenat_top1_count,
      'places_enriched', v_places_enriched
    )
  );
END;
$function$;

-- 2. Les quatre titres du chemin « Les lieux enrichis »
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Glaneur',              'general', NULL, 90, '🌾', '{}'::text[], '{"stat":"places_enriched","min":1}'::jsonb,   'Tu as enrichi ton premier lieu.'),
  ('Copiste',              'general', NULL, 91, '🪶', '{}'::text[], '{"stat":"places_enriched","min":10}'::jsonb,  'Tu as enrichi 10 lieux.'),
  ('Enlumineur',           'general', NULL, 92, '🖋️', '{}'::text[], '{"stat":"places_enriched","min":50}'::jsonb,  'Tu as enrichi 50 lieux.'),
  ('Gardien des Mémoires', 'general', NULL, 93, '🗝️', '{}'::text[], '{"stat":"places_enriched","min":200}'::jsonb, 'Tu as enrichi 200 lieux.');

-- 3. La page : tous mes titres, rangés par chemin vivant ; les chemins refermés ne montrent que
--    ce qui est déjà gagné (« D'une autre époque »). Les chemins vivants ne sont écrits qu'ici.
CREATE FUNCTION public.get_mes_titres()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi     text := auth.uid()::text;
  v_vivants text[] := ARRAY['level', 'places_visited', 'places_added', 'places_enriched'];
  v_titres  json;
  v_obtenus int[];
  v_portes  int[];
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'non connecté';
  END IF;
  v_titres := public.get_user_titles(v_moi);
  SELECT COALESCE(array_agg((e->>'id')::int), '{}') INTO v_obtenus
    FROM json_array_elements(v_titres->'unlockedGeneralTitles') e;
  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_portes FROM users WHERE id = v_moi;

  RETURN json_build_object(
    'obtenus', cardinality(v_obtenus),
    'total', (SELECT count(*) FROM titles t
               WHERE t.type = 'general'
                 AND (t.condition->>'stat' = ANY (v_vivants) OR t.id = ANY (v_obtenus))),
    'chemins', (SELECT json_agg(json_build_object(
        'stat', c.stat,
        'compteur', COALESCE((v_titres->'stats'->>c.stat)::int, 0),
        'titres', (SELECT COALESCE(json_agg(json_build_object(
                      'id', t.id, 'nom', t.name, 'min', (t.condition->>'min')::int,
                      'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
                    ORDER BY (t.condition->>'min')::int), '[]'::json)
                   FROM titles t WHERE t.type = 'general' AND t.condition->>'stat' = c.stat))
      ORDER BY c.ordre)
      FROM unnest(v_vivants) WITH ORDINALITY AS c(stat, ordre)),
    'autreEpoque', (SELECT COALESCE(json_agg(json_build_object(
        'id', t.id, 'nom', t.name, 'condition', t.condition, 'porte', t.id = ANY (v_portes))
      ORDER BY t."order"), '[]'::json)
      FROM titles t
      WHERE t.type = 'general' AND t.id = ANY (v_obtenus)
        AND NOT (t.condition->>'stat' = ANY (v_vivants)))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mes_titres() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mes_titres() TO authenticated;
