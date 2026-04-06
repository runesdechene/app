-- ============================================
-- MIGRATION 108 : Lien URL par fragment
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Mettre a jour get_user_fragments pour retourner link_url
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
      tf.id,
      tf.name,
      tf.icon,
      tf.image_url,
      tf.link_url,
      tf.collection,
      tf.bonus_type,
      tf.bonus_value,
      uf.unlocked_at,
      uf.source,
      (
        SELECT json_agg(json_build_object(
          'id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender
        ))
        FROM fragment_words fw WHERE fw.fragment_id = tf.id
      ) AS words
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
    ORDER BY uf.unlocked_at DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_fragments(TEXT) TO authenticated;
