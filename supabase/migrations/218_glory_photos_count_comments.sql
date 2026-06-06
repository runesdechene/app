-- 218_glory_photos_count_comments.sql
-- WHY : "Photos ajoutées" (modale Niveau, get_my_glory) ne comptait que les photos
-- de création (places.images) + bouton dédié (contributions type='photo'). Une photo
-- postée DANS un commentaire (bouton 📷 "Ajouter une photo" du compositeur →
-- contribution type='comment'.images) n'était comptée nulle part, alors que la
-- galerie du lieu l'affiche. "Une photo est une photo" → on aligne le compteur sur
-- la galerie front (PlacePanel galleryPhotos) : URLs distinctes contribuées par le
-- joueur.
--
-- Sources (dédup par URL) :
--   - création : places.images (auteur)            → tableau d'OBJETS [{id,url,thumb}] → ->>'url'
--   - ajouts   : place_contributions type IN ('photo','comment') (auteur de la contrib)
--                                                   → tableau de STRINGS ["url"]        → jsonb_array_elements_text
-- EXCLU : type='description'. Ses images sont un doublon des places.images de création,
--   et son user_id DÉRIVE vers le dernier éditeur (ON CONFLICT DO UPDATE) → les compter
--   créditerait un éditeur des photos d'un autre. La création reste comptée via places.images.
--
-- Reste : barème Coupe/Gloire inchangés (les photos rapportent toujours de l'XP via
--   glory.photo ; 0 pt Coupe depuis mig 217). Ici on touche UNIQUEMENT le compteur
--   d'affichage get_my_glory. Repart de la def LIVE (mig 213), delta = bloc v_photos.

CREATE OR REPLACE FUNCTION public.get_my_glory(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_lieux_decouverts integer;
  v_lieux_explores   integer;
  v_lieux_ajoutes    integer;
  v_carnets          integer;
  v_photos           integer;
  v_plantages        integer;
  v_enigmes_total    integer;
  v_e_very_easy      integer;
  v_e_easy           integer;
  v_e_medium         integer;
  v_e_hard           integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_lieux_decouverts FROM public.places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_lieux_ajoutes FROM public.places WHERE author_id = p_user_id;
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';

  -- Photos = URLs distinctes contribuées par le joueur, alignées sur la galerie front.
  -- Création (places.images, objets) + ajouts (contributions photo/comment, strings).
  -- description exclu (doublon création + user_id qui dérive).
  SELECT COUNT(DISTINCT url)::integer INTO v_photos
  FROM (
    SELECT jsonb_array_elements(images) ->> 'url' AS url
      FROM public.places
     WHERE author_id = p_user_id
       AND images IS NOT NULL AND jsonb_typeof(images) = 'array'
    UNION ALL
    SELECT jsonb_array_elements_text(images) AS url
      FROM public.place_contributions
     WHERE user_id = p_user_id AND type IN ('photo', 'comment')
       AND images IS NOT NULL AND jsonb_typeof(images) = 'array'
  ) t
  WHERE url IS NOT NULL AND url <> '';

  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE e.difficulty = 'very_easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'medium'),
    COUNT(*) FILTER (WHERE e.difficulty = 'hard')
  INTO v_enigmes_total, v_e_very_easy, v_e_easy, v_e_medium, v_e_hard
  FROM public.enigma_responses er
  JOIN public.enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id AND er.correct = TRUE;

  RETURN json_build_object(
    'glory',           public._user_glory_score(p_user_id, NULL, NULL),
    'lieuxDecouverts', v_lieux_decouverts,
    'lieuxExplores',   v_lieux_explores,
    'lieuxAjoutes',    v_lieux_ajoutes,
    'carnets',         v_carnets,
    'photos',          v_photos,
    'plantages',       v_plantages,
    'enigmes', json_build_object(
      'total',     v_enigmes_total,
      'veryEasy',  v_e_very_easy,
      'easy',      v_e_easy,
      'medium',    v_e_medium,
      'hard',      v_e_hard
    )
  );
END;
$function$;
