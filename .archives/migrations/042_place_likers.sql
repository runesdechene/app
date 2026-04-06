-- ============================================
-- MIGRATION 042 : RPC get_place_likers
-- ============================================
-- Retourne la liste des utilisateurs ayant liké un lieu

CREATE OR REPLACE FUNCTION public.get_place_likers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(liker) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS liker
    FROM places_liked pl
    JOIN users u ON u.id = pl.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pl.place_id = p_place_id
    ORDER BY pl.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_likers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_likers TO anon;
