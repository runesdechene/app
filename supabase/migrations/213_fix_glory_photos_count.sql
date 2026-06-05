-- 213_fix_glory_photos_count.sql
-- Fix : "Photos ajoutées" affichait 0 dans la fenêtre Niveau pour les créateurs de lieux.
--
-- Cause racine : get_my_glory comptait les photos via place_contributions type='carnet'.images
-- (+ COUNT des type='photo'). Or :
--   - le type 'carnet' n'existe plus depuis le refactor carnet→description (mig 195+) → branche morte (0) ;
--   - les photos de création de lieu vivent dans places.images (aucune contribution créée par
--     _create_place_internal), ce que la formule ignorait totalement.
--
-- Modèle réel des photos (sources DISJOINTES, pas de double comptage) :
--   - Création de lieu  → places.images (auteur = créateur).
--   - Ajout ultérieur   → place_contributions type='photo'.images (add_place_photos ne touche pas places.images).
--
-- Correction : photos = SUM(images) des lieux créés + SUM(images) des contributions type='photo'.
-- On compte les photos (jsonb_array_length), pas les lignes de contribution.
-- Idempotent : CREATE OR REPLACE.

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

  -- Photos = création (places.images des lieux créés) + ajouts (contributions type='photo').
  SELECT
    COALESCE((SELECT SUM(jsonb_array_length(images))::integer
                FROM public.places
               WHERE author_id = p_user_id
                 AND images IS NOT NULL AND jsonb_typeof(images) = 'array'), 0)
    + COALESCE((SELECT SUM(jsonb_array_length(images))::integer
                  FROM public.place_contributions
                 WHERE user_id = p_user_id AND type = 'photo'
                   AND images IS NOT NULL AND jsonb_typeof(images) = 'array'), 0)
  INTO v_photos;

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
