-- 365 — Visiter en GPS, être présent, revendiquer
--
-- WHY : spec 2026-09-28-v2-fiche-lieu-design.md §4-6. Le serveur juge la portée (200 m) ; la
-- présence en direct sert à une seule chose : proposer comme compagnons les Explorateurs qui
-- sont là maintenant, et seulement à qui est lui-même sur place. Une position par Explorateur,
-- écrasée, oubliée après 10 minutes, jamais lue directement. Revendiquer écrit ce que plant_flag
-- (V1) écrit pour une veille — expédition, membres, place_veille, veille_history — sans la Cour,
-- sans points ni Couronnes : la V1 affichera la même revendication.
--
-- SCHEMA CHECKED (28/09/2026) : places(id, latitude, longitude, nature) ; place_explorers
--   (place_id, user_id, visited_at, unique(place_id,user_id)) ; places_discovered(user_id,
--   place_id, method, discovered_at, pk(user_id,place_id)) ; expeditions(id uuid défaut,
--   place_id, is_neutral, faction_id, created_at, title) ; expedition_members(expedition_id,
--   user_id, faction_id, pk) ; place_veille(place_id pk, expedition_id, faction_id, is_neutral,
--   planted_at, by_influence, previous_expedition_id, veilleur_user_id) ; veille_history
--   (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at) ; users(id,
--   faction_id, display_name, first_name, avatar_url) ; PostGIS dans le schéma extensions.

CREATE TABLE IF NOT EXISTS public.presences (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  vu_a timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.presences FROM anon, authenticated;

-- Distance en mètres entre deux points (sphère), pour la portée et les compagnons.
CREATE OR REPLACE FUNCTION public._distance_m(p_lat1 float8, p_lng1 float8, p_lat2 float8, p_lng2 float8)
RETURNS float8
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT ST_DistanceSphere(ST_MakePoint(p_lng1, p_lat1), ST_MakePoint(p_lng2, p_lat2));
$$;
REVOKE ALL ON FUNCTION public._distance_m(float8, float8, float8, float8) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.signaler_presence(p_lat float8, p_lng float8)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  INSERT INTO presences (user_id, latitude, longitude, vu_a)
  VALUES ((auth.uid())::text, p_lat, p_lng, now())
  ON CONFLICT (user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, vu_a = now();
  DELETE FROM presences WHERE vu_a < now() - interval '10 minutes';
END;
$$;
REVOKE ALL ON FUNCTION public.signaler_presence(float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_presence(float8, float8) TO authenticated;

CREATE OR REPLACE FUNCTION public.visiter_lieu(p_id text, p_lat float8, p_lng float8)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_lieu record;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places WHERE id = p_id AND public._lieu_visible(p_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(p_lat, p_lng, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_id, v_moi, now())
  ON CONFLICT (place_id, user_id) DO UPDATE SET visited_at = now();
  INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_id, 'gps', now())
  ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  PERFORM public.signaler_presence(p_lat, p_lng);
  RETURN json_build_object('visiteLe', now());
END;
$$;
REVOKE ALL ON FUNCTION public.visiter_lieu(text, float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visiter_lieu(text, float8, float8) TO authenticated;

-- Les présents à moins de 200 m du lieu — montrés seulement à qui y est lui-même, maintenant.
CREATE OR REPLACE FUNCTION public._presents_autour(p_id text)
RETURNS TABLE (user_id text, distance float8)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pr.user_id, public._distance_m(pr.latitude, pr.longitude, l.latitude, l.longitude)
  FROM presences pr, places l
  WHERE l.id = p_id
    AND pr.vu_a > now() - interval '10 minutes'
    AND public._distance_m(pr.latitude, pr.longitude, l.latitude, l.longitude) <= 200;
$$;
REVOKE ALL ON FUNCTION public._presents_autour(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compagnons_possibles(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'distance', round(a.distance / 10) * 10) ORDER BY a.distance), '[]'::json)
  FROM public._presents_autour(p_id) a JOIN users u ON u.id = a.user_id
  WHERE a.user_id <> (auth.uid())::text
    AND public._lieu_visible(p_id)
    AND EXISTS (SELECT 1 FROM public._presents_autour(p_id) m WHERE m.user_id = (auth.uid())::text);
$$;
REVOKE ALL ON FUNCTION public.compagnons_possibles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnons_possibles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_faction text;
  v_expedition uuid;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_valides) = 0 THEN
    v_nom := NULL; -- seul : la pilule porte son nom
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title)
  VALUES (p_id, v_faction IS NULL, v_faction, v_nom)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (v_valides || v_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, v_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = v_moi;
  INSERT INTO veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  VALUES (p_id, v_expedition, v_moi, v_faction, v_faction IS NULL, now());

  RETURN json_build_object('nom', COALESCE(v_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi)));
END;
$$;
REVOKE ALL ON FUNCTION public.revendiquer_lieu(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revendiquer_lieu(text, text[], text) TO authenticated;
