-- ============================================================
-- 012 — Fix get_my_informations : retirer la branche legacy profile_image_id
-- ============================================================
-- WHY : la RPC plantait avec "record \"v_user\" has no field \"profile_image_id\""
-- pour tout user sans avatar_url (≈25 users en prod, dont Angelofsoul à 168 gloire
-- qui voyait 0 sur le badge). La colonne users.profile_image_id a été supprimée
-- au profit de avatar_url, mais la RPC contenait encore le code legacy qui lisait
-- profile_image_id → image_media (variants png_small/webp_small/original).
--
-- Côté client (usePlayer.ts) : profileRes.data était l'objet erreur SQL au lieu
-- du profil → la condition `if (profile.explorationPoints != null)` skippait →
-- le store gardait glory = 0 (cache localStorage vide).
--
-- Modif : on ne touche QUE le bloc avatar. Le reste du retour JSON est identique
-- (mêmes clés, mêmes valeurs, même formule glory = exploration_points + erudition_points).
--
-- Hors scope : la table image_media reste utilisée par reviews_images, donc on
-- ne la touche pas ici. Cleanup éventuel = chantier séparé si un jour reviews
-- migre aussi vers Supabase Storage direct.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."get_my_informations"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user RECORD;
  v_profile_image JSON;
  v_faction JSON;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF v_user.avatar_url IS NOT NULL THEN
    v_profile_image := json_build_object('url', v_user.avatar_url);
  ELSE
    v_profile_image := NULL;
  END IF;

  IF v_user.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', f.id,
      'title', f.title,
      'color', f.color,
      'pattern', f.pattern
    ) INTO v_faction
    FROM factions f
    WHERE f.id = v_user.faction_id;
  ELSE
    v_faction := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_user.id,
    'emailAddress', v_user.email_address,
    'role', COALESCE(v_user.role, 'user'),
    'rank', COALESCE(v_user.rank, 'guest'),
    'gender', v_user.gender,
    'lastName', COALESCE(v_user.display_name, v_user.first_name, 'Aventurier'),
    'biography', COALESCE(v_user.bio, v_user.biography, ''),
    'instagramId', v_user.instagram_id,
    'websiteUrl', v_user.website_url,
    'profileImage', v_profile_image,
    'faction', v_faction,
    'gameMode', COALESCE(v_user.game_mode, 'exploration'),
    'notorietyPoints', COALESCE(v_user.notoriety_points, 0),
    'explorationPoints', COALESCE(v_user.exploration_points, 0),
    'eruditionPoints', COALESCE(v_user.erudition_points, 0),
    'influenceStock', COALESCE(v_user.influence_stock, 0),
    'glory', COALESCE(v_user.exploration_points, 0) + COALESCE(v_user.erudition_points, 0)
  );
END;
$$;
