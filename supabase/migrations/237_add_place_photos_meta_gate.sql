-- 237_add_place_photos_meta_gate.sql
-- WHY : aligner l'AJOUT DE PHOTO sur le même gate « Présence ou veille » que
-- titre / tags / description (décision Uriel). add_place_photos (baseline) n'avait
-- AUCUN contrôle d'accès : elle insérait une contribution photo pour le p_user_id
-- fourni par le client, sans vérifier ni l'autorisation ni le lien avec le JWT.
--
-- FIX : identité dérivée du JWT (_caller_user_id), gate _can_edit_place_meta
-- (ajouteur OU venu sur place OU veilleur ; jamais la simple révélation au brouillard),
-- et attribution faite au caller dérivé. p_user_id conservé pour compat, ignoré.
--
-- Source : def LIVE de add_place_photos (pg_get_functiondef). Réversible : restaurer
-- la version sans gate + p_user_id.

CREATE OR REPLACE FUNCTION public.add_place_photos(
  p_user_id text, p_place_id text, p_images jsonb  -- p_user_id : déprécié, ignoré (identité = JWT)
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text := public._caller_user_id();
  v_faction text;
  v_id integer;
  v_place RECORD;
  v_actor RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_images IS NULL OR jsonb_array_length(p_images) = 0 THEN
    RETURN json_build_object('error','no_images');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error','not_allowed');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_caller;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, images, created_at, updated_at)
  VALUES (p_place_id, v_caller, v_faction, 'photo', p_images, now(), now())
  RETURNING id INTO v_id;

  SELECT title, latitude, longitude, author_id INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id
    INTO v_actor FROM users WHERE id = v_caller;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', v_caller, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','photo',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  IF v_place.author_id IS NOT NULL AND v_place.author_id <> v_caller THEN
    PERFORM notify(v_place.author_id, 'new_photo', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', v_caller, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END IF;

  RETURN json_build_object('success', true, 'id', v_id);
END;
$function$;

ALTER FUNCTION public.add_place_photos(text, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.add_place_photos(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_place_photos(text, text, jsonb) TO authenticated, service_role;
