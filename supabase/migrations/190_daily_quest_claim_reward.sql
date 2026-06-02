-- 190_daily_quest_claim_reward.sql
-- Butin à la complétion d'un Défi du jour : RPC claim_daily_quest (crédite XP/Couronnes
-- UNE seule fois par jour, idempotent via user_quest_progress réutilisé comme registre de claim).
-- Pas de trigger : la RPC est appelée explicitement par le front quand une quête passe complétée
-- (donc aucun risque de rollback d'action cœur, cf. incident mig 058).
-- get_today_quests_state expose en plus 'claimed' pour que le front n'affiche le butin qu'une fois.

CREATE OR REPLACE FUNCTION public.claim_daily_quest(p_template_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user text := auth.uid()::text;
  v_t RECORD;
  v_progress int;
  v_rows int;
BEGIN
  IF v_user IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth_required'); END IF;

  SELECT id, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes
    INTO v_t FROM public.quest_templates
    WHERE id = p_template_id AND type = 'daily' AND active;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'quest_not_found'); END IF;

  v_progress := (CASE v_t.tracker_kind
    WHEN 'discoveries' THEN
      (SELECT count(*) FROM public.places_discovered d
        WHERE d.user_id = v_user AND d.method = 'remote' AND d.discovered_at::date = current_date)
    WHEN 'moisson_claims' THEN
      (SELECT count(*) FROM public.crown_harvest h
        WHERE h.user_id = v_user AND h.last_harvested_at::date = current_date)
    WHEN 'enigma_attempt' THEN
      (SELECT count(*) FROM public.enigma_responses e
        WHERE e.user_id = v_user AND e.responded_at::date = current_date)
    ELSE 0
  END)::int;

  IF v_progress < v_t.threshold THEN RETURN json_build_object('ok', false, 'error', 'not_complete'); END IF;

  -- Registre de claim idempotent (1 ligne par user+quête+jour)
  INSERT INTO public.user_quest_progress (user_id, quest_template_id, date_local, count, completed_at, rewarded)
    VALUES (v_user, v_t.id, current_date, v_progress, now(), true)
    ON CONFLICT (user_id, quest_template_id, date_local) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN json_build_object('ok', true, 'alreadyClaimed', true);
  END IF;

  -- Crédit du butin (uniquement à la 1re complétion du jour)
  IF v_t.reward_xp > 0 THEN
    UPDATE public.users SET xp_total = xp_total + v_t.reward_xp WHERE id = v_user;
  END IF;
  IF v_t.reward_couronnes > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user, LEAST(500, v_t.reward_couronnes), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_t.reward_couronnes), updated_at = now();
  END IF;

  RETURN json_build_object('ok', true, 'alreadyClaimed', false,
    'icon', v_t.icon, 'title', v_t.wording,
    'reward', json_build_object('xp', v_t.reward_xp, 'crowns', v_t.reward_couronnes));
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(text) TO authenticated;

-- get_today_quests_state : ajoute 'claimed' (le butin a-t-il déjà été encaissé aujourd'hui ?)
CREATE OR REPLACE FUNCTION public.get_today_quests_state(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_seed bigint;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN RETURN '[]'::json; END IF;
  v_seed := ('x' || md5(current_date::text))::bit(32)::bigint;

  RETURN (
    WITH picked AS (
      SELECT qt.*
      FROM public.quest_templates qt
      WHERE qt.type = 'daily' AND qt.active
      ORDER BY ((qt.display_order * 2654435761) # v_seed)
      LIMIT 4
    ), withprog AS (
      SELECT p.*,
        (CASE p.tracker_kind
          WHEN 'discoveries' THEN
            (SELECT count(*) FROM public.places_discovered d
              WHERE d.user_id = p_user_id AND d.method = 'remote' AND d.discovered_at::date = current_date)
          WHEN 'moisson_claims' THEN
            (SELECT count(*) FROM public.crown_harvest h
              WHERE h.user_id = p_user_id AND h.last_harvested_at::date = current_date)
          WHEN 'enigma_attempt' THEN
            (SELECT count(*) FROM public.enigma_responses e
              WHERE e.user_id = p_user_id AND e.responded_at::date = current_date)
          ELSE 0
        END)::int AS raw_count
      FROM picked p
    )
    SELECT COALESCE(json_agg(json_build_object(
      'id',          w.id,
      'type',        'daily',
      'title',       w.wording,
      'description', w.wording,
      'icon',        w.icon,
      'progress',    LEAST(w.raw_count, w.threshold),
      'target',      w.threshold,
      'reward',      json_build_object(
                       'type', CASE WHEN w.reward_couronnes > 0 THEN 'crowns' ELSE 'xp' END,
                       'amount', CASE WHEN w.reward_couronnes > 0 THEN w.reward_couronnes ELSE w.reward_xp END),
      'completedAt', CASE WHEN w.raw_count >= w.threshold THEN now() ELSE NULL END,
      'claimed',     EXISTS (SELECT 1 FROM public.user_quest_progress up
                              WHERE up.user_id = p_user_id AND up.quest_template_id = w.id
                                AND up.date_local = current_date AND up.rewarded)
    ) ORDER BY w.display_order), '[]'::json)
    FROM withprog w
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_today_quests_state(text) TO authenticated, service_role;
