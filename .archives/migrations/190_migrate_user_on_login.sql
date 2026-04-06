-- ============================================
-- MIGRATION 190 : Migration d'ancien compte au login
-- ============================================
-- Le trigger handle_new_user ne se re-declenche jamais apres le
-- premier signup. Les anciens comptes dont la migration a echoue
-- sont bloques : users.id = Firebase ID, auth.uid() = Supabase UUID.
-- Resultat : RLS crash sur chat_messages, places_discovered, etc.
--
-- Cette RPC est appelee par usePlayer.ts quand il detecte un mismatch
-- entre auth.uid() et users.id. Elle migre l'ancien compte vers le
-- nouvel UUID Supabase, en toute securite.
-- ============================================

CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_err TEXT;
BEGIN
  -- Securite : seul l'utilisateur authentifie peut migrer son propre compte
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Verifier que l'ancien user existe
  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  -- Verifier qu'un user avec le nouvel ID n'existe pas deja
  -- (sauf les ghosts __migrated_ qu'on va supprimer)
  DELETE FROM public.users
  WHERE id = p_new_id
    AND (email_address LIKE '__migrated_%' OR email_address = '');

  -- Vider l'email et shopify_customer_id de l'ancien pour liberer les index uniques
  UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = p_old_id;

  -- Inserer le nouveau user avec copie complete
  INSERT INTO public.users (
    id, email_address, first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    vitalite_points, max_vitalite, vitalite_reset_at,
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, updated_at
  )
  SELECT
    p_new_id,
    v_email,
    first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, NOW()
  FROM public.users WHERE id = p_old_id
  ON CONFLICT (id) DO NOTHING;

  -- Migrer TOUTES les FK
  UPDATE places_discovered SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE place_claims SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE chat_messages SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_viewed SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_liked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_explored SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_bookmarked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE reviews SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE image_media SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE member_codes SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_photo_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_review_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_photo_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_review_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE places SET author_id = p_new_id WHERE author_id = p_old_id;
  UPDATE places SET claimed_by = p_new_id WHERE claimed_by = p_old_id;
  UPDATE activity_log SET actor_id = p_new_id WHERE actor_id = p_old_id;
  UPDATE place_claims SET previous_claimed_by = p_new_id WHERE previous_claimed_by = p_old_id;
  -- Tables ajoutees apres 078
  UPDATE territory_name_proposals SET proposed_by = p_new_id WHERE proposed_by = p_old_id;
  UPDATE territory_name_votes SET voter_id = p_new_id WHERE voter_id = p_old_id;
  UPDATE user_fragments SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE fragment_ability_uses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE purchase_log SET user_id = p_new_id WHERE user_id = p_old_id;

  -- Supprimer l'ancien
  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_user_to_auth_id(TEXT, TEXT) TO authenticated;
