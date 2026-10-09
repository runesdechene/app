-- WHY: Uriel, 30/09 : les filtres de la carte (maquette Figma « Carte — Filtrer ») : Ma progression
--      (Tout · À découvrir · Visités · Ajoutés), Natures, Époques. La carte filtre les lieux déjà
--      chargés, sans requête de plus :
--      1. carte_lieux rend aussi, pour chaque lieu, toutes ses natures, son époque et « ajouté par
--         moi » (définition live de la 363, copiée entière) ;
--      2. filtres_de_carte() : les natures (nom, icône, couleur) et les époques dans l'ordre du
--         temps, « Indéfinie » et « Non concerné » à la fin — ce que la feuille propose.
-- SCHEMA CHECKED (30/09/2026) : places(id, era_id, author_id) ; place_tags(place_id, tag_id,
--      is_primary) ; tags(id, title, icon, color, "order") ; eras(id, name, sort_order) — ids
--      'unknown' (Indéfinie) et 'not-applicable' (Non concerné, 395).

CREATE OR REPLACE FUNCTION public.carte_lieux()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'nom', p.title,
    'lat', p.latitude,
    'lng', p.longitude,
    'nature', p.nature,
    'icone', t.icon,
    'couleur', t.color,
    -- Pour les filtres (396) : toutes ses natures, son époque, et si je l'ai ajouté.
    'natures', COALESCE((SELECT json_agg(x.tag_id) FROM place_tags x WHERE x.place_id = p.id), '[]'::json),
    'epoque', p.era_id,
    'ajoute', p.author_id = moi.id,
    'etat', CASE
      WHEN EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = moi.id) THEN 'visite'
      WHEN p.author_id = moi.id
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = p.id AND d.user_id = moi.id) THEN 'connu'
      ELSE 'inconnu' END,
    -- Le nom sur la pilule : celui de l'expédition, sinon celui du dernier qui l'a revendiqué.
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur'),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id))
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = p.id AND p.nature = 'lieu')
  )), '[]'::json)
  FROM places p
  CROSS JOIN moi
  LEFT JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND ((p.masked IS NOT TRUE AND p.private IS NOT TRUE) OR p.author_id = moi.id);
$$;

CREATE OR REPLACE FUNCTION public.filtres_de_carte()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'natures', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
        ORDER BY t."order", t.title)
      FROM tags t), '[]'::json),
    'epoques', COALESCE((
      SELECT json_agg(json_build_object('id', e.id, 'nom', e.name)
        ORDER BY e.id IN ('unknown', 'not-applicable'), e.sort_order)
      FROM eras e), '[]'::json));
$$;
REVOKE ALL ON FUNCTION public.filtres_de_carte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filtres_de_carte() TO authenticated;
