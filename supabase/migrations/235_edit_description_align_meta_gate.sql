-- 235_edit_description_align_meta_gate.sql
-- WHY : aligner l'édition de la DESCRIPTION sur le même gate que titre + tags
-- (décision Uriel : « Présence ou veille »). Avant, edit_place_description (baseline)
-- autorisait via _has_discovered = EXISTS(places_discovered) → toute personne ayant
-- sorti le lieu du brouillard, MÊME à distance, pouvait éditer. Et l'identité venait
-- d'un p_user_id client (spoofable), pas du JWT.
--
-- 1) _can_edit_place_meta (mig 234) : on complète « a été sur place » pour inclure
--    aussi les découvertes faites EN GPS sur site (places_discovered.method='gps'),
--    en plus de place_explorers — sans jamais inclure method='remote' (le brouillard).
-- 2) edit_place_description : gate = _can_edit_place_meta, identité dérivée du JWT
--    (_caller_user_id) et utilisée aussi pour l'attribution (contribution, révision,
--    activity_log, notifications). p_user_id conservé pour compat de signature, ignoré.
--
-- Réversible : restaurer _has_discovered + p_user_id dans edit_place_description, et
-- retirer la branche places_discovered(gps) du helper.

BEGIN;

CREATE OR REPLACE FUNCTION public._can_edit_place_meta(p_place_id text, p_caller text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate$
  SELECT p_caller IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.places           WHERE id       = p_place_id AND author_id        = p_caller)
    OR EXISTS (SELECT 1 FROM public.place_explorers   WHERE place_id = p_place_id AND user_id          = p_caller)
    OR EXISTS (SELECT 1 FROM public.places_discovered WHERE place_id = p_place_id AND user_id          = p_caller AND method = 'gps')
    OR EXISTS (SELECT 1 FROM public.place_veille      WHERE place_id = p_place_id AND veilleur_user_id = p_caller)
  );
$gate$;

CREATE OR REPLACE FUNCTION public.edit_place_description(
  p_user_id text, p_place_id text, p_content text  -- p_user_id : déprécié, ignoré (identité = JWT)
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller  text := public._caller_user_id();
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_place   RECORD;
  v_actor   RECORD;
  v_prev    RECORD;
BEGIN
  IF v_caller IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error','not_allowed');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_caller;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
  VALUES (p_place_id, v_caller, v_faction, 'description', v_content, now(), now())
  ON CONFLICT (place_id) WHERE (type = 'description')
  DO UPDATE SET content = EXCLUDED.content, user_id = EXCLUDED.user_id,
               faction_id = EXCLUDED.faction_id, updated_at = now();

  INSERT INTO place_description_revisions (place_id, content, edited_by)
  VALUES (p_place_id, v_content, v_caller);

  SELECT title, latitude, longitude INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id
    INTO v_actor FROM users WHERE id = v_caller;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', v_caller, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','description',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  FOR v_prev IN
    SELECT DISTINCT edited_by FROM place_description_revisions
    WHERE place_id = p_place_id AND edited_by <> v_caller
  LOOP
    PERFORM notify(v_prev.edited_by, 'description_edited', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', v_caller, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END LOOP;

  RETURN json_build_object('success', true, 'content', v_content);
END;
$function$;

ALTER FUNCTION public.edit_place_description(text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.edit_place_description(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_place_description(text, text, text) TO authenticated, service_role;

COMMIT;
