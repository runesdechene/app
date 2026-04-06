-- ============================================
-- MIGRATION 066 : Corriger la regression de claim_place
-- ============================================
-- La migration 064 a ecrase claim_place avec une version simplifiee
-- qui a perdu : cout conquete, fortification, notoriete, bonus faction.
-- On restaure la logique complete de 049 + le tracking ancien proprio de 064.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  -- Ancien proprietaire (tracking 064)
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Cout dynamique : 1 + niveau de fortification
  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  -- Capturer l'ancien controleur AVANT l'update (tracking 064)
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu (reset fortification a 0)
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique (avec ancien proprio)
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  -- Deduire le cout + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Lire les valeurs mises a jour
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Calculer le temps avant prochain point de conquete
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Calculer le temps avant prochain point de construction
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;
