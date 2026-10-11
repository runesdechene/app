-- WHY: le bas de la vitrine, « Quelques lieux de la carte » (maquette validée par Uriel le 11/10,
--      Figma 549:828 / 549:1097). Des lieux tirés au sort, rendus dans le HTML de /bienvenue
--      au déploiement : Google suit leurs liens vers les fiches /lieu/*.
--   lieux_au_hasard(p_nombre) : des lieux publics (ni masqués, ni privés) qui ont une photo et
--   une fiche publique (slug) ; leur nature, leur département et son numéro, la photo, et qui
--   les a ajoutés — le nom et la photo de profil seulement, jamais une position. Une exception
--   voulue à « jamais de personne sur la vitrine » (391), validée par Uriel le 11/10 : les fiches
--   /lieu/* montrent déjà leurs contributeurs.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : places(id, title, slug, departement,
--   pays, images, masked, private, author_id) ; users(id, display_name, first_name, avatar_url) ;
--   geo_departements(code, nom) — chaque departement des lieux publics y a son nom ;
--   _nature_de(text) (391) ; _photos_du_lieu(text) (388).

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
          'nom', COALESCE(u.display_name, u.first_name, 'Voyageur'),
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
