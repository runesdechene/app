-- 368 — L'Accueil d'Explore V2
--
-- WHY : l'onglet Accueil (spec V2 §5, maquette Figma 27:2) : « Nouvelles de la marque »,
--   « Ajoutés récemment », « Sur les chemins » et son seul geste social, Saluer.
--   1. accueil_nouveaute : la dernière annonce « produit » publiée (le Fragment du drop), avec
--      son lien vers la boutique — le pont vers la marque.
--   2. accueil_ajoutes : les derniers lieux ajoutés, sous la forme des cartes de lieu (photo,
--      icône du type, auteur et son portrait).
--   3. sur_les_chemins : le fil de la communauté, lu dans les tables qui font foi et non dans
--      activity_log (les visites faites en V2 n'y écrivent pas) : première visite
--      (place_explorers, jamais les revisites), lieu ajouté (places), nouvel Explorateur (users).
--      Ni Couronnes, ni énigmes, ni découvertes à distance. Une ligne au plus par personne, par
--      type et par jour. Chaque ligne porte son nombre de saluts et si je l'ai salué.
--   4. saluts + saluer : saluer une ligne (ou retirer son salut). On ne se salue pas soi-même.
--      La notification au salué attend la cloche de la V2 : la V1 ne connaît pas ce type.
--   Lieux masqués ou privés : jamais dans l'Accueil.
--
-- SCHEMA CHECKED (28/09/2026) : places(id varchar, title, images jsonb, created_at, author_id,
--   masked, private, nature, departement text, pays text, latitude, longitude) ;
--   place_explorers(id, place_id varchar, user_id varchar, visited_at) ;
--   users(id varchar, display_name, first_name, avatar_url, created_at) ;
--   user_public_name(p_user_id text, p_display_name text, p_first_name text) ;
--   place_tags(place_id, tag_id, is_primary) ; tags(id, icon) ;
--   announcements(id, type, title, cover_image, status, audience, published_at, cta_url,
--   cta_label).

CREATE OR REPLACE FUNCTION public.accueil_nouveaute()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'titre', a.title,
    'image', a.cover_image,
    'lien', NULLIF(btrim(a.cta_url), ''),
    'publieLe', a.published_at)
  FROM announcements a
  WHERE a.type = 'produit' AND a.status = 'published' AND a.published_at <= now()
  ORDER BY a.published_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.accueil_nouveaute() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accueil_nouveaute() TO authenticated;

CREATE OR REPLACE FUNCTION public.accueil_ajoutes(p_limite int DEFAULT 10)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(x.lieu ORDER BY x.cree DESC), '[]'::json)
  FROM (
    SELECT p.created_at AS cree, json_build_object(
      'id', p.id,
      'nom', p.title,
      'imageUrl', COALESCE(p.images->0->>'thumb', p.images->0->>'url'),
      'latitude', p.latitude,
      'longitude', p.longitude,
      'categorie', (SELECT json_build_object('icone', t.icon)
                    FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
                    WHERE pt.place_id = p.id AND pt.is_primary AND t.icon IS NOT NULL LIMIT 1),
      'auteur', (SELECT json_build_object('nom', user_public_name(u.id, u.display_name, u.first_name), 'avatarUrl', u.avatar_url)
                 FROM users u WHERE u.id = p.author_id)) AS lieu
    FROM places p
    WHERE p.nature = 'lieu' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    ORDER BY p.created_at DESC
    LIMIT least(greatest(p_limite, 1), 30)
  ) x;
$$;
REVOKE ALL ON FUNCTION public.accueil_ajoutes(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accueil_ajoutes(int) TO authenticated;

CREATE TABLE IF NOT EXISTS public.saluts (
  evenement text NOT NULL,          -- la ligne saluée : 'visite:<lieu>:<qui>', 'ajout:<lieu>', 'arrivee:<qui>'
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destinataire varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evenement, user_id)
);
CREATE INDEX IF NOT EXISTS saluts_destinataire ON public.saluts (destinataire);
ALTER TABLE public.saluts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saluts FROM PUBLIC, anon, authenticated;

-- L'auteur d'une ligne du fil, si elle existe et se montre ; sinon NULL. Sert à saluer.
CREATE OR REPLACE FUNCTION public._auteur_du_chemin(p_evenement text)
RETURNS varchar
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE split_part(p_evenement, ':', 1)
    WHEN 'visite' THEN (
      SELECT e.user_id FROM place_explorers e JOIN places p ON p.id = e.place_id
      WHERE e.place_id = split_part(p_evenement, ':', 2) AND e.user_id = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
    WHEN 'ajout' THEN (
      SELECT p.author_id FROM places p
      WHERE p.id = split_part(p_evenement, ':', 2) AND p.masked IS NOT TRUE AND p.private IS NOT TRUE)
    WHEN 'arrivee' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))
  END;
$$;
REVOKE ALL ON FUNCTION public._auteur_du_chemin(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite int DEFAULT 20)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  une_par_jour AS (
    SELECT DISTINCT ON (type, qui, quand::date) *
    FROM evenements ORDER BY type, qui, quand::date, quand DESC
  ),
  retenus AS (
    SELECT * FROM une_par_jour ORDER BY quand DESC LIMIT least(greatest(p_limite, 1), 50)
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', r.id,
      'type', r.type,
      'quand', r.quand,
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'nom', p.title, 'region', COALESCE(p.departement, p.pays)) END,
      'saluts', (SELECT count(*) FROM saluts s WHERE s.evenement = r.id),
      'salue', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = r.id AND s.user_id = moi.id))
    ORDER BY r.quand DESC), '[]'::json)
  FROM retenus r
  CROSS JOIN moi
  JOIN users u ON u.id = r.qui
  LEFT JOIN places p ON p.id = r.lieu;
$$;
REVOKE ALL ON FUNCTION public.sur_les_chemins(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sur_les_chemins(int) TO authenticated;

-- Saluer une ligne du fil, ou retirer son salut. Rend le nombre de saluts et si je salue.
CREATE OR REPLACE FUNCTION public.saluer(p_evenement text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur varchar;
  v_salue boolean;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  v_auteur := public._auteur_du_chemin(p_evenement);
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne se salue pas soi-même' USING ERRCODE = '22023';
  END IF;

  DELETE FROM saluts WHERE evenement = p_evenement AND user_id = v_moi;
  v_salue := NOT FOUND;
  IF v_salue THEN
    INSERT INTO saluts (evenement, user_id, destinataire) VALUES (p_evenement, v_moi, v_auteur);
  END IF;
  RETURN json_build_object(
    'saluts', (SELECT count(*) FROM saluts WHERE evenement = p_evenement),
    'salue', v_salue);
END;
$$;
REVOKE ALL ON FUNCTION public.saluer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saluer(text) TO authenticated;
