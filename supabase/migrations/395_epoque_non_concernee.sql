-- WHY: Uriel, 30/09 : certaines natures n'ont pas d'époque (un spot de van, une source, un abri
--      naturel…) : un statut « Non concerné », à côté de « Indéfinie ». Validé avec lui :
--      1. l'époque « Non concerné » (not-applicable), rangée après les autres ;
--      2. les huit natures sans époque le portent (tags.hors_epoque) : les choisir en premier, à
--         l'ajout d'un lieu, coche « Non concerné » ;
--      3. les lieux existants dont la nature principale est l'une d'elles, et dont l'époque est vide
--         ou « Indéfinie », passent en « Non concerné » (728 lieux comptés le 30/09) ; une époque
--         déjà renseignée (78 lieux) n'est pas touchée ;
--      4. « Non concerné » ne s'affiche pas : la fiche et l'aperçu taisent l'époque.
--      natures_de_lieu, fiche_lieu et apercu_lieu partent de leur définition live (381, 393, 391).
-- SCHEMA CHECKED (30/09/2026, information_schema live) : eras(id varchar, name, year_start,
--      year_end, sort_order smallint — 0 à 11) ; tags(id varchar, title, color, icon, "order"…) ;
--      places(era_id) ; place_tags(place_id, tag_id, is_primary). Identifiants des huit natures lus
--      en base.

INSERT INTO public.eras (id, name, sort_order)
VALUES ('not-applicable', 'Non concerné', 12)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS hors_epoque boolean NOT NULL DEFAULT false;
UPDATE public.tags SET hors_epoque = true
WHERE id IN ('spot-de-van', 'zz6Kc6zGd', 'WC51eGlMy', 'Y2QJZIKnAfhvL7PSeiNF',
             '5yOutD8Lp', '4zC0EoxJr', 'panoramique', 'DKZsetA4osbrXnntY8D8');

UPDATE public.places p SET era_id = 'not-applicable'
FROM public.place_tags pt JOIN public.tags t ON t.id = pt.tag_id
WHERE pt.place_id = p.id AND pt.is_primary AND t.hors_epoque
  AND (p.era_id IS NULL OR p.era_id = 'unknown');

CREATE OR REPLACE FUNCTION public.natures_de_lieu()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color,
      'horsEpoque', t.hors_epoque)
    ORDER BY t."order", t.title), '[]'::json)
  FROM tags t;
$$;

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'slug', l.slug, -- la page publique du lieu (/lieu/<slug>), pour le partage
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', public._photos_du_lieu(l.id),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      -- « Non concerné » (une source, un spot de van) ne se dit pas : pas d'époque à afficher.
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id AND e.id <> 'not-applicable'),
      'annee', l.year_exact,
      'saison', NULLIF(btrim(l.best_season), ''),
      'acces', NULLIF(btrim(l.accessibility), ''),
      'bivouac', NULLIF(btrim(l.bivouac), '')),
    'explorateurs', json_build_object(
      'nombre', (SELECT count(*) FROM place_explorers e WHERE e.place_id = l.id),
      'derniers', COALESCE((
        SELECT json_agg(d.x) FROM (
          SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) AS x
          FROM place_explorers e JOIN users u ON u.id = e.user_id
          WHERE e.place_id = l.id ORDER BY e.visited_at DESC LIMIT 3) d), '[]'::json)),
    -- La pilule : l'expédition si elle a un nom, sinon le dernier qui l'a revendiqué (comme 363).
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id),
        'depuis', v.planted_at)
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = l.id AND l.nature = 'lieu'),
    'auteur', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
      FROM users u WHERE u.id = l.author_id),
    'ajouteLe', l.created_at,
    -- Ajouté à distance (sans y être) : noté par le journal depuis le 08/04/2026, V1 comme V2.
    -- Avant, on ne sait pas : rien n'est dit.
    'ajoutADistance', EXISTS (
      SELECT 1 FROM activity_log a
      WHERE a.type = 'new_place' AND a.place_id = l.id AND a.data->>'isGps' = 'false'),
    'enrichiPar', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name))
      FROM place_description_revisions r JOIN users u ON u.id = r.edited_by
      WHERE r.place_id = l.id AND r.edited_by IS DISTINCT FROM l.author_id
      ORDER BY r.created_at DESC LIMIT 1),
    'moi', json_build_object(
      'visiteLe', (SELECT e.visited_at FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id),
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id),
      -- Découvert : ajouté, visité ou découvert à distance (la même règle que carte_lieux, 363).
      'decouvert', l.author_id = moi.id
        OR EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id)
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = l.id AND d.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
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
      'epoque', (SELECT e.name FROM eras e WHERE e.id = p.era_id AND e.id NOT IN ('unknown', 'not-applicable')),
      'photo', public._photos_du_lieu(p.id)->0->>'url',
      'photos', json_array_length(public._photos_du_lieu(p.id)),
      'explorateurs', (SELECT count(*) FROM place_explorers e WHERE e.place_id = p.id),
      -- Le début du récit seulement, coupé à un mot : le reste se lit avec un compte.
      'extrait', CASE WHEN char_length(COALESCE(p.text, '')) <= 280 THEN NULLIF(btrim(p.text), '')
                      ELSE regexp_replace(left(p.text, 280), '\s+\S*$', '') || '…' END,
      'suite', char_length(COALESCE(p.text, '')) > 280)
    FROM places p WHERE p.id = p_id) END;
$function$;
