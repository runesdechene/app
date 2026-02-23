-- ============================================
-- MIGRATION 041 : Systeme de Notoriete
-- ============================================
-- Notoriete personnelle : +10 au claim, +5 a la fortification
-- Notoriete de faction  : temporelle, basee sur la duree de
--   controle des territoires avec bonus de fortification.
-- Remplace le pourcentage dans le FactionBar.
-- ============================================
-- Multiplicateur fortification :
--   Lvl 0 = x1.0 | Lvl 1 = x1.5 | Lvl 2 = x2.0
--   Lvl 3 = x2.5 | Lvl 4 = x3.0
-- ============================================

-- 1. Schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS notoriety_points INT NOT NULL DEFAULT 0;

-- ============================================
-- 2. get_faction_notoriety — calcul temps reel
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_notoriety()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      f.id AS "factionId",
      f.title,
      f.color,
      f.pattern,
      COUNT(p.id)::INT AS "placesCount",
      COALESCE(SUM(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
        * (1 + p.fortification_level * 0.5)
      ), 0)::INT AS notoriety
    FROM factions f
    LEFT JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
    GROUP BY f.id, f.title, f.color, f.pattern, f."order"
    ORDER BY notoriety DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_notoriety TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_notoriety TO anon;

-- ============================================
-- 3. claim_place — notoriete au lieu de rewards tag
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
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
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

  -- Revendiquer le lieu + reset fortification
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Deduire conquete + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Recuperer l'etat final
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

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

-- ============================================
-- 4. fortify_place — +5 notoriete
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
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de defense', 'Bastion', 'Befroi'];
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Construction regen (pour retourner nextPointIn)
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
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

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  -- Cout du prochain niveau
  v_cost := v_costs[v_current_level + 1];

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
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;

-- ============================================
-- 5. get_user_energy — ajouter notorietyPoints
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Energie (+0.5/h -> 1 pt toutes les 7200s)
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1) := 5.0;
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  -- Conquete (+0.25/h -> 1 pt toutes les 14400s)
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  -- Construction (+0.25/h -> 1 pt toutes les 14400s)
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  -- Notoriete
  v_notoriety INT;
BEGIN
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at,
         notoriety_points
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at,
       v_notoriety
  FROM users WHERE id = p_user_id;

  -- ---- ENERGIE (cycle 7200s, taux fixe 1) ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE (cycle 14400s, taux fixe 1) ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION (cycle 14400s, taux fixe 1) ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', COALESCE(v_notoriety, 0)
  );
END;
$$;

-- ============================================
-- 6. get_player_profile — ajouter notorietyPoints
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
BEGIN
  -- Recuperer l'avatar via image_media
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (SELECT COUNT(*) FROM places_discovered pd WHERE pd.user_id = u.id),
    'claimedCount', (SELECT COUNT(DISTINCT pc.place_id) FROM place_claims pc WHERE pc.user_id = u.id),
    'likesCount', (SELECT COUNT(*) FROM places_liked pl WHERE pl.user_id = u.id),
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
