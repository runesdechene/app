-- 049_fix_legende_title_rank.sql
-- Le titre "Légende" (id=20) a condition = {"rank":1, "stat":"notoriety"}
-- Problème : get_user_titles ne gère pas les titres généraux basés sur un rang global
-- Fix : 1) renommer stat notoriety → glory, 2) ajouter la logique rank dans get_user_titles

-- 1. Corriger la condition du titre Légende
UPDATE titles
SET condition = '{"rank": 1, "stat": "glory"}'::jsonb
WHERE id = 20;

-- 2. Réécrire get_user_titles avec support du rang global pour les titres généraux
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

  -- Rang global du joueur par gloire (pour le titre Légende etc.)
  SELECT rk INTO v_glory_rank
  FROM (
    SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk
    FROM users
  ) ranked
  WHERE id = p_user_id;

  -- Titres généraux
  -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous — le bouton "ajouter un lieu" en dépend (bug 182, 186, 191, 193)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE : sans ça le bouton add_place est grisé
      'order', t."order",
      'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        -- Titres basés sur un rang global (ex: Légende = top 1 gloire)
        WHEN (t.condition->>'rank') IS NOT NULL AND t.condition->>'stat' IN ('notoriety', 'glory')
          THEN v_glory_rank <= (t.condition->>'rank')::INT
        -- Titres basés sur un seuil de stat
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

  -- Titre faction : basé sur le rang réel du joueur (par gloire)
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT rk INTO v_player_rank
    FROM (
      SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk
      FROM users
      WHERE faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

    -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous (même raison que pour les titres généraux)
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,  -- ← CRITIQUE
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
