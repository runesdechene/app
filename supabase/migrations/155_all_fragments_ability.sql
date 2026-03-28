-- ============================================
-- MIGRATION 155 : Retourner ability_type dans get_all_fragments
-- ============================================

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
      tf.bonus_type, tf.bonus_value,
      tf.ability_type, tf.ability_cooldown_hours,
      EXISTS (
        SELECT 1 FROM user_fragments uf
        WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id
      ) AS owned
    FROM title_fragments tf
    WHERE tf.visible = true
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fragments(TEXT) TO anon;
