-- WHY: deux trous dans « Supprimer mon compte » (mig 496), trouvés en relisant la 588 (avis seul).
--   1. Un avis seul s'enregistre sans compte (user_id NULL) : la suppression, qui anonymise par
--      user_id, laissait le prénom et l'e-mail de ses avis. Elle les retrouve maintenant par l'e-mail.
--   2. La suppression vidait l'e-mail (''), or users.email_address est UNIQUE et NOT NULL : depuis le
--      premier compte supprimé (02/11), toute autre suppression échouait sur users_email_address_unique.
--      Chaque compte supprimé reçoit une pierre tombale unique, 'supprime:<id>', qui n'est pas une
--      adresse ; le compte supprimé le 02/11 aussi, ce qui libère ''.
-- SCHEMA CHECKED (11/11/2026, live) : supprimer_mon_compte identique à la 496 ; users.email_address
--   text NOT NULL UNIQUE, sans autre contrainte ; hub_photo_submissions(user_id, submitter_email) ;
--   un seul compte supprimé (supprime_le), d'e-mail ''.

UPDATE public.users SET email_address = 'supprime:' || id WHERE supprime_le IS NOT NULL AND email_address = '';

CREATE OR REPLACE FUNCTION public.supprimer_mon_compte()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_compagnie text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Non connecté', 'session'); END IF;

  -- Ses Compagnies : il les quitte, la chefferie passe.
  FOR v_compagnie IN SELECT faction_id FROM faction_members WHERE user_id = v_moi LOOP
    DELETE FROM faction_members WHERE faction_id = v_compagnie AND user_id = v_moi;
    PERFORM _succession(v_compagnie);
  END LOOP;
  DELETE FROM demandes_compagnie WHERE user_id = v_moi;
  DELETE FROM company_members WHERE user_id = v_moi;
  DELETE FROM company_bans WHERE user_id = v_moi;

  -- Ce qui n'appartient qu'à lui : traces, envies, visites, cœurs, notifications, progression.
  DELETE FROM push_subscriptions WHERE user_id = v_moi;
  DELETE FROM notifications WHERE recipient_id = v_moi;
  DELETE FROM refresh_tokens WHERE user_id = v_moi;
  DELETE FROM password_resets WHERE user_id = v_moi;
  DELETE FROM presences WHERE user_id = v_moi;
  DELETE FROM places_viewed WHERE user_id = v_moi;
  DELETE FROM places_discovered WHERE user_id = v_moi;
  DELETE FROM places_explored WHERE user_id = v_moi;
  DELETE FROM place_explorers WHERE user_id = v_moi;
  DELETE FROM places_bookmarked WHERE user_id = v_moi;
  DELETE FROM place_wishlist WHERE user_id = v_moi;
  DELETE FROM places_liked WHERE user_id = v_moi;
  DELETE FROM place_ratings WHERE user_id = v_moi;
  DELETE FROM revendications WHERE user_id = v_moi;
  DELETE FROM coeurs_lieu WHERE user_id = v_moi;
  DELETE FROM coeurs_mot WHERE user_id = v_moi;
  DELETE FROM coeurs_mise_a_jour WHERE user_id = v_moi;
  DELETE FROM coeurs_mot_mise_a_jour WHERE user_id = v_moi;
  DELETE FROM saluts WHERE user_id = v_moi;
  DELETE FROM announcement_likes WHERE user_id = v_moi;
  DELETE FROM announcement_comment_likes WHERE user_id = v_moi;
  DELETE FROM contribution_votes WHERE user_id = v_moi;
  DELETE FROM nouveautes_vues WHERE user_id = v_moi;
  DELETE FROM registre_lu WHERE user_id = v_moi;
  DELETE FROM mission_message_reads WHERE user_id = v_moi;
  DELETE FROM voyage_message_reads WHERE user_id = v_moi;
  DELETE FROM chat_mentions WHERE user_id = v_moi;
  DELETE FROM enigma_responses WHERE user_id = v_moi;
  DELETE FROM titres_connaissance WHERE user_id = v_moi;
  DELETE FROM user_fragments WHERE user_id = v_moi;
  DELETE FROM user_crowns WHERE user_id = v_moi;
  DELETE FROM crown_harvest WHERE user_id = v_moi;
  DELETE FROM purchase_log WHERE user_id = v_moi;
  DELETE FROM defi_claims WHERE user_id = v_moi;
  DELETE FROM user_quest_progress WHERE user_id = v_moi;
  DELETE FROM community_quest_contributions WHERE user_id = v_moi;
  DELETE FROM fragment_ability_uses WHERE user_id = v_moi;
  DELETE FROM scans WHERE user_id = v_moi;
  DELETE FROM place_drafts WHERE user_id = v_moi;
  DELETE FROM activity_log WHERE actor_id = v_moi;
  DELETE FROM expedition_members WHERE user_id = v_moi;
  DELETE FROM mission_participants WHERE user_id = v_moi;
  DELETE FROM voyage_participants WHERE user_id = v_moi;
  DELETE FROM veille_history WHERE user_id = v_moi;
  DELETE FROM place_veille WHERE veilleur_user_id = v_moi;
  DELETE FROM place_court_action WHERE user_id = v_moi OR beneficiary_user_id = v_moi;
  DELETE FROM faction_gold_log WHERE user_id = v_moi;
  DELETE FROM faction_banner_history WHERE user_id = v_moi;
  UPDATE member_codes SET user_id = NULL WHERE user_id = v_moi;

  -- Ses Murmures : des échanges privés, effacés dans les deux sens.
  DELETE FROM murmures WHERE de = v_moi OR a = v_moi;

  -- Ses photos et ses avis envoyés à la boutique : ils restent, sans ce qui l'identifie. Un avis
  -- seul n'a pas de compte (mig 588) : on le retrouve par l'e-mail, avant que la fiche ne le perde.
  UPDATE hub_photo_submissions
     SET submitter_name = 'Un Voyageur', submitter_email = '', submitter_instagram = NULL,
         location_name = NULL, location_zip = NULL
   WHERE user_id = v_moi
      OR (user_id IS NULL
          AND lower(submitter_email) = (SELECT lower(email_address) FROM users WHERE id = v_moi));

  -- La pierre tombale : ce qu'il a publié reste attaché à « Un Voyageur ».
  UPDATE users SET
    first_name = 'Un Voyageur', display_name = 'Un Voyageur',
    email_address = 'supprime:' || v_moi, avatar_url = NULL, bio = NULL, biography = '',
    instagram = NULL, instagram_id = NULL, website_url = NULL,
    location_name = NULL, location_zip = NULL, shopify_customer_id = NULL,
    last_device_os = NULL, last_device_version = NULL, last_access = NULL, last_login_at = NULL,
    timezone = DEFAULT, muted_user_ids = DEFAULT, gender = NULL, title_gender = DEFAULT,
    signe_fragment_id = NULL, faction_id = NULL, active_company_id = NULL,
    displayed_title_ids_v3 = NULL, displayed_general_title_ids = NULL,
    push_important_enabled = false, push_recap_enabled = false,
    role = 'user', is_active = false, supprime_le = now()
  WHERE id = v_moi;

  -- Plus personne ne se connecte à ce compte ; son e-mail est libre.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;
