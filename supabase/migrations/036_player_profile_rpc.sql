-- ============================================
-- MIGRATION 036 : RPC profil joueur public
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
BEGIN
  -- Récupérer l'avatar via image_media (même logique que get_my_informations)
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'discoveredCount', (SELECT COUNT(*) FROM places_discovered pd WHERE pd.user_id = u.id),
    'claimedCount', (SELECT COUNT(DISTINCT pc.place_id) FROM place_claims pc WHERE pc.user_id = u.id),
    'likesCount', (SELECT COUNT(*) FROM places_liked pl WHERE pl.user_id = u.id),
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
