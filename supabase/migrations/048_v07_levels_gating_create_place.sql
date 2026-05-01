-- 048_v07_levels_gating_create_place.sql
-- WHY : ajoute le gating "Cartographier" (= create_place) au niveau 3 minimum.
-- La logique métier originale est préservée : on RENAME create_place →
-- _create_place_internal, puis on crée un wrapper public.create_place avec la
-- même signature qui :
--   1. Lit le niveau de p_user_id via _require_min_level(p_user_id, 3)
--   2. Si niveau < 3 → retourne {"error":"level_too_low","requiredLevel":3,"currentLevel":N}
--   3. Sinon → délègue à _create_place_internal(...) avec les mêmes args
--
-- Reversible : pour retirer le gating, DROP wrapper + RENAME _create_place_internal back.

-- Étape 1 : RENAME la fonction existante (préserve les grants côté PostgreSQL)
ALTER FUNCTION public.create_place(
  text, text, real, real, text, jsonb, text, text, real, real, text, text, integer
) RENAME TO _create_place_internal;

-- Étape 2 : Re-grant explicit sur la fonction renommée (au cas où)
GRANT EXECUTE ON FUNCTION public._create_place_internal(
  text, text, real, real, text, jsonb, text, text, real, real, text, text, integer
) TO authenticated, service_role;

-- Étape 3 : Créer le nouveau wrapper public.create_place avec la MÊME signature
CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id     text,
  p_title       text,
  p_latitude    real,
  p_longitude   real,
  p_tag_id      text,
  p_images      jsonb   DEFAULT '[]'::jsonb,
  p_address     text    DEFAULT '',
  p_text        text    DEFAULT '',
  p_user_lat    real    DEFAULT NULL,
  p_user_lng    real    DEFAULT NULL,
  p_carnet_title text   DEFAULT NULL,
  p_era_id      text    DEFAULT NULL,
  p_year_exact  integer DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_check_err json;
BEGIN
  v_check_err := public._require_min_level(p_user_id, 3);
  IF v_check_err IS NOT NULL THEN
    RETURN v_check_err;
  END IF;
  RETURN public._create_place_internal(
    p_user_id, p_title, p_latitude, p_longitude, p_tag_id,
    p_images, p_address, p_text, p_user_lat, p_user_lng,
    p_carnet_title, p_era_id, p_year_exact
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_place(
  text, text, real, real, text, jsonb, text, text, real, real, text, text, integer
) TO authenticated, service_role;
