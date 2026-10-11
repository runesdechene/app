-- WHY: « Un voyageur sans nom », le nom par défaut de 2 459 comptes V1, devient « Un Voyageur »
--      dans la base elle-même (Uriel, 11/10 : « ça évite les petites magouilles à droite à
--      gauche »). Partout — fiches, profils, Hub, vitrine — le même nom, sans traduction.
--   1. users : display_name et first_name, d'un seul UPDATE. Le déclencheur
--      trg_sync_display_name_with_first_name recopie first_name dans display_name : les deux
--      valent « Un Voyageur ». Vérifié le 11/10 : les deux colonnes portent l'ancien nom sur les
--      mêmes 2 459 lignes, aucun nom choisi n'est écrasé.
--   2. lieux_au_hasard (définition live du 11/10, copiée entière) : sa traduction de la 485 part.
--      Les espaces de bord ne sont plus retirés : un seul compte en a avec un nom affiché propre,
--      que nettoyer son prénom écraserait (le déclencheur) ; et un espace final ne se voit pas.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(display_name, first_name), sans
--   valeur par défaut ; aucune fonction, aucun code (appli, Hub, seo-pages, send-push, thème)
--   ne compare ce nom, sauf lieux_au_hasard.

UPDATE public.users
   SET display_name = 'Un Voyageur', first_name = 'Un Voyageur'
 WHERE display_name = 'Un voyageur sans nom' OR first_name = 'Un voyageur sans nom';

CREATE OR REPLACE FUNCTION public.lieux_au_hasard(p_nombre integer DEFAULT 8)
 RETURNS json
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', l.id,
      'nom', l.title,
      'slug', l.slug,
      'region', COALESCE(NULLIF(btrim(l.departement), ''), NULLIF(btrim(l.pays), '')),
      'numero', g.code,
      'nature', public._nature_de(l.id),
      'photo', public._photos_du_lieu(l.id)->0->>'url',
      'auteur', CASE WHEN u.id IS NOT NULL THEN json_build_object(
          'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
          'avatar', u.avatar_url) END
    )), '[]'::json)
  FROM (
    SELECT p.id, p.title, p.slug, p.departement, p.pays, p.author_id
    FROM places p
    WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
      AND p.slug IS NOT NULL
      AND jsonb_array_length(COALESCE(p.images, '[]'::jsonb)) > 0
    ORDER BY random()
    LIMIT least(greatest(COALESCE(p_nombre, 8), 1), 12)
  ) l
  LEFT JOIN geo_departements g ON g.nom = l.departement
  LEFT JOIN users u ON u.id = l.author_id;
$function$;

REVOKE ALL ON FUNCTION public.lieux_au_hasard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lieux_au_hasard(integer) TO anon, authenticated;
