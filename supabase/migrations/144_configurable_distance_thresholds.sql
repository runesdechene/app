-- ============================================
-- MIGRATION 144 : Seuils de distance configurables
-- ============================================

INSERT INTO app_settings (key, value) VALUES ('distance_gps_km', '0.5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_close_km', '10') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mid_km', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_gps', '0.5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_close', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_mid', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('distance_mult_far', '3') ON CONFLICT (key) DO NOTHING;

-- Mettre à jour le helper distance_multiplier pour lire les settings
CREATE OR REPLACE FUNCTION public.distance_multiplier(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_gps NUMERIC;
  v_close NUMERIC;
  v_mid NUMERIC;
  v_mult_gps NUMERIC;
  v_mult_close NUMERIC;
  v_mult_mid NUMERIC;
  v_mult_far NUMERIC;
BEGIN
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_gps_km'), 0.5) INTO v_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_close_km'), 10) INTO v_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mid_km'), 50) INTO v_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_gps'), 0.5) INTO v_mult_gps;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_close'), 1) INTO v_mult_close;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_mid'), 2) INTO v_mult_mid;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_mult_far'), 3) INTO v_mult_far;

  RETURN CASE
    WHEN distance_km < v_gps THEN v_mult_gps
    WHEN distance_km < v_close THEN v_mult_close
    WHEN distance_km < v_mid THEN v_mult_mid
    ELSE v_mult_far
  END;
END;
$$;
