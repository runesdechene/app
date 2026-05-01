-- 047_v07_levels_helpers.sql
-- WHY : helpers pour le système Niveaux V0.7.
--   - _user_level_state(user_id) : lit xp_total + niveau dérivé en un seul JSON
--     Utilisé par le front pour faire un AVANT/APRÈS lecture autour des actions
--     et déclencher la modale level up sans wrapper sur chaque RPC d'action.
--   - _require_min_level(user_id, min) : check niveau >= seuil, retourne JSON
--     d'erreur sinon. Utilisé pour le gating "cartographier" (= add_place)
--     au niveau 3 minimum.

-- Helper : lit xp_total et le niveau correspondant
CREATE OR REPLACE FUNCTION public._user_level_state(p_user_id text)
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'xpTotal', COALESCE(xp_total, 0),
    'level',   public._level_from_xp(COALESCE(xp_total, 0))
  )
  FROM public.users WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public._user_level_state(text) TO authenticated, anon, service_role;

-- Helper réutilisable pour le check niveau (gating)
CREATE OR REPLACE FUNCTION public._require_min_level(p_user_id text, p_min_level integer)
RETURNS json LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_level integer;
BEGIN
  SELECT public._level_from_xp(COALESCE(xp_total, 0)) INTO v_level
  FROM public.users WHERE id = p_user_id;
  IF v_level IS NULL OR v_level < p_min_level THEN
    RETURN json_build_object('error', 'level_too_low', 'requiredLevel', p_min_level, 'currentLevel', COALESCE(v_level, 1));
  END IF;
  RETURN NULL; -- pas d'erreur, autorisé
END;
$$;

GRANT EXECUTE ON FUNCTION public._require_min_level(text, integer) TO authenticated, anon, service_role;
