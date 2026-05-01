-- 022_v07_unfreeze_influence_transition.sql
-- WHY : URGENT — la mig 015 a figé `place_influence_action` en no-op trop tôt,
-- ce qui frustre des users en prod qui ne peuvent plus dépenser leurs points
-- d'influence comme avant. La transition prévue était "douce" (V0.5 reste actif
-- pendant V0.7), pas un freeze net.
--
-- Cette migration restaure `place_influence_action` à son comportement V0.5
-- d'origine (proxy vers `_place_influence_action_internal`, baseline ligne 4834).
-- Le système Couronnes V0.7 phase 2 reste indépendant — pas de conflit visuel
-- car le coloriage carte est piloté par `place_veille` (V0.7), pas par
-- `place_influence` (V0.5, lecture héritée mais pas dominante).
--
-- Cette dualité est temporaire. Phase 5 V0.7 (à brainstormer) : refonte
-- "investir Couronnes à distance" avec défense par le veilleur. À ce moment-là,
-- on pourra dropper proprement `place_influence_action` + `place_influence` +
-- `user_place_influence`.

CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id           text,
  p_place_id          text,
  p_points            integer,
  p_user_lat          numeric DEFAULT NULL,
  p_user_lng          numeric DEFAULT NULL,
  p_target_faction_id text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._place_influence_action_internal(
    p_user_id, p_place_id, p_points, p_user_lat, p_user_lng, p_target_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(text, text, integer, numeric, numeric, text)
  TO authenticated, anon, service_role;
