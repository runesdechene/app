-- 032_titles_glory_and_faction_influence.sql
-- 1. get_user_titles : notoriety → gloire (exploration + erudition)
-- 2. get_faction_members : ajouter influence placée par membre

-- ============================================================
-- 1. get_user_titles — gloire = exploration_points + erudition_points
-- ============================================================
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

-- ============================================================
-- 2. get_faction_members — ajouter influence placée par membre
-- ============================================================
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
