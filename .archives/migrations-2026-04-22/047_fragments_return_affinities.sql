-- 047_fragments_return_affinities.sql
-- get_user_fragments + get_all_fragments : retourner les tag affinities
-- au lieu des anciens bonus_type/ability_type (dead code)

-- ============================================================
-- 1. get_user_fragments — ajouter affinities[]
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.icon, tf.icon_url, tf.image_url, tf.link_url,
      tf.collection,
      uf.unlocked_at, uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words,
      (
        SELECT json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'tagIcon', t.icon,
          'tagColor', t.color,
          'bonusPoints', fta.bonus_points
        ))
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      ) AS affinities
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id AND tf.visible = true
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;

-- ============================================================
-- 2. get_all_fragments — ajouter affinities[]
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_fragments(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY owned DESC, name) INTO v_result
  FROM (
    SELECT
      tf.id, tf.name, tf.description, tf.icon, tf.image_url, tf.link_url,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned,
      (
        SELECT json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'tagIcon', t.icon,
          'tagColor', t.color,
          'bonusPoints', fta.bonus_points
        ))
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      ) AS affinities
    FROM title_fragments tf
    WHERE tf.visible = true
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;
