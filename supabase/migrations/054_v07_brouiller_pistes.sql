-- 054_v07_brouiller_pistes.sql
-- WHY: Toggle "Brouiller mes pistes" (privacy-by-default GPS).
--      La position publique exposée aux autres voyageurs est randomisée dans 50 km
--      autour de la position réelle ; pour soi on continue de voir sa vraie position GPS.
--      Décision Uriel 2026-05-02 (option B) : pas de check "sur terre" pour V0.7+ —
--      voyageur littoral peut être flouté dans l'océan, edge case statistiquement rare,
--      à raffiner post-launch (PostGIS + Natural Earth) si gênant.
--
-- Architecture: la position des autres joueurs vit en Realtime presence (broadcast),
-- pas en DB. On expose donc une RPC pure qui calcule un point random dans un disque
-- 50 km, à appeler une fois au login côté client puis stable durant la session
-- (cohérence visuelle, cf. spec §3.2 — sinon "fantôme qui clignote").
--
-- Spec : docs/superpowers/specs/2026-05-01-v07-eco-merveille-mvp-design.md §3

-- 1. Toggle (privacy-by-default = true)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS brouiller_pistes boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.brouiller_pistes IS
  'V0.7+ — Si true (défaut), la position publique exposée aux autres voyageurs est randomisée dans 50 km autour de la vraie position. Soi voit toujours sa vraie position GPS.';

-- 2. RPC randomize_position_on_land(p_lat, p_lng) → json{lat, lng}
-- Distribution uniforme dans un disque (cf. https://stackoverflow.com/a/50746409) :
--   r = R * sqrt(u1)  pour u1 uniforme dans [0,1]
--   theta = 2π * u2
-- Conversion delta lat/lng (approx pour rayons modestes) :
--   delta_lat = r * cos(theta) / 111.32
--   delta_lng = r * sin(theta) / (111.32 * cos(lat_rad))
--
-- VOLATILE (default) — random() est volatile, ne pas marquer STABLE.
CREATE OR REPLACE FUNCTION public.randomize_position_on_land(
  p_lat numeric,
  p_lng numeric
) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_radius_km numeric := 50;
  v_u1 numeric;
  v_u2 numeric;
  v_r numeric;
  v_theta numeric;
  v_delta_lat numeric;
  v_delta_lng numeric;
  v_lat_rad numeric;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'lat_lng_required';
  END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'lat_lng_out_of_range';
  END IF;

  v_u1 := random();
  v_u2 := random();
  v_r := v_radius_km * sqrt(v_u1);
  v_theta := 2 * pi() * v_u2;
  v_lat_rad := radians(p_lat);

  v_delta_lat := (v_r * cos(v_theta)) / 111.32;
  -- GREATEST évite division par ~0 aux pôles
  v_delta_lng := (v_r * sin(v_theta)) / (111.32 * GREATEST(cos(v_lat_rad), 0.01));

  RETURN json_build_object(
    'lat', p_lat + v_delta_lat,
    'lng', p_lng + v_delta_lng
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.randomize_position_on_land(numeric, numeric) TO authenticated;

-- 3. RPC set_brouiller_pistes(p_enabled) — toggle on/off pour le user courant
CREATE OR REPLACE FUNCTION public.set_brouiller_pistes(
  p_enabled boolean
) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  UPDATE public.users
    SET brouiller_pistes = p_enabled,
        updated_at = NOW()
    WHERE id = v_user_id;

  RETURN json_build_object('ok', true, 'brouiller_pistes', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_brouiller_pistes(boolean) TO authenticated;
