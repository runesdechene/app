-- ============================================
-- MIGRATION 145 : fortify_place utilise l'énergie au lieu de construction
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  -- Vérifier que le joueur a un héritage
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Vérifier que le lieu appartient au même héritage
  SELECT faction_id, fortification_level INTO v_place_faction, v_current_level FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  -- Tags du lieu
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'max_level');
  END IF;

  -- Vérifier l'énergie (au lieu de construction_points)
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'cost', v_cost
    );
  END IF;

  -- Déduire l'énergie + ajouter gloire
  UPDATE users
  SET energy_points = energy_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  -- Incrémenter le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Logger l'activité
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    p_user_id,
    p_place_id,
    v_user_faction,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1
    )
  );

  -- Récupérer l'état final
  SELECT energy_points, notoriety_points
  INTO v_energy, v_notoriety
  FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT) TO authenticated;
