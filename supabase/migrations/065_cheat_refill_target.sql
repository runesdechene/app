-- ============================================
-- MIGRATION 065 : Cheat code — refill un joueur cible par nom
-- ============================================
-- RPC admin-only. Cherche le joueur par first_name (insensible a la casse),
-- recharge ses 3 jauges au max.
-- ============================================

CREATE OR REPLACE FUNCTION public.cheat_refill_target(
  p_caller_id TEXT,
  p_target_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_target RECORD;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Verifier que l'appelant est admin
  SELECT role INTO v_role FROM users WHERE id = p_caller_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Trouver le joueur cible par first_name (insensible a la casse)
  SELECT id, first_name INTO v_target
  FROM users
  WHERE LOWER(first_name) = LOWER(TRIM(p_target_name))
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN json_build_object('error', 'Joueur introuvable');
  END IF;

  -- Lire les max + bonus faction de la cible
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = v_target.id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = v_target.id;

  RETURN json_build_object(
    'success', true,
    'targetName', v_target.first_name,
    'targetId', v_target.id
  );
END;
$$;
