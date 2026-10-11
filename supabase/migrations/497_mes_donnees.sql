-- WHY: le droit d'accès et la portabilité (RGPD art. 15 et 20) : chacun télécharge, depuis l'appli,
--      tout ce qui le concerne, en un fichier lisible par une machine (JSON). Les mêmes tables que
--      la suppression (496), plus ce qu'il a publié : ses lieux, leurs versions, ses messages.
--   La notification n'y est pas en entier (la cloche garde ses trente derniers jours) : son nombre
--   seulement. Les Murmures : envoyés et reçus, puisqu'ils sont à lui autant qu'à l'autre.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : chaque table nommée a user_id ;
--   places.author_id ; versions_lieu.auteur ; murmures(de, a) ; notifications.recipient_id.

CREATE OR REPLACE FUNCTION public.mes_donnees()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Non connecté', 'session'); END IF;
  RETURN json_build_object(
    'exporte_le', now(),
    'compte', (SELECT to_jsonb(u) - 'password' FROM users u WHERE u.id = v_moi),
    'lieux_ajoutes', (SELECT COALESCE(json_agg(x), '[]') FROM places x WHERE x.author_id = v_moi),
    'versions_de_lieux', (SELECT COALESCE(json_agg(x), '[]') FROM versions_lieu x WHERE x.auteur = v_moi),
    'murmures', (SELECT COALESCE(json_agg(x), '[]') FROM murmures x WHERE x.de = v_moi OR x.a = v_moi),
    'notifications', (SELECT count(*) FROM notifications WHERE recipient_id = v_moi),
    'push_subscriptions', (SELECT COALESCE(json_agg(x), '[]') FROM push_subscriptions x WHERE x.user_id = v_moi),
    'place_explorers', (SELECT COALESCE(json_agg(x), '[]') FROM place_explorers x WHERE x.user_id = v_moi),
    'places_discovered', (SELECT COALESCE(json_agg(x), '[]') FROM places_discovered x WHERE x.user_id = v_moi),
    'place_wishlist', (SELECT COALESCE(json_agg(x), '[]') FROM place_wishlist x WHERE x.user_id = v_moi),
    'places_bookmarked', (SELECT COALESCE(json_agg(x), '[]') FROM places_bookmarked x WHERE x.user_id = v_moi),
    'places_liked', (SELECT COALESCE(json_agg(x), '[]') FROM places_liked x WHERE x.user_id = v_moi),
    'place_ratings', (SELECT COALESCE(json_agg(x), '[]') FROM place_ratings x WHERE x.user_id = v_moi),
    'revendications', (SELECT COALESCE(json_agg(x), '[]') FROM revendications x WHERE x.user_id = v_moi),
    'coeurs_lieu', (SELECT COALESCE(json_agg(x), '[]') FROM coeurs_lieu x WHERE x.user_id = v_moi),
    'coeurs_mot', (SELECT COALESCE(json_agg(x), '[]') FROM coeurs_mot x WHERE x.user_id = v_moi),
    'coeurs_mise_a_jour', (SELECT COALESCE(json_agg(x), '[]') FROM coeurs_mise_a_jour x WHERE x.user_id = v_moi),
    'saluts', (SELECT COALESCE(json_agg(x), '[]') FROM saluts x WHERE x.user_id = v_moi),
    'enigma_responses', (SELECT COALESCE(json_agg(x), '[]') FROM enigma_responses x WHERE x.user_id = v_moi),
    'titres_connaissance', (SELECT COALESCE(json_agg(x), '[]') FROM titres_connaissance x WHERE x.user_id = v_moi),
    'user_fragments', (SELECT COALESCE(json_agg(x), '[]') FROM user_fragments x WHERE x.user_id = v_moi),
    'user_crowns', (SELECT COALESCE(json_agg(x), '[]') FROM user_crowns x WHERE x.user_id = v_moi),
    'purchase_log', (SELECT COALESCE(json_agg(x), '[]') FROM purchase_log x WHERE x.user_id = v_moi),
    'faction_members', (SELECT COALESCE(json_agg(x), '[]') FROM faction_members x WHERE x.user_id = v_moi),
    'demandes_compagnie', (SELECT COALESCE(json_agg(x), '[]') FROM demandes_compagnie x WHERE x.user_id = v_moi),
    'place_drafts', (SELECT COALESCE(json_agg(x), '[]') FROM place_drafts x WHERE x.user_id = v_moi),
    'place_contributions', (SELECT COALESCE(json_agg(x), '[]') FROM place_contributions x WHERE x.user_id = v_moi),
    'chat_messages', (SELECT COALESCE(json_agg(x), '[]') FROM chat_messages x WHERE x.user_id = v_moi),
    'mots_mise_a_jour', (SELECT COALESCE(json_agg(x), '[]') FROM mots_mise_a_jour x WHERE x.user_id = v_moi),
    'announcement_comments', (SELECT COALESCE(json_agg(x), '[]') FROM announcement_comments x WHERE x.user_id = v_moi),
    'reviews', (SELECT COALESCE(json_agg(x), '[]') FROM reviews x WHERE x.user_id = v_moi),
    'image_media', (SELECT COALESCE(json_agg(x), '[]') FROM image_media x WHERE x.user_id = v_moi),
    'hub_photo_submissions', (SELECT COALESCE(json_agg(x), '[]') FROM hub_photo_submissions x WHERE x.user_id = v_moi),
    'voyage_messages', (SELECT COALESCE(json_agg(x), '[]') FROM voyage_messages x WHERE x.user_id = v_moi),
    'mission_messages', (SELECT COALESCE(json_agg(x), '[]') FROM mission_messages x WHERE x.user_id = v_moi),
    'scans', (SELECT COALESCE(json_agg(x), '[]') FROM scans x WHERE x.user_id = v_moi)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mes_donnees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_donnees() TO authenticated;
