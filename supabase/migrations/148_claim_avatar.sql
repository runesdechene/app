-- ============================================
-- MIGRATION 148 : Ajouter l'avatar du protecteur dans get_place_by_id
-- ============================================
-- On ajoute claimedByAvatar dans le JSON claim retourné

-- On ne réécrit pas toute la fonction, on crée un helper
CREATE OR REPLACE FUNCTION public.get_user_avatar(p_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT avatar_url FROM users WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_avatar(TEXT) TO anon;
