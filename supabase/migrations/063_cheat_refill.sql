-- ============================================
-- MIGRATION 063 : Cheat code — refill ressources
-- ============================================
-- RPC admin-only : remet les 3 jauges au max en base.
-- Vérifie que l'user est admin (role = 'admin').
-- ============================================

CREATE OR REPLACE FUNCTION public.cheat_refill(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_max_energy NUMERIC(4,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  -- Vérifier que c'est un admin
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Lire les max + bonus faction
  SELECT u.max_energy, u.max_conquest, u.max_construction,
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- Mettre au max + reset timestamps
  UPDATE users
  SET energy_points = v_max_energy + v_bonus_energy,
      energy_reset_at = NOW(),
      conquest_points = v_max_conquest + v_bonus_conquest,
      conquest_reset_at = NOW(),
      construction_points = v_max_construction + v_bonus_construction,
      construction_reset_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'energy', v_max_energy + v_bonus_energy,
    'maxEnergy', v_max_energy + v_bonus_energy,
    'conquestPoints', v_max_conquest + v_bonus_conquest,
    'maxConquest', v_max_conquest + v_bonus_conquest,
    'constructionPoints', v_max_construction + v_bonus_construction,
    'maxConstruction', v_max_construction + v_bonus_construction
  );
END;
$$;
