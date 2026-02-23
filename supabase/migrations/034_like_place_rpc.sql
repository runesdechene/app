-- ============================================
-- MIGRATION 034 : RPCs like/unlike place
-- ============================================

-- S'assurer que la contrainte unique existe (nettoyer doublons avant si besoin)
DELETE FROM places_liked
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM places_liked
  GROUP BY user_id, place_id
);
ALTER TABLE places_liked
  DROP CONSTRAINT IF EXISTS places_liked_user_id_place_id_key;
ALTER TABLE places_liked
  ADD CONSTRAINT places_liked_user_id_place_id_key UNIQUE (user_id, place_id);

CREATE OR REPLACE FUNCTION public.like_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO places_liked (id, user_id, place_id, created_at, updated_at)
  VALUES (p_user_id || '_' || p_place_id, p_user_id, p_place_id, NOW(), NOW())
  ON CONFLICT (user_id, place_id) DO NOTHING;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unlike_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM places_liked
  WHERE user_id = p_user_id AND place_id = p_place_id;
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_place TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_place TO authenticated;
