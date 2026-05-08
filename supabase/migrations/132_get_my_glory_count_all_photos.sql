-- 132_get_my_glory_count_all_photos.sql
-- WHY : bug remonté par Uriel le 8/05 — la modale "Niveau" affiche toujours
-- "📷 Photos ajoutées : 0" même pour les comptes qui ont déjà ajouté des
-- photos via création de lieu ou récits.
--
-- Cause : get_my_glory comptait uniquement les contributions type='photo'
-- (= flow standalone "ajouter une photo" sur fiche existante). Or la grosse
-- majorité des photos sont dans le carnet auto créé au moment de la création
-- d'un lieu (place_contributions.type='carnet' + colonne images jsonb).
--
-- Décision Uriel : compter TOUTES les photos partagées par l'user (création
-- + récits ultérieurs + standalone). Pas de double comptage avec places.images
-- (les photos de création sont aussi dans le carnet auto, on compte une seule
-- fois via place_contributions).
--
-- Reprise B1 verbatim de la version courante. Seul change : v_photos.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_glory(p_user_id text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
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

  -- V132 : compte toutes les photos partagées par l'user.
  --   - place_contributions type='photo' : 1 par ligne (flow standalone)
  --   - place_contributions type='carnet' : N par ligne (jsonb_array_length du
  --     champ images, qui contient les photos uploadées à la création OU
  --     ajoutées au carnet ensuite).
  -- Pas de double comptage avec places.images : les photos de la création
  -- vivent dans le carnet auto (cf. _create_place_internal mig 126).
  SELECT
    (SELECT COUNT(*)::integer FROM public.place_contributions
       WHERE user_id = p_user_id AND type = 'photo')
    + COALESCE(
        (SELECT SUM(jsonb_array_length(images))::integer
           FROM public.place_contributions
           WHERE user_id = p_user_id
             AND type = 'carnet'
             AND images IS NOT NULL
             AND jsonb_typeof(images) = 'array'),
        0
      )
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
$$;

GRANT EXECUTE ON FUNCTION public.get_my_glory(text) TO anon, authenticated, service_role;

COMMIT;
