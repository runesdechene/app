-- ============================================
-- MIGRATION 043 : RPC explore_place + get_place_explorers
-- ============================================

-- 1. RPC explore_place — marquer un lieu comme exploré
CREATE OR REPLACE FUNCTION public.explore_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Insérer (ignore si déjà exploré)
  INSERT INTO places_explored (id, user_id, place_id, created_at, updated_at)
  VALUES (p_user_id || '_' || p_place_id, p_user_id, p_place_id, NOW(), NOW())
  ON CONFLICT (user_id, place_id) DO NOTHING;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.explore_place TO authenticated;

-- 2. RPC get_place_explorers — liste des explorateurs d'un lieu
CREATE OR REPLACE FUNCTION public.get_place_explorers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(explorer) INTO v_result
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
      END,
      'exploredAt', pe.created_at
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
    WHERE pe.place_id = p_place_id
    ORDER BY pe.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_explorers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_explorers TO anon;
