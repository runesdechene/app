-- 123_crowns_discovery_quest.sql
-- WHY : Phase 2 du nouveau système Couronnes (spec 2026-05-07).
-- Donne aux "0 lieu" une source active de Couronnes.
--   - +1 Couronne par découverte 1ère visite GPS (v_method = 'gps' ET insertion
--     effective dans places_discovered, c.-à-d. pas un re-discover bloqué).
--   - +1 bonus mini-quête "Découvre 3 lieux" à la 3e découverte GPS du jour,
--     dédupliqué via activity_log (type='crown_quest_discovery').
--
-- Reprise EXACTE de discover_place mig 087 — seul ajout : le bloc V123 entre
-- la mise à jour de exploration_points et le RETURN JSON. Plus 3 champs au
-- retour JSON ('crownsGain', 'questBonus', 'newCrownsBalance' — additifs, le
-- frontend qui ignore ces clés continue de marcher).
--
-- Le tracking utilise places_discovered (1 row par couple user/place, colonne
-- discovered_at DEFAULT now()) et NON place_explorers ni places_explored. La
-- mini-quête compte donc les découvertes uniques du jour, pas les visites.

BEGIN;

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id    text,
  p_place_id   text,
  p_method     text DEFAULT 'remote',
  p_user_lat   numeric DEFAULT NULL,
  p_user_lng   numeric DEFAULT NULL,
  p_free       boolean DEFAULT false,
  p_glory_mult numeric DEFAULT 1
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_exploration_gain INT;
  v_gps_bonus INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_m NUMERIC;
  v_method TEXT;
  v_proximity_m NUMERIC := 500;
  -- V123 : variables Couronnes
  v_crowns_gain          integer := 0;
  v_quest_bonus          integer := 0;
  v_new_crowns_balance   integer := 0;
  v_discoveries_today    integer;
  v_quest_threshold      integer;
  v_quest_already_done   boolean;
  v_crowns_cap           integer;
  v_discovery_gain_cfg   integer;
  v_quest_bonus_cfg      integer;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_method := 'remote';
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_m := 6371000 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_place_lat - p_user_lat) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(v_place_lat)) *
      POWER(SIN(RADIANS(v_place_lng - p_user_lng) / 2), 2)
    ));
    IF v_distance_m <= v_proximity_m THEN
      v_method := 'gps';
    END IF;
  END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF v_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, v_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  IF v_method = 'gps' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := 1;
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  -- ───── V123 : Couronnes par découverte GPS + bonus mini-quête ─────
  IF v_method = 'gps' THEN
    v_crowns_cap         := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'),                  500);
    v_discovery_gain_cfg := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_discovery_gain'),               1);
    v_quest_bonus_cfg    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_bonus'),         1);
    v_quest_threshold    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_threshold'),     3);

    v_crowns_gain := v_discovery_gain_cfg;

    -- Compter les découvertes GPS du jour (incluant celle qu'on vient d'insérer).
    SELECT count(*)::integer INTO v_discoveries_today
    FROM public.places_discovered
    WHERE user_id = p_user_id
      AND method = 'gps'
      AND discovered_at::date = current_date;

    SELECT EXISTS(
      SELECT 1 FROM public.activity_log
      WHERE actor_id = p_user_id
        AND type     = 'crown_quest_discovery'
        AND created_at::date = current_date
    ) INTO v_quest_already_done;

    IF v_discoveries_today >= v_quest_threshold AND NOT v_quest_already_done THEN
      v_quest_bonus := v_quest_bonus_cfg;
    END IF;

    IF (v_crowns_gain + v_quest_bonus) > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (p_user_id, LEAST(v_crowns_cap, v_crowns_gain + v_quest_bonus), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance    = LEAST(v_crowns_cap, public.user_crowns.balance + v_crowns_gain + v_quest_bonus),
        updated_at = now()
      RETURNING balance INTO v_new_crowns_balance;
    ELSE
      SELECT COALESCE(balance, 0) INTO v_new_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
      v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
    END IF;

    IF v_quest_bonus > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, data)
      VALUES ('crown_quest_discovery', p_user_id, jsonb_build_object(
        'discoveriesCount', v_discoveries_today,
        'bonusGain',        v_quest_bonus,
        'newBalance',       v_new_crowns_balance
      ));
    END IF;
  END IF;
  -- ───── FIN V123 ─────

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'crownsGain',       v_crowns_gain,
    'questBonus',       v_quest_bonus,
    'newCrownsBalance', v_new_crowns_balance
  );
END;
$$;

GRANT ALL ON FUNCTION public.discover_place(text, text, text, numeric, numeric, boolean, numeric)
  TO anon, authenticated, service_role;

COMMIT;
