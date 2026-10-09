-- 363 — La carte d'Explore
--
-- WHY : spec 2026-09-28-v2-carte-design.md. Une lecture unique de tous les lieux visibles avec
-- l'état propre à celui qui regarde (inconnu / connu / visité) et la revendication affichée ;
-- le nom du territoire au centre de la carte ; le point d'intérêt (« Curiosité » : trop petit pour
-- être un lieu) ; l'option « Mes lieux en couleur ». Lectures seules, auth.uid().
-- `get_my_preferences` et `set_my_preference` partent de leur définition live (353), copiée
-- entière ; seule la nouvelle préférence s'ajoute.
--
-- SCHEMA CHECKED (28/09/2026) : places(id, title, latitude, longitude, author_id, private, masked) ;
--   place_tags(place_id, tag_id, is_primary) ; tags(id, icon, color) ;
--   place_explorers(place_id, user_id) — unique (place_id, user_id) ;
--   places_discovered(user_id, place_id) — pk (user_id, place_id) ;
--   place_veille(place_id, expedition_id, veilleur_user_id) ; expeditions(id, title) ;
--   expedition_members(expedition_id, user_id) ; users(display_name, first_name) ;
--   geo_departements(nom, geom) ; geo_pays(nom_fr, geom) (migration 349).

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'lieu'
  CHECK (nature IN ('lieu', 'curiosite'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lieux_en_couleur boolean NOT NULL DEFAULT false;

-- Les noms historiques des territoires, fixés par Uriel. Sans entrée : le nom du département.
CREATE TABLE IF NOT EXISTS public.territoires_historiques (
  departement text PRIMARY KEY,   -- = geo_departements.nom
  nom text NOT NULL
);
ALTER TABLE public.territoires_historiques ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.territoires_historiques FROM anon, authenticated;
INSERT INTO public.territoires_historiques (departement, nom)
VALUES ('Alpes-Maritimes', 'Comté de Nice') ON CONFLICT DO NOTHING;

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
REVOKE ALL ON FUNCTION public.carte_lieux() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carte_lieux() TO authenticated;

-- Au-dessus de la mer ou hors des contours : ni territoire ni pays (pas de repli « au plus
-- proche » comme `_rattacher_lieu`, mig 351 — ici on VEUT « rien »).
CREATE OR REPLACE FUNCTION public.territoire_en(p_lat float8, p_lng float8)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT json_build_object(
    'territoire', CASE WHEN r.departement IS NOT NULL THEN
      COALESCE((SELECT h.nom FROM territoires_historiques h WHERE h.departement = r.departement), r.departement)
    END,
    'pays', r.pays)
  FROM (
    SELECT
      (SELECT d.nom FROM geo_departements d
        WHERE ST_Contains(d.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) LIMIT 1) AS departement,
      (SELECT g.nom_fr FROM geo_pays g
        WHERE ST_Contains(g.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) LIMIT 1) AS pays
  ) r;
$$;
REVOKE ALL ON FUNCTION public.territoire_en(float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territoire_en(float8, float8) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_preferences()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'email', u.email_address,
    'brouillerPistes', u.brouiller_pistes,
    'pushImportant', u.push_important_enabled,
    'pushRecap', u.push_recap_enabled,
    'showDepartement', u.show_departement,
    'showEnvies', u.show_envies,
    'lieuxEnCouleur', u.lieux_en_couleur,
    'titleGender', u.title_gender
  )
  FROM public.users u
  WHERE u.id = (auth.uid())::text;
$function$;
REVOKE ALL ON FUNCTION public.get_my_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_preferences() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_preference(p_cle text, p_valeur boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_valeur IS NULL THEN
    RAISE EXCEPTION 'Valeur manquante' USING ERRCODE = '22004';
  END IF;
  CASE p_cle
    WHEN 'show_departement'       THEN UPDATE users SET show_departement = p_valeur       WHERE id = (auth.uid())::text;
    WHEN 'show_envies'            THEN UPDATE users SET show_envies = p_valeur            WHERE id = (auth.uid())::text;
    WHEN 'push_important_enabled' THEN UPDATE users SET push_important_enabled = p_valeur WHERE id = (auth.uid())::text;
    WHEN 'push_recap_enabled'     THEN UPDATE users SET push_recap_enabled = p_valeur     WHERE id = (auth.uid())::text;
    WHEN 'lieux_en_couleur'       THEN UPDATE users SET lieux_en_couleur = p_valeur       WHERE id = (auth.uid())::text;
    ELSE RAISE EXCEPTION 'Préférence inconnue : %', p_cle USING ERRCODE = '22023';
  END CASE;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_my_preference(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_preference(text, boolean) TO authenticated;
