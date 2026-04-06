-- ============================================
-- MIGRATION 161 : Supprimer ability_icon_url, utiliser image_url
-- ============================================

ALTER TABLE title_fragments DROP COLUMN IF EXISTS ability_icon_url;

-- Mettre à jour get_my_abilities pour retourner image_url au lieu de ability_icon_url
CREATE OR REPLACE FUNCTION public.get_my_abilities(p_user_id TEXT)
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
      tf.id AS fragment_id,
      tf.name,
      tf.icon,
      tf.icon_url,
      tf.image_url,
      tf.ability_type,
      tf.ability_cooldown_hours,
      fau.used_at AS last_used,
      CASE
        WHEN fau.used_at IS NULL THEN true
        WHEN fau.used_at + (COALESCE(tf.ability_cooldown_hours, 24) || ' hours')::INTERVAL <= NOW() THEN true
        ELSE false
      END AS available
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    LEFT JOIN fragment_ability_uses fau ON fau.user_id = uf.user_id AND fau.fragment_id = tf.id
    WHERE uf.user_id = p_user_id AND tf.ability_type IS NOT NULL
    ORDER BY tf.name
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_abilities(TEXT) TO authenticated;
