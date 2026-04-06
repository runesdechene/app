-- ============================================
-- MIGRATION 176 : Ajouter gloryPreview dans preview_action_cost
-- ============================================
-- Retourne la Gloire projetée pour que le frontend l'affiche sous le bouton
-- Copie exacte de 171, seul ajout : lecture des settings glory + calcul

CREATE OR REPLACE FUNCTION public.preview_action_cost(
  p_user_id TEXT,
  p_place_id TEXT,
  p_action TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_fortify_level INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_detection_radius NUMERIC;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_preview INT;
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10) INTO v_detection_radius;

    IF v_place_faction IS NOT NULL AND v_zone_multiplier > 0 THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2
      WHERE p2.faction_id = v_place_faction
        AND p2.id != p_place_id
        AND p2.fortification_level > 0
        AND sqrt(pow((p2.latitude - v_place_lat) * 111, 2) + pow((p2.longitude - v_place_lng) * 79, 2)) <= v_detection_radius;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
  END IF;

  -- Fortification (fortify)
  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  -- Projection Gloire
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key =
    CASE p_action WHEN 'discover' THEN 'glory_discover' WHEN 'claim' THEN 'glory_claim' WHEN 'fortify' THEN 'glory_fortify' END
  ), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_preview := GREATEST(1, ROUND(v_glory_base + v_total * v_glory_cost_pct / 100));

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'gloryPreview', v_glory_preview,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_action_cost(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT) TO authenticated;
