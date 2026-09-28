-- WHY: la rubrique « Près de toi » de l'Accueil (Uriel, 29/09) : les lieux les plus proches, à
--      100 km au plus, que je n'ai pas encore visités en GPS — le seul bloc de l'Accueil qui pousse
--      à sortir aujourd'hui. La position vient du téléphone et n'est ni gardée ni écrite.
--      « Visité en GPS » : place_explorers (la visite, mig 365) ou places_discovered en 'gps'
--      (visites de la V1). Lieux masqués ou privés : jamais. Photo et type comme les cartes de
--      l'Accueil (mig 368) et le badge de la fiche (mig 366).
-- SCHEMA CHECKED (29/09/2026, information_schema) : places(id varchar, title, latitude real,
--      longitude real, images jsonb, masked, private, nature) ; place_explorers(place_id, user_id,
--      visited_at) ; places_discovered(user_id, place_id, method, discovered_at) ;
--      place_tags(place_id, tag_id, is_primary) ; tags(id, title, icon, color) ; PostGIS 3.3.7.

CREATE OR REPLACE FUNCTION public.pres_de_moi(p_latitude double precision, p_longitude double precision)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions' -- PostGIS vit dans « extensions »
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  ici AS (SELECT ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography AS g),
  proches AS (
    SELECT p.*, ST_Distance(ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography, ici.g) AS metres
    FROM places p, ici, moi
    WHERE p.nature = 'lieu' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
      AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography, ici.g, 100000)
      AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = moi.id)
      AND NOT EXISTS (SELECT 1 FROM places_discovered d
                      WHERE d.place_id = p.id AND d.user_id = moi.id AND d.method = 'gps')
    ORDER BY metres
    LIMIT 3
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', p.id,
      'nom', p.title,
      'imageUrl', COALESCE(p.images->0->>'thumb', p.images->0->>'url'),
      'type', (SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
               FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
               WHERE pt.place_id = p.id AND pt.is_primary LIMIT 1),
      'metres', round(p.metres))
    ORDER BY p.metres), '[]'::json)
  FROM proches p;
$$;
REVOKE ALL ON FUNCTION public.pres_de_moi(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pres_de_moi(double precision, double precision) TO authenticated;
