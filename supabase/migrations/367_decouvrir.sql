-- 367 — Le geste « Découvrir »
--
-- WHY : Uriel, 28/09 (maquettes Figma 250:128 / 250:134 / 250:140). Toucher un lieu inconnu
--   ouvre son voile de parchemin ; le doigt le déchire, puis vient la récompense : le rang de la
--   découverte et l'expérience gagnée. Découvrir est gratuit et sans limite (décidé le 27-28/09).
--   1. decouvrir_lieu écrit la découverte dans places_discovered, méthode 'remote' — la table
--      que lisent la carte (carte_lieux, 363) et la V1. Son déclencheur trg_xp_discovered_ins
--      donne l'expérience (glory.discover_remote, +1) : le niveau est partagé V1/V2, voulu.
--      Rien d'autre de la découverte V1 (énergie, Couronnes, quête du jour) : en sommeil en V2.
--   2. fiche_lieu dit si le lieu est déjà découvert pour celui qui regarde (moi.decouvert).
--      Elle part de sa définition en 366 (pas encore appliquée à l'écriture : 366 passe avant),
--      copiée entière.
--
-- SCHEMA CHECKED (28/09/2026) : places_discovered(user_id varchar, place_id varchar, method
--   varchar défaut 'remote', discovered_at défaut now(), PRIMARY KEY (user_id, place_id)) ;
--   users.xp_total ; _level_from_xp(int) ; _xp_for_level(int) ; app_settings(key, value) :
--   glory.discover_remote = 1 ; places.author_id ; place_explorers(place_id, user_id).

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'photos', COALESCE((
      SELECT json_agg(json_build_object('url', i->>'url', 'vignette', COALESCE(i->>'thumb', i->>'url')))
      FROM jsonb_array_elements(COALESCE(l.images, '[]'::jsonb)) i
      WHERE i->>'url' IS NOT NULL), '[]'::json),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id),
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
$$;
REVOKE ALL ON FUNCTION public.fiche_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiche_lieu(text) TO authenticated;

-- Découvrir un lieu : rend le rang de la découverte, l'expérience gagnée et le niveau, avec la
-- jauge avant et après (0 à 1 dans le niveau). Déjà découvert : rien ne change, gain 0.
CREATE OR REPLACE FUNCTION public.decouvrir_lieu(p_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_xp_avant int;
  v_xp_apres int;
  v_niveau int;
  v_seuil int;
  v_suivant int;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi;
  -- Un lieu qu'on a ajouté ou visité est déjà connu : pas de découverte à distance en plus.
  IF NOT EXISTS (SELECT 1 FROM places p WHERE p.id = p_id AND p.author_id = v_moi)
     AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p_id AND e.user_id = v_moi) THEN
    INSERT INTO places_discovered (user_id, place_id, method) VALUES (v_moi, p_id, 'remote')
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;

  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);
  RETURN json_build_object(
    'rang', (SELECT count(*) FROM places_discovered d WHERE d.user_id = v_moi),
    'gain', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro.
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3));
END;
$$;
REVOKE ALL ON FUNCTION public.decouvrir_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decouvrir_lieu(text) TO authenticated;
