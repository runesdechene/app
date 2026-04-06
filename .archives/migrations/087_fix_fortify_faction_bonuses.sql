-- ============================================
-- MIGRATION 087 : Fix fortify_place — bonus faction + notoriete
-- ============================================
-- Bugs corriges :
-- 1. max_construction et construction_cycle etaient hardcodes (5.0 / 14400)
--    au lieu de lire les bonus faction (bonus_construction, bonus_regen_construction).
--    => Les factions avec bonus construction ne beneficiaient pas de leurs bonus.
-- 2. La notoriete (+5 par niveau) avait ete supprimee par accident dans la migration 061.
--    Le toast frontend affichait "+5 Notoriete" mais rien ne se passait cote serveur.
-- 3. notorietyPoints n'etait pas retourne dans la reponse JSON.
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
  v_max_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_place_tags TEXT[];
  -- Pour le log d'activite
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  -- Verifier faction du user + lire max et cycle avec bonus faction
  SELECT u.faction_id,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_user_faction, v_max_construction, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe et est revendique par la faction du user
  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  -- Max level depuis la table
  SELECT MAX(level) INTO v_max_level FROM construction_types;
  IF v_max_level IS NULL THEN v_max_level := 0; END IF;

  IF v_current_level >= v_max_level THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Tags du lieu (pour filtrage optionnel)
  SELECT ARRAY_AGG(tag_id) INTO v_place_tags
  FROM place_tags WHERE place_id = p_place_id;

  -- Cout et nom du prochain niveau
  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct
  WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN
    RETURN json_build_object('error', 'No construction type available for this level');
  END IF;

  -- Verifier les points de construction
  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  -- Deduire les points + ajouter notoriete
  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  -- Incrementer le niveau
  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Logger l'activite avec le VRAI acteur (p_user_id, pas claimed_by)
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

  -- Recuperer l'etat final
  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Construction next point
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name,
    'cost', v_cost
  );
END;
$$;
