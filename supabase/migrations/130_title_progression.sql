-- ============================================
-- MIGRATION 130 : Progression des titres + admin visible
-- ============================================
-- Retourner les conditions de deblocage + stats du joueur
-- pour afficher la progression dans le title picker
-- Les admins voient aussi les fragments non visibles

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
