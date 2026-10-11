-- WHY: sous les lieux de la vitrine, « Ajouté par Un voyageur sans nom » revenait sur une carte
--      sur deux : le nom par défaut de 2 459 vieux comptes V1 (1 542 lieux publics). Uriel, 11/10 :
--      « Un Voyageur », ça fait anonymat. Et les noms perdent leurs espaces de bord (« Rémy »).
--   lieux_au_hasard (définition live du 11/10, copiée entière) : le nom de l'auteur seul change.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(display_name, first_name) — chez
--   ces comptes, first_name porte aussi « Un voyageur sans nom » (ou rien).

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
          -- Un compte sans nom choisi (« Un voyageur sans nom », défaut de la V1) reste anonyme.
          'nom', COALESCE(NULLIF(btrim(u.display_name), 'Un voyageur sans nom'),
                          NULLIF(NULLIF(btrim(u.first_name), ''), 'Un voyageur sans nom'),
                          'Un Voyageur'),
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
