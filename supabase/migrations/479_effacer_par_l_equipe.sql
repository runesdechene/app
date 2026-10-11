-- WHY: sous une mise à jour, l'équipe efface n'importe quel mot depuis l'appli (spec
--      2026-10-11-carnet-des-mises-a-jour, décision d'Uriel du 11/10 : la modération se fait depuis
--      « Nouveautés », le Hub n'a pas d'écran pour ces mots). effacer_mot_mise_a_jour l'autorisait
--      déjà ; l'appli ne montrait « Effacer » que sur ses propres mots. Chaque mot dit donc s'il peut
--      être effacé par celui qui lit.
--   _mot_mise_a_jour (définition live du 11/10, copiée entière) : en plus `peutEffacer`.
--   Le carnet d'un lieu (_mot) ne change pas.
-- SCHEMA CHECKED (11/10/2026) : mots_mise_a_jour(id, user_id, texte, images, created_at) (478) ;
--   coeurs_mot_mise_a_jour(mot_id, user_id, nombre) (478) ; users(id, display_name, first_name,
--   avatar_url) ; _is_staff() ; user_public_name(text, text, text).

CREATE OR REPLACE FUNCTION public._mot_mise_a_jour(p_id bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', c.id,
    'quand', c.created_at,
    'texte', c.texte,
    'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                             'avatar', u.avatar_url),
    'venu', false,
    'photos', COALESCE((SELECT json_agg(COALESCE(i->>'url', i #>> '{}'))
                        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.images) = 'array'
                                                       THEN c.images ELSE '[]'::jsonb END) i), '[]'::json),
    'coeurs', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot_mise_a_jour WHERE mot_id = c.id),
    'miens', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot_mise_a_jour
              WHERE mot_id = c.id AND user_id = (auth.uid())::text),
    'aMoi', c.user_id = (auth.uid())::text,
    -- 479 : son auteur ou l'équipe, comme effacer_mot_mise_a_jour.
    'peutEffacer', c.user_id = (auth.uid())::text OR public._is_staff())
  FROM mots_mise_a_jour c JOIN users u ON u.id = c.user_id
  WHERE c.id = p_id;
$function$;

REVOKE ALL ON FUNCTION public._mot_mise_a_jour(bigint) FROM PUBLIC, anon, authenticated;
