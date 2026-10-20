-- WHY: la fiche de modération du Hub ne montrait (et ne retirait) que les photos de la pose d'un
--      lieu (places.images) ; celles ajoutées ensuite par les joueurs, rangées dans
--      place_contributions type 'photo' (267 lignes, 423 photos), lui échappaient (Uriel, 20/10).
--   1. mod_get_place : copiée de la définition live, gagne `photos` = _photos_du_lieu(id), la liste
--      que montre l'appli (pose puis ajouts, {url, vignette}).
--   2. mod_retirer_photo désigne désormais la photo par son adresse — les ajouts n'ont pas d'id.
--      Le paramètre change de nom : DROP puis CREATE (la 534 n'est appelée que par le Hub local,
--      jamais déployé — vérifié à la main le 20/10). La V1 écrivait un ajout aux deux endroits
--      (249 des 423 photos ajoutées sont aussi dans places.images) : la photo part des deux. Une
--      ligne d'ajout vidée est supprimée après avoir été vidée : _trg_xp_contribution_delete
--      compte alors 0 photo, l'XP du joueur ne bouge pas, comme pour une photo de la pose. Ce
--      qui est retiré part entier dans place_moderation_log.
--   3. _photos_du_lieu : copiée de la définition live (388) ; un ajout déjà présent dans la pose
--      n'est plus listé deux fois — la fiche de l'appli montrait ces 249 photos en double.
-- SCHEMA CHECKED (20/10/2026, live) : places.images [{id,url,thumb}] ; place_contributions(id int,
--   place_id, user_id, type, images jsonb [adresses en chaînes], image_url, created_at) ;
--   _photos_du_lieu(text) → json [{url, vignette}] ; _trg_xp_contribution_delete compte
--   jsonb_array_length(OLD.images) ; place_moderation_log(place_id, moderator_id, action, detail).

CREATE OR REPLACE FUNCTION public._photos_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('url', ph.url, 'vignette', ph.vignette)
                           ORDER BY ph.rang, ph.quand, ph.ordre), '[]'::json)
  FROM (
    SELECT i->>'url' AS url, COALESCE(i->>'thumb', i->>'url') AS vignette,
           0 AS rang, NULL::timestamptz AS quand, x.o AS ordre
    FROM places p, jsonb_array_elements(COALESCE(p.images, '[]'::jsonb)) WITH ORDINALITY AS x(i, o)
    WHERE p.id = p_id AND i->>'url' IS NOT NULL
    UNION ALL
    SELECT COALESCE(i->>'url', i #>> '{}'), COALESCE(i->>'thumb', i->>'url', i #>> '{}'),
           1, c.created_at, x.o
    FROM place_contributions c,
         jsonb_array_elements(CASE WHEN jsonb_typeof(c.images) = 'array' THEN c.images ELSE '[]'::jsonb END)
           WITH ORDINALITY AS x(i, o)
    WHERE c.place_id = p_id AND c.type = 'photo'
      AND NOT EXISTS (SELECT 1 FROM places p, jsonb_array_elements(p.images) pi
                       WHERE p.id = p_id AND jsonb_typeof(p.images) = 'array'
                         AND pi->>'url' = COALESCE(i->>'url', i #>> '{}'))
  ) ph
  WHERE ph.url IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.mod_get_place(p_place_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text := public._caller_user_id();
  v_json   json;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT json_build_object(
    'id', p.id, 'title', p.title, 'text', p.text, 'address', p.address,
    'latitude', p.latitude, 'longitude', p.longitude,
    'masked', p.masked, 'sensible', p.sensible,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'verified_at', p.verified_at,
    'verified_by_name', vu.display_name,
    'author_id', p.author_id,
    'author_name', COALESCE(au.display_name, au.first_name),
    'author_contributions', au.contributions_count,
    'author_places_count', (SELECT count(*) FROM public.places pa WHERE pa.author_id = p.author_id),
    'visit_count', (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id),
    'discovered_count', (SELECT count(*) FROM public.places_discovered pd WHERE pd.place_id = p.id),
    'rating_avg', (SELECT round(avg(rating)::numeric, 1) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'rating_count', (SELECT count(*) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'photo_count', CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END,
    'images', CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END,
    'photos', public._photos_du_lieu(p.id)
  ) INTO v_json
  FROM public.places p
  LEFT JOIN public.users au ON au.id = p.author_id
  LEFT JOIN public.users vu ON vu.id = p.verified_by
  WHERE p.id = p_place_id;

  IF v_json IS NULL THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  RETURN v_json;
END; $function$;

DROP FUNCTION IF EXISTS public.mod_retirer_photo(text, text);

CREATE FUNCTION public.mod_retirer_photo(p_place_id text, p_url text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller text := public._caller_user_id();
  v_image  jsonb;
  v_ajouts jsonb;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  -- Ce qui va partir, gardé entier pour le journal
  SELECT e INTO v_image
    FROM public.places p, jsonb_array_elements(p.images) e
   WHERE p.id = p_place_id AND jsonb_typeof(p.images) = 'array' AND e->>'url' = p_url
   LIMIT 1;
  SELECT jsonb_agg(to_jsonb(c)) INTO v_ajouts
    FROM public.place_contributions c
   WHERE c.place_id = p_place_id AND c.type = 'photo' AND jsonb_typeof(c.images) = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.images) e WHERE COALESCE(e->>'url', e #>> '{}') = p_url);
  IF v_image IS NULL AND v_ajouts IS NULL THEN
    RETURN json_build_object('error','image_not_found');
  END IF;

  -- La pose du lieu
  UPDATE public.places
     SET images = COALESCE((SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(images) WITH ORDINALITY AS t(e, i)
                             WHERE e->>'url' IS DISTINCT FROM p_url), '[]'::jsonb),
         updated_at = NOW()
   WHERE id = p_place_id AND v_image IS NOT NULL;

  -- Les ajouts des joueurs ; une ligne vidée disparaît
  UPDATE public.place_contributions c
     SET images = COALESCE((SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(c.images) WITH ORDINALITY AS t(e, i)
                             WHERE COALESCE(e->>'url', e #>> '{}') <> p_url), '[]'::jsonb),
         updated_at = NOW()
   WHERE c.id IN (SELECT (a->>'id')::int FROM jsonb_array_elements(COALESCE(v_ajouts, '[]'::jsonb)) a);
  DELETE FROM public.place_contributions
   WHERE id IN (SELECT (a->>'id')::int FROM jsonb_array_elements(COALESCE(v_ajouts, '[]'::jsonb)) a)
     AND images = '[]'::jsonb;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'remove_image', jsonb_build_object('url', p_url, 'image', v_image, 'ajouts', v_ajouts));
  RETURN json_build_object('success', true);
END; $function$;

ALTER FUNCTION public.mod_retirer_photo(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_retirer_photo(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_retirer_photo(text,text) TO authenticated, service_role;
