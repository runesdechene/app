-- 029_v07_crown_daily_cap.sql
-- WHY : un user avec 325 lieux veillés générait 325 Couronnes/jour, ce qui
-- rendait le plafond 500 trompeur (atteint en < 2j) et déséquilibrait la
-- compétition à venir avec la phase 5 (influence à distance par Couronnes).
--
-- Solution : cap silencieux du NOMBRE de coffres VISIBLES par jour. L'user
-- ne voit qu'un sous-ensemble de ses lieux veillés (15 max), choisi par
-- hash déterministe sur (user_id, place_id, date courante).
--
-- - Stable durant la journée (pas de scintillement)
-- - Roule à minuit → autres coffres demain
-- - Si l'user a < 15 lieux : tous visibles (rien ne change pour lui)
-- - Si l'user a 100 lieux : 15 coffres/jour, chaque lieu récolté ~1 fois
--   tous les 7 jours en moyenne
-- - Pas frustrant : on ne montre pas ce qu'on ne peut pas récolter
--
-- Contre-mesure côté serveur : harvest_crown vérifie aussi l'appartenance
-- au set du jour (sinon un client malveillant pourrait bypasser la limite
-- en appelant la RPC directement avec n'importe quel placeId).
--
-- DAILY_CROWN_CAP = 15 hardcodé dans la mig. À tweak plus tard si besoin
-- (passer en app_settings le jour où on veut le piloter à chaud).

-- ============================================================
-- get_my_crowns_state : harvestable filtré sur top 15 du jour
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_crowns_state(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_balance  integer;
  v_capped   boolean;
  v_now      timestamptz := now();
  v_today    text := current_date::text;
  v_items    jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('balance', 0, 'capped', false, 'harvestable', '[]'::jsonb);
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_capped := v_balance >= 500;

  IF v_capped THEN
    RETURN json_build_object('balance', v_balance, 'capped', true, 'harvestable', '[]'::jsonb);
  END IF;

  -- Top 15 coffres visibles aujourd'hui (sélection deterministe par md5).
  -- Parmi ceux-là, on garde uniquement ceux dont le timer 24h est écoulé.
  WITH today_set AS (
    SELECT pv.place_id, pv.planted_at, pv.expedition_id
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    ORDER BY md5(p_user_id || '-' || pv.place_id || '-' || v_today)
    LIMIT 15
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'placeId',    t.place_id,
    'gain',       t.gain,
    'eligibleAt', t.eligible_at
  )), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ts.place_id,
      CASE WHEN (
        SELECT count(*) FROM public.expedition_members em2
        WHERE em2.expedition_id = ts.expedition_id
      ) >= 2 THEN 2 ELSE 1 END                                         AS gain,
      COALESCE(ch.last_harvested_at, ts.planted_at) + interval '24 hours' AS eligible_at
    FROM today_set ts
    LEFT JOIN public.crown_harvest ch ON ch.place_id = ts.place_id AND ch.user_id = p_user_id
    WHERE COALESCE(ch.last_harvested_at, ts.planted_at) + interval '24 hours' <= v_now
  ) t;

  RETURN json_build_object(
    'balance',     v_balance,
    'capped',      false,
    'harvestable', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_crowns_state(text) TO authenticated, service_role;

-- ============================================================
-- harvest_crown : vérifie que le placeId est bien dans le set du jour
-- (anti-bypass — sinon n'importe quel client pourrait passer le cap en
-- appelant la RPC directement avec un placeId arbitraire).
-- Reprise EXACTE de la mig 021, avec ajout d'un check today_set au début.
-- ============================================================

CREATE OR REPLACE FUNCTION public.harvest_crown(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_today            text := current_date::text;
  v_in_today_set     boolean;
  v_expedition_id    uuid;
  v_planted_at       timestamptz;
  v_member_count     integer;
  v_is_member        boolean;
  v_last_harvested   timestamptz;
  v_eligible_at      timestamptz;
  v_gain             integer;
  v_current_balance  integer;
  v_new_balance      integer;
  v_place_title      text;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Anti-bypass du cap quotidien : ce lieu doit être dans le top 15 visible
  -- aujourd'hui pour ce user. Sinon on refuse, peu importe que le timer 24h
  -- soit écoulé ou que le user soit dans l'expé.
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT pv.place_id
      FROM public.place_veille pv
      JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
      ORDER BY md5(p_user_id || '-' || pv.place_id || '-' || v_today)
      LIMIT 15
    ) sub
    WHERE sub.place_id = p_place_id
  ) INTO v_in_today_set;

  IF NOT v_in_today_set THEN
    RETURN json_build_object('error', 'not_today');
  END IF;

  SELECT pv.expedition_id, pv.planted_at INTO v_expedition_id, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_expedition_id IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  SELECT
    bool_or(em.user_id = p_user_id),
    count(*)::integer
  INTO v_is_member, v_member_count
  FROM public.expedition_members em
  WHERE em.expedition_id = v_expedition_id;

  IF NOT COALESCE(v_is_member, false) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  SELECT ch.last_harvested_at INTO v_last_harvested
  FROM public.crown_harvest ch
  WHERE ch.place_id = p_place_id AND ch.user_id = p_user_id;

  v_eligible_at := COALESCE(v_last_harvested, v_planted_at) + interval '24 hours';

  IF v_now < v_eligible_at THEN
    RETURN json_build_object('error', 'too_soon', 'eligibleAt', v_eligible_at);
  END IF;

  SELECT balance INTO v_current_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);

  IF v_current_balance >= 500 THEN
    RETURN json_build_object('error', 'stock_full', 'balance', v_current_balance);
  END IF;

  v_gain := CASE WHEN v_member_count >= 2 THEN 2 ELSE 1 END;
  v_new_balance := LEAST(500, v_current_balance + v_gain);

  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, v_new_balance, v_now)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = EXCLUDED.balance,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.crown_harvest (place_id, user_id, last_harvested_at)
  VALUES (p_place_id, p_user_id, v_now)
  ON CONFLICT (place_id, user_id) DO UPDATE SET
    last_harvested_at = EXCLUDED.last_harvested_at;

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES (
    'harvest_crown', p_user_id, p_place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'gain', v_gain,
      'memberCount', v_member_count,
      'newBalance', v_new_balance
    )
  );

  RETURN json_build_object(
    'success',     true,
    'placeId',     p_place_id,
    'gain',        v_gain,
    'balance',     v_new_balance,
    'harvestedAt', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.harvest_crown(text, text) TO authenticated, service_role;
