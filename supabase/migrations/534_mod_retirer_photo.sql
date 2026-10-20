-- WHY: depuis un signalement, la fiche de modération du Hub montrait les photos d'un lieu sans
--      pouvoir en retirer une (Uriel, 20/10). mod_retirer_photo(lieu, photo) l'enlève de
--      places.images, réservé à l'équipe, sur le modèle de mod_set_masked (corps live repris).
--      Le fichier reste dans le bucket et la photo entière part dans place_moderation_log :
--      un retrait se rattrape à la main.
-- SCHEMA CHECKED (20/10/2026, live) : places.images jsonb [{id,url,thumb}], les 9 011 photos ont
--   un id ; place_moderation_log(place_id, moderator_id, action, detail jsonb), sans contrainte
--   sur action ; _is_staff, _caller_user_id.

CREATE OR REPLACE FUNCTION public.mod_retirer_photo(p_place_id text, p_image_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text := public._caller_user_id();
  v_image  jsonb;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT e INTO v_image
    FROM public.places p, jsonb_array_elements(p.images) e
   WHERE p.id = p_place_id AND jsonb_typeof(p.images) = 'array' AND e->>'id' = p_image_id;
  IF v_image IS NULL THEN
    RETURN json_build_object('error','image_not_found');
  END IF;

  UPDATE public.places
     SET images = COALESCE((SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(images) WITH ORDINALITY AS t(e, i)
                             WHERE e->>'id' <> p_image_id), '[]'::jsonb),
         updated_at = NOW()
   WHERE id = p_place_id;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'remove_image', jsonb_build_object('image', v_image));

  RETURN json_build_object('success', true);
END; $function$;

ALTER FUNCTION public.mod_retirer_photo(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_retirer_photo(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_retirer_photo(text,text) TO authenticated, service_role;
