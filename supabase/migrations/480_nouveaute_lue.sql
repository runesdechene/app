-- WHY: la dernière mise à jour sur la page Explore (décision d'Uriel du 11/10, Figma 545:596) : une
--      carte qui ne se montre que si la note a moins de 14 jours ou n'est pas encore lue. Chaque note
--      dit donc si je l'ai lue, avec la même règle que la cloche (mes_notifications, 478).
--   mises_a_jour_publiees (définition live du 11/10, copiée entière) : en plus `lue`.
-- SCHEMA CHECKED (11/10/2026) : mises_a_jour(id, titre, texte, publiee_le, par, image, version) ;
--   nouveautes_vues(user_id text, vue_le timestamptz) ; _nouveautes_lues_jusqua() ;
--   coeurs_mise_a_jour(mise_a_jour_id, user_id, nombre), mots_mise_a_jour(mise_a_jour_id) (478).

CREATE OR REPLACE FUNCTION public.mises_a_jour_publiees()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', id, 'titre', titre, 'texte', texte, 'quand', publiee_le,
      'image', image, 'version', version,
      'coeurs', (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_mise_a_jour c WHERE c.mise_a_jour_id = m.id),
      'miens', (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_mise_a_jour c
                WHERE c.mise_a_jour_id = m.id AND c.user_id = (auth.uid())::text),
      'mots', (SELECT count(*) FROM mots_mise_a_jour w WHERE w.mise_a_jour_id = m.id),
      'aMoi', m.par IS NOT DISTINCT FROM (auth.uid())::text,
      -- 480 : lue si la cloche a été ouverte depuis sa parution, comme dans mes_notifications.
      'lue', COALESCE(m.publiee_le <= public._nouveautes_lues_jusqua(), true))
    ORDER BY publiee_le DESC), '[]'::json)
  FROM mises_a_jour m;
$function$;
