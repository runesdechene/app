-- WHY: quatre paliers pour découvrir loin (Uriel, 01/10/2026) : gratuit à moins de 50 km, puis
--      1 point jusqu'à 150 km, 2 jusqu'à 500 km, 3 jusqu'à 1 000 km, 4 au-delà (et sans position).
--   1. Les réglages : un troisième palier (decouverte_palier_3_km) et un quatrième prix
--      (decouverte_cout_4) ; les paliers existants prennent leurs nouvelles valeurs.
--   2. _cout_decouverte (copiée de sa définition live) : quatre prix.
--   3. mon_energie (copiée de sa définition live) : la règle rendue à la V2 compte le palier et le
--      prix en plus.
-- SCHEMA CHECKED (01/10/2026, définitions live) : app_settings(key text PRIMARY KEY, value text) ;
--      _cout_decouverte(text, numeric, numeric) et mon_energie() copiées du live ; _reglage(text,
--      numeric) ; haversine_km(numeric x4) ; places(latitude real, longitude real).

INSERT INTO app_settings (key, value) VALUES
  ('decouverte_palier_1_km', '150'), ('decouverte_palier_2_km', '500'),
  ('decouverte_palier_3_km', '1000'),
  ('decouverte_cout_1', '1'), ('decouverte_cout_2', '2'), ('decouverte_cout_3', '3'),
  ('decouverte_cout_4', '4')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public._cout_decouverte(p_id text, p_lat numeric, p_lng numeric)
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH d AS (
    SELECT CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
                ELSE public.haversine_km(p_lat, p_lng, l.latitude::numeric, l.longitude::numeric) END AS km
    FROM places l WHERE l.id = p_id)
  SELECT json_build_object(
    'distanceKm', round(d.km, 0),
    'cout', (CASE
      WHEN d.km IS NULL THEN public._reglage('decouverte_cout_4', 4)
      WHEN d.km < public._reglage('decouverte_gratuite_km', 50) THEN 0
      WHEN d.km < public._reglage('decouverte_palier_1_km', 150) THEN public._reglage('decouverte_cout_1', 1)
      WHEN d.km < public._reglage('decouverte_palier_2_km', 500) THEN public._reglage('decouverte_cout_2', 2)
      WHEN d.km < public._reglage('decouverte_palier_3_km', 1000) THEN public._reglage('decouverte_cout_3', 3)
      ELSE public._reglage('decouverte_cout_4', 4) END)::int)
  FROM d;
$function$;

CREATE OR REPLACE FUNCTION public.mon_energie()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  v := public.get_user_energy((auth.uid())::text);
  RETURN json_build_object(
    'points', floor((v->>'energy')::numeric)::int,
    'max', (v->>'maxEnergy')::numeric::int,
    'prochainDans', CASE WHEN (v->>'energy')::numeric >= (v->>'maxEnergy')::numeric THEN NULL
                         ELSE (v->>'nextPointIn')::int END,
    'parPoint', (v->>'energyCycle')::int,
    'regle', json_build_object(
      'gratuitKm', public._reglage('decouverte_gratuite_km', 50),
      'palier1Km', public._reglage('decouverte_palier_1_km', 150),
      'palier2Km', public._reglage('decouverte_palier_2_km', 500),
      'palier3Km', public._reglage('decouverte_palier_3_km', 1000),
      'cout1', public._reglage('decouverte_cout_1', 1),
      'cout2', public._reglage('decouverte_cout_2', 2),
      'cout3', public._reglage('decouverte_cout_3', 3),
      'cout4', public._reglage('decouverte_cout_4', 4)));
END;
$function$;
