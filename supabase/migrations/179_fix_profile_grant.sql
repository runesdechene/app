-- ============================================
-- MIGRATION 179 : Fix GRANT sur get_player_profile
-- ============================================
-- La migration 165 a oublié la signature (TEXT) dans le GRANT

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;
