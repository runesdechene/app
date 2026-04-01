-- ============================================
-- MIGRATION 186 : Restaurer le champ "unlocks" dans get_user_titles
-- ============================================
-- La migration 182 a réécrit la fonction mais a oublié le champ unlocks
-- dans le json_build_object. Résultat : le bouton "ajouter un lieu"
-- reste verrouillé car le frontend ne peut plus lire t.unlocks.

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_notoriety INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_general JSON;
  v_faction JSON;
  v_faction2 JSON;
  v_is_top BOOLEAN;
  v_top_check RECORD;
  v_general_arr JSON[] := '{}';
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(notoriety_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_notoriety, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;

  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'order', t."order",
      'type', 'general',
      'unlocks', t.unlocks,
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'notoriety' THEN v_notoriety >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
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
    SELECT id, first_name INTO v_top_check
    FROM users
    WHERE faction_id = v_faction_id AND id != p_user_id
    ORDER BY notoriety_points DESC
    LIMIT 1;

    v_is_top := NOT FOUND OR v_notoriety >= (
      SELECT COALESCE(MAX(notoriety_points), 0)
      FROM users WHERE faction_id = v_faction_id AND id != p_user_id
    );

    IF v_is_top THEN
      SELECT json_build_object(
        'id', t.id,
        'name', t.name,
        'icon', t.icon,
        'unlocks', t.unlocks,
        'type', 'faction'
      ) INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
      ORDER BY t."order" DESC
      LIMIT 1;
    END IF;
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
      'notoriety', v_notoriety,
      'likes', v_likes,
      'fortifications', v_fortifications
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(TEXT) TO authenticated;
