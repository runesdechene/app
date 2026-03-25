-- ============================================
-- MIGRATION 124 : Retourner image_url du fragment dans get_all_player_titles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id, t.name, t.icon, t.description, NULL AS image_url, t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id, t.name, t.icon, t.description, NULL AS image_url, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (
        SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;
