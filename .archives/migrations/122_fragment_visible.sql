-- ============================================
-- MIGRATION 122 : Champ visible sur les fragments
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;

-- Mettre a jour get_all_fragments pour filtrer
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
