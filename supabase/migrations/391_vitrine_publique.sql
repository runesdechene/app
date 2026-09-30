-- WHY: la page d'accueil devient un moteur de recherche (maquettes Figma « Landing — l'esprit de
--      l'Accueil », PC et téléphone, finies par Uriel le 30/09) : « devenir la référence pour toute
--      personne qui cherche un lieu ancien ». On cherche SANS compte ; on voit un aperçu du lieu ;
--      le compte ouvre le reste (le récit entier, la position, le Carnet, visiter). Tranché le 30/09 :
--      pas de « compte visiteur » anonyme (il créerait une fausse ligne dans users à chaque visite).
--      Tout ici est en lecture, exécutable par anon, et ne rend ni position ni personne :
--   1. natures_publiques() : les natures et leur nombre de lieux, les plus fournies d'abord.
--   2. recherche_publique(p_texte, p_nature, p_limite) : les lieux dont le nom contient le texte
--      (sans accents ni majuscules ; ceux qui COMMENCENT par lui d'abord), ou ceux d'une nature ;
--      plus les natures dont le nom le contient.
--   3. activite_publique(p_limite) : ce qui vient de se passer, anonyme (« un Explorateur »).
--   4. apercu_lieu(p_id) : l'aperçu d'un lieu pour un visiteur — le début du récit seulement.
--      Seuls les lieux publics (ni masqués, ni privés) sortent, même pour leur auteur.
-- SCHEMA CHECKED (30/09/2026, information_schema live) : places(id, title, text, departement,
--      pays, era_id, images, masked, private, created_at) ; place_tags(place_id, tag_id,
--      is_primary) ; tags(id, title, icon, color, "order") ; eras(id, name) ;
--      places_discovered(place_id, user_id, method, discovered_at) ; place_explorers(place_id,
--      user_id, visited_at) ; unaccent (schéma public) ; _photos_du_lieu(text) (388).

CREATE OR REPLACE FUNCTION public._lieu_public(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM places WHERE id = p_id AND masked IS NOT TRUE AND private IS NOT TRUE);
$function$;
REVOKE ALL ON FUNCTION public._lieu_public(text) FROM PUBLIC, anon, authenticated;

-- La nature principale d'un lieu, telle que les écrans la montrent.
CREATE OR REPLACE FUNCTION public._nature_de(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_id
  ORDER BY pt.is_primary DESC, t."order"
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public._nature_de(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.natures_publiques()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon,
                                             'couleur', t.color, 'nombre', n.nombre)
                           ORDER BY n.nombre DESC, t."order"), '[]'::json)
  FROM tags t
  JOIN LATERAL (
    SELECT count(*) AS nombre FROM place_tags pt JOIN places p ON p.id = pt.place_id
    WHERE pt.tag_id = t.id AND pt.is_primary AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
  ) n ON true;
$function$;

CREATE OR REPLACE FUNCTION public.recherche_publique(
  p_texte text DEFAULT NULL,
  p_nature text DEFAULT NULL,
  p_limite integer DEFAULT 8
)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (
    SELECT NULLIF(unaccent(lower(btrim(COALESCE(p_texte, '')))), '') AS t,
           least(greatest(COALESCE(p_limite, 8), 1), 40) AS n
  ),
  trouves AS (
    SELECT p.id, p.title, p.departement, p.pays, p.created_at,
           unaccent(lower(p.title)) LIKE q.t || '%' AS commence,
           jsonb_array_length(COALESCE(p.images, '[]'::jsonb)) > 0 AS avec_photo
    FROM places p, q
    WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
      AND (q.t IS NULL OR unaccent(lower(p.title)) LIKE '%' || q.t || '%')
      AND (p_nature IS NULL OR EXISTS (SELECT 1 FROM place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_nature))
      AND (q.t IS NOT NULL OR p_nature IS NOT NULL)
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM trouves),
    'lieux', COALESCE((
      SELECT json_agg(json_build_object(
          'id', l.id, 'nom', l.title,
          'region', COALESCE(NULLIF(btrim(l.departement), ''), NULLIF(btrim(l.pays), '')),
          'nature', public._nature_de(l.id),
          'vignette', public._photos_du_lieu(l.id)->0->>'vignette')
        ORDER BY l.commence DESC, l.avec_photo DESC, l.created_at DESC)
      FROM (SELECT * FROM trouves ORDER BY commence DESC, avec_photo DESC, created_at DESC
            LIMIT (SELECT n FROM q)) l), '[]'::json),
    'natures', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color))
      FROM tags t, q WHERE q.t IS NOT NULL AND unaccent(lower(t.title)) LIKE '%' || q.t || '%'), '[]'::json));
$function$;

CREATE OR REPLACE FUNCTION public.activite_publique(p_limite integer DEFAULT 8)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('sorte', x.sorte, 'quand', x.quand,
                                             'lieu', json_build_object('id', x.id, 'nom', x.title))
                           ORDER BY x.quand DESC), '[]'::json)
  FROM (
    SELECT a.sorte, a.quand, p.id, p.title
    FROM (
      (SELECT 'decouverte' AS sorte, place_id, discovered_at AS quand FROM places_discovered
       WHERE method = 'remote' ORDER BY discovered_at DESC LIMIT 20)
      UNION ALL
      (SELECT 'visite', place_id, visited_at FROM place_explorers ORDER BY visited_at DESC LIMIT 20)
      UNION ALL
      (SELECT 'ajout', id, created_at FROM places ORDER BY created_at DESC LIMIT 20)
    ) a
    JOIN places p ON p.id = a.place_id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    WHERE a.quand IS NOT NULL
    ORDER BY a.quand DESC
    LIMIT least(greatest(COALESCE(p_limite, 8), 1), 20)
  ) x;
$function$;

CREATE OR REPLACE FUNCTION public.apercu_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_public(p_id) THEN NULL ELSE (
    SELECT json_build_object(
      'id', p.id,
      'nom', p.title,
      'region', COALESCE(NULLIF(btrim(p.departement), ''), NULLIF(btrim(p.pays), '')),
      'nature', public._nature_de(p.id),
      'epoque', (SELECT e.name FROM eras e WHERE e.id = p.era_id AND e.id <> 'unknown'),
      'photo', public._photos_du_lieu(p.id)->0->>'url',
      'photos', json_array_length(public._photos_du_lieu(p.id)),
      'explorateurs', (SELECT count(*) FROM place_explorers e WHERE e.place_id = p.id),
      -- Le début du récit seulement, coupé à un mot : le reste se lit avec un compte.
      'extrait', CASE WHEN char_length(COALESCE(p.text, '')) <= 280 THEN NULLIF(btrim(p.text), '')
                      ELSE regexp_replace(left(p.text, 280), '\s+\S*$', '') || '…' END,
      'suite', char_length(COALESCE(p.text, '')) > 280)
    FROM places p WHERE p.id = p_id) END;
$function$;

REVOKE ALL ON FUNCTION public.natures_publiques() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recherche_publique(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activite_publique(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apercu_lieu(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.natures_publiques() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recherche_publique(text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activite_publique(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apercu_lieu(text) TO anon, authenticated;
