-- ============================================
-- MIGRATION 115 : Fix get_all_player_titles (3 catégories + unlocked flag)
-- ============================================
-- La 114 a été appliquée avec une ancienne version de la RPC.
-- Cette migration recrée les RPCs avec la bonne logique.
-- ============================================

-- set_displayed_titles_v3 déjà créé en 114, on le recrée au cas où
CREATE OR REPLACE FUNCTION public.set_displayed_titles_v3(
  p_user_id TEXT,
  p_title_ids INT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF array_length(p_title_ids, 1) > 3 THEN
    RETURN json_build_object('error', 'Maximum 3 titres');
  END IF;

  UPDATE users
  SET displayed_title_ids_v3 = COALESCE(p_title_ids, '{}')
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_displayed_titles_v3(TEXT, INT[]) TO authenticated;

-- 3. RPC pour récupérer TOUS les titres (débloqués + verrouillés) en 3 catégories
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
  -- Stats pour vérifier les conditions
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger les titres via get_user_titles pour savoir lesquels sont débloqués
  v_titles_data := get_user_titles(p_user_id);

  -- Titres de jeu (type = general) — TOUS, avec flag unlocked
  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT
      t.id,
      t.name,
      t.icon,
      t."order" AS t_order,
      EXISTS (
        SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = t.id
      ) AS unlocked
    FROM titles t
    WHERE t.type = 'general'
  ) row_data;

  -- Titres de faction — TOUS les titres de la faction du joueur, avec flag unlocked
  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT
        t.id,
        t.name,
        t.icon,
        t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  -- Titres de fragment — TOUS les mots de tous les fragments, avec flag unlocked (possédé)
  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT
      fw.id * -1 AS id,
      fw.word AS name,
      tf.icon,
      tf.name AS frag_name,
      fw.word,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
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
