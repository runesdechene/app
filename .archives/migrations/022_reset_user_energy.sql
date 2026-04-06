-- Migration 022 : RPC pour recharger l'énergie d'un joueur

CREATE OR REPLACE FUNCTION public.reset_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
BEGIN
  UPDATE users
  SET energy_points = 5, energy_reset_at = NOW()
  WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  RETURN json_build_object('energy', COALESCE(v_energy, 5));
END;
$$;
