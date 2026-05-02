-- 061_v07_gating_create_place_by_discoveries.sql
-- WHY: remplace le gating niveau 3 (mig 048) par "3 lieux découverts" — règle
--      simple, prévisible, indépendante du système de quêtes (partiellement
--      cassé suite au rollback mig 058) et du système de niveaux qui dépend
--      des triggers XP. Décision Uriel 2026-05-02 : "Un joueur doit pouvoir
--      ajouter un lieu dès lors qu'il en a découvert au moins 3. Point."

CREATE OR REPLACE FUNCTION public._require_min_discoveries(
  p_user_id text,
  p_min integer
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.places_discovered
    WHERE user_id = p_user_id;
  IF v_count < p_min THEN
    RETURN json_build_object(
      'error', 'not_enough_discoveries',
      'requiredDiscoveries', p_min,
      'currentDiscoveries', v_count
    );
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public._require_min_discoveries(text, integer) TO authenticated, anon, service_role;

-- Re-définit le wrapper create_place : check 3 découvertes au lieu de niveau 3.
-- Délègue ensuite à _create_place_internal (renommé par mig 048).
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
  v_check_err := public._require_min_discoveries(p_user_id, 3);
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
