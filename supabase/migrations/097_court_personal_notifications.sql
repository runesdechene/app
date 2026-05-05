-- 097_court_personal_notifications.sql
-- WHY : les RPCs Cour (079/094/095/096) insèrent leurs events uniquement
-- dans activity_log (live-feed ambient). Le système de notifications PERSO
-- existant (table `notifications`, helper `notify()`, `useNotifications` +
-- `NotificationBell` côté front) n'est jamais alimenté.
--
-- Conséquence : si un user n'est pas en ligne au moment où un attaquant
-- s'en prend à son lieu, il rate l'event. Pas de persistance, pas de badge
-- compteur dans la cloche. Régression à corriger.
--
-- Cette mig ajoute :
--   - Helper `_notify_court_members(p_expedition_id, p_type, p_data, p_exclude_user_id)`
--     qui boucle sur expedition_members et appelle notify() pour chaque user
--     (sauf l'exclu, généralement l'actor).
--   - Helper `_notify_court_challengers(p_place_id, p_veilleur_exp, p_type, p_data, p_exclude)`
--     qui notifie tous les membres des expés challengers (place_court_score)
--     d'un lieu (utile pour place_reaffirmed, place_taken_back_gps).
--   - invest_crowns : PERFORM des helpers aux bons endroits.
--   - plant_flag : PERFORM des helpers aux bons endroits.
--
-- Les inserts activity_log existants restent (live-feed ambient pour les
-- toasts publics). Maintenant on a les DEUX comme initialement demandé.

BEGIN;

-- ============================================================
-- HELPER 1 : notifier tous les membres d'une expédition
-- ============================================================

CREATE OR REPLACE FUNCTION public._notify_court_members(
  p_expedition_id    uuid,
  p_type             text,
  p_data             jsonb,
  p_exclude_user_id  text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member text;
BEGIN
  FOR v_member IN
    SELECT em.user_id
    FROM public.expedition_members em
    WHERE em.expedition_id = p_expedition_id
      AND (p_exclude_user_id IS NULL OR em.user_id != p_exclude_user_id)
  LOOP
    PERFORM public.notify(v_member, p_type, p_data);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public._notify_court_members(uuid, text, jsonb, text)
  TO authenticated, service_role;

-- ============================================================
-- HELPER 2 : notifier tous les membres des expés challengers d'un lieu
-- (= tout sauf l'expé veilleuse). Utile quand le veilleur réaffirme ou
-- reprend par GPS et qu'on veut prévenir les challengers déchus.
-- ============================================================

CREATE OR REPLACE FUNCTION public._notify_court_challengers(
  p_place_id          text,
  p_veilleur_exp_id   uuid,
  p_type              text,
  p_data              jsonb,
  p_exclude_user_id   text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member text;
BEGIN
  FOR v_member IN
    SELECT DISTINCT em.user_id
    FROM public.place_court_score pcs
    JOIN public.expedition_members em ON em.expedition_id = pcs.expedition_id
    WHERE pcs.place_id = p_place_id
      AND pcs.expedition_id != p_veilleur_exp_id
      AND pcs.score > 0
      AND (p_exclude_user_id IS NULL OR em.user_id != p_exclude_user_id)
  LOOP
    PERFORM public.notify(v_member, p_type, p_data);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public._notify_court_challengers(text, uuid, text, jsonb, text)
  TO authenticated, service_role;

-- ============================================================
-- invest_crowns — V097 : ajout des notify() personnels
-- Reprend verbatim mig 095 + PERFORM des helpers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invest_crowns(
  p_user_id              text,
  p_place_id             text,
  p_target_expedition_id uuid,
  p_amount               integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_today_date       date := current_date;
  v_veilleur_exp     uuid;
  v_was_by_influence boolean;
  v_prev_exp         uuid;
  v_target_exists    boolean;
  v_is_member_target boolean;
  v_balance          integer;
  v_side             text;
  v_veilleur_score   integer;
  v_new_target_score integer;
  v_basculed         boolean := false;
  v_was_vacant       boolean := false;
  v_place_title      text;
  v_actor_name       text;
  v_threshold_50pct  integer;
  v_old_exp_id       uuid;
  v_target_faction   text;
  v_target_neutral   boolean;
  v_veilleur_def     integer;
  v_notif_data       jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('error', 'invalid_amount');
  END IF;

  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_veilleur_exp, v_was_by_influence, v_prev_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_was_vacant := (v_veilleur_exp IS NULL);

  SELECT EXISTS (
    SELECT 1 FROM public.expeditions
    WHERE id = p_target_expedition_id AND place_id = p_place_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  IF v_was_vacant THEN
    v_side := 'attack';
    SELECT EXISTS (
      SELECT 1 FROM public.expedition_members em
      WHERE em.expedition_id = p_target_expedition_id AND em.user_id = p_user_id
    ) INTO v_is_member_target;
    IF NOT v_is_member_target THEN
      RETURN json_build_object('error', 'not_member');
    END IF;
  ELSIF p_target_expedition_id = v_veilleur_exp THEN
    v_side := 'defense';
  ELSE
    v_side := 'attack';
    SELECT EXISTS (
      SELECT 1 FROM public.expedition_members em
      WHERE em.expedition_id = p_target_expedition_id AND em.user_id = p_user_id
    ) INTO v_is_member_target;
    IF NOT v_is_member_target THEN
      RETURN json_build_object('error', 'not_member');
    END IF;
  END IF;

  UPDATE public.user_crowns
  SET balance = balance - p_amount, updated_at = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, side, amount)
  VALUES (p_place_id, p_user_id, p_target_expedition_id, v_side, p_amount);

  INSERT INTO public.place_court_score (place_id, expedition_id, score, last_action_at)
  VALUES (p_place_id, p_target_expedition_id, p_amount, v_now)
  ON CONFLICT (place_id, expedition_id) DO UPDATE SET
    score          = place_court_score.score + EXCLUDED.score,
    last_action_at = EXCLUDED.last_action_at
  RETURNING score INTO v_new_target_score;

  -- BASCULE
  IF v_side = 'attack' THEN
    IF v_was_vacant THEN
      IF v_new_target_score >= 1 THEN
        SELECT faction_id, is_neutral INTO v_target_faction, v_target_neutral
        FROM public.expeditions WHERE id = p_target_expedition_id;

        INSERT INTO public.place_veille
          (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id)
        VALUES
          (p_place_id, p_target_expedition_id, v_target_faction, COALESCE(v_target_neutral, false),
           v_now, true, NULL)
        ON CONFLICT (place_id) DO NOTHING;

        v_basculed := true;
      END IF;
    ELSE
      SELECT COALESCE(score, 0) INTO v_veilleur_def
      FROM public.place_court_score
      WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
      v_veilleur_def := COALESCE(v_veilleur_def, 0);

      IF COALESCE(v_was_by_influence, false) = false THEN
        v_veilleur_score := 50 + v_veilleur_def;
      ELSE
        v_veilleur_score := v_veilleur_def;
      END IF;

      IF v_new_target_score > v_veilleur_score THEN
        v_old_exp_id := v_veilleur_exp;
        DELETE FROM public.place_court_score WHERE place_id = p_place_id;

        UPDATE public.place_veille
        SET expedition_id          = p_target_expedition_id,
            by_influence           = true,
            previous_expedition_id = COALESCE(v_prev_exp, v_old_exp_id),
            planted_at             = v_now
        WHERE place_id = p_place_id;

        v_basculed := true;
      END IF;
    END IF;
  END IF;

  -- ============================================================
  -- NOTIFICATIONS — activity_log (ambient public) + notify (perso)
  -- ============================================================
  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    IF v_was_vacant THEN
      v_notif_data := jsonb_build_object(
        'placeId',      p_place_id,
        'placeTitle',   v_place_title,
        'expeditionId', p_target_expedition_id,
        'fromVacant',   true
      );
      -- activity_log (ambient)
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, v_notif_data);
      -- notify perso au planteur
      PERFORM public.notify(p_user_id, 'place_taken_remote_self', v_notif_data);
    ELSE
      -- Bascule sur lieu veillé : notif perso à l'ancienne expé déchue + nouvelle
      v_notif_data := jsonb_build_object(
        'placeId',         p_place_id,
        'placeTitle',      v_place_title,
        'actorName',       v_actor_name,
        'oldExpeditionId', v_old_exp_id,
        'newExpeditionId', p_target_expedition_id
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote', p_user_id, p_place_id, v_notif_data);
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, v_notif_data);
      -- Notif perso à chaque membre de l'ancienne expé déchue
      PERFORM public._notify_court_members(v_old_exp_id, 'place_taken_remote', v_notif_data, p_user_id);
      -- Notif perso au planteur (la nouvelle expé)
      PERFORM public.notify(p_user_id, 'place_taken_remote_self', v_notif_data);
    END IF;
  ELSIF v_side = 'attack' AND NOT v_was_vacant THEN
    -- Notif perso aux membres veilleurs si pas déjà notifiés aujourd'hui
    -- pour cette tuple (place, expedition_attaquante).
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_log
      WHERE type = 'place_court_attack'
        AND place_id = p_place_id
        AND (data->>'expeditionId')::uuid = p_target_expedition_id
        AND created_at::date = v_today_date
    ) THEN
      v_notif_data := jsonb_build_object(
        'placeId',      p_place_id,
        'placeTitle',   v_place_title,
        'actorName',    v_actor_name,
        'expeditionId', p_target_expedition_id
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_attack', p_user_id, p_place_id, v_notif_data);
      -- Notif perso aux membres veilleurs (sauf si l'attaquant = veilleur ?
      -- Improbable, mais on exclut juste l'actor par sécurité.)
      PERFORM public._notify_court_members(v_veilleur_exp, 'place_court_attack', v_notif_data, p_user_id);
    END IF;

    v_threshold_50pct := v_veilleur_score / 2;
    IF v_veilleur_score > 0
       AND v_new_target_score >= v_threshold_50pct
       AND (v_new_target_score - p_amount) < v_threshold_50pct
    THEN
      v_notif_data := jsonb_build_object(
        'placeId',      p_place_id,
        'placeTitle',   v_place_title,
        'expeditionId', p_target_expedition_id,
        'score',        v_new_target_score
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_high_threat', p_user_id, p_place_id, v_notif_data);
      PERFORM public._notify_court_members(v_veilleur_exp, 'place_court_high_threat', v_notif_data, p_user_id);
    END IF;
  END IF;

  -- Mécène principal
  WITH totals AS (
    SELECT user_id, SUM(amount) AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY user_id
  ),
  ranked AS (
    SELECT user_id, total, ROW_NUMBER() OVER (ORDER BY total DESC, user_id) AS rk
    FROM totals
  ),
  is_first AS (
    SELECT total FROM ranked WHERE user_id = p_user_id AND rk = 1
  )
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  SELECT 'mecene_principal_gained', p_user_id, p_place_id,
         jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title, 'total', f.total)
  FROM is_first f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.activity_log al
    WHERE al.type = 'mecene_principal_gained'
      AND al.actor_id = p_user_id
      AND al.place_id = p_place_id
      AND al.created_at > v_now - interval '1 hour'
  );

  -- Notif perso au mécène principal (si vient de devenir #1)
  -- Cap 1×/heure pour éviter le spam si oscille
  IF EXISTS (
    SELECT 1 FROM (
      WITH totals AS (
        SELECT user_id, SUM(amount) AS total
        FROM public.place_court_action
        WHERE place_id = p_place_id
        GROUP BY user_id
      )
      SELECT 1 FROM totals t1
      WHERE t1.user_id = p_user_id
        AND t1.total = (SELECT MAX(total) FROM totals)
    ) sub
  ) AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = p_user_id
      AND n.type = 'mecene_principal_gained'
      AND (n.data->>'placeId') = p_place_id
      AND n.created_at > v_now - interval '1 hour'
  ) THEN
    PERFORM public.notify(p_user_id, 'mecene_principal_gained', jsonb_build_object(
      'placeId',    p_place_id,
      'placeTitle', v_place_title
    ));
  END IF;

  RETURN json_build_object(
    'success',                true,
    'side',                   v_side,
    'newScore',               v_new_target_score,
    'balance',                v_balance - p_amount,
    'basculed',               v_basculed,
    'basculedExpeditionId',   CASE WHEN v_basculed THEN p_target_expedition_id ELSE NULL END,
    'fromVacant',             v_was_vacant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer)
  TO authenticated, service_role;

-- ============================================================
-- plant_flag — V097 : ajout des notify() pour cas A, B, D
-- Reprend verbatim mig 096 + PERFORM des helpers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id            text,
  p_place_id           text,
  p_user_lat           numeric,
  p_user_lng           numeric,
  p_partners_user_ids  text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction        text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_expedition_id       uuid;
  v_is_neutral          boolean := false;
  v_expedition_faction  text;
  v_factions            text[];
  v_partner_user_id     text;
  v_partner_faction     text;
  v_members_json        jsonb;
  v_now                 timestamptz := now();
  v_cooldown_hours      int := _barem('cooldown.replant_hours', 24);
  v_last_plant          timestamptz;
  v_remaining_hours     numeric;
  v_prev_veilleur       uuid;
  v_prev_by_influence   boolean;
  v_prev_previous_exp   uuid;
  v_threats_cleared     int;
  v_notif_data          jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_user_faction FROM public.users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM public.places WHERE id = p_place_id;
  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_prev_veilleur, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- ============================================================
  -- CAS A — Reclaim par ancien veilleur déchu
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_previous_exp IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_previous_exp AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET expedition_id          = v_prev_previous_exp,
        by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now,
        faction_id             = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral             = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
    WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur,
      'reclaimedBy',  v_prev_previous_exp
    );

    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_back_gps', p_user_id, p_place_id, v_notif_data);

    -- Notifs perso : membres de l'expé déchue (= v_prev_veilleur, qui tenait par influence)
    PERFORM public._notify_court_members(v_prev_veilleur, 'place_taken_back_gps', v_notif_data, p_user_id);

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_previous_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_previous_exp;

    RETURN json_build_object(
      'success',      true,
      'mode',         'reclaim_gps',
      'placeId',      p_place_id,
      'expeditionId', v_prev_previous_exp,
      'members',      v_members_json,
      'plantedAt',    v_now
    );
  END IF;

  -- ============================================================
  -- CAS B — Confirmation IRL par membre de l'expé "par influence"
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_veilleur IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur;

    RETURN json_build_object(
      'success',      true,
      'mode',         'confirm_gps',
      'placeId',      p_place_id,
      'expeditionId', v_prev_veilleur,
      'members',      v_members_json,
      'plantedAt',    v_now
    );
  END IF;

  -- ============================================================
  -- CAS D — Réaffirmation IRL par plein-veilleur (V096)
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET planted_at = v_now
    WHERE place_id = p_place_id;

    -- Notif perso aux challengers AVANT delete (sinon helper ne trouve plus rien)
    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur
    );
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur, 'place_reaffirmed', v_notif_data, p_user_id);

    -- Reset des challengers SEULEMENT
    DELETE FROM public.place_court_score
    WHERE place_id = p_place_id
      AND expedition_id != v_prev_veilleur;
    GET DIAGNOSTICS v_threats_cleared = ROW_COUNT;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur, p_user_id, v_user_faction, false, v_now);

    IF v_threats_cleared > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_reaffirmed', p_user_id, p_place_id, v_notif_data || jsonb_build_object(
        'threatsCleared', v_threats_cleared
      ));
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur;

    RETURN json_build_object(
      'success',         true,
      'mode',            'reaffirm_gps',
      'placeId',         p_place_id,
      'expeditionId',    v_prev_veilleur,
      'members',         v_members_json,
      'plantedAt',       v_now,
      'threatsCleared',  v_threats_cleared
    );
  END IF;

  -- ============================================================
  -- CAS C — Plantage standard
  -- ============================================================
  SELECT MAX(planted_at) INTO v_last_plant
  FROM public.veille_history
  WHERE user_id = p_user_id AND place_id = p_place_id;

  IF v_last_plant IS NOT NULL
     AND v_last_plant > (v_now - (v_cooldown_hours || ' hours')::interval) THEN
    v_remaining_hours := EXTRACT(EPOCH FROM (
      (v_last_plant + (v_cooldown_hours || ' hours')::interval) - v_now
    )) / 3600.0;
    RETURN json_build_object(
      'error', 'cooldown',
      'remainingHours', ROUND(v_remaining_hours::numeric, 1),
      'cooldownHours', v_cooldown_hours
    );
  END IF;

  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id)
    AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_now)
  RETURNING id INTO v_expedition_id;

  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

  IF array_length(p_partners_user_ids, 1) > 0 THEN
    FOREACH v_partner_user_id IN ARRAY p_partners_user_ids LOOP
      IF v_partner_user_id = p_user_id THEN CONTINUE; END IF;
      SELECT faction_id INTO v_partner_faction FROM public.users WHERE id = v_partner_user_id;
      IF v_partner_faction IS NOT NULL THEN
        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Notif perso : si supplantation (lieu déjà veillé par autre expé), prévenir l'ancienne
  IF v_prev_veilleur IS NOT NULL AND v_prev_veilleur != v_expedition_id THEN
    PERFORM public._notify_court_members(v_prev_veilleur, 'place_taken_back_gps', jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur,
      'reclaimedBy',  v_expedition_id,
      'plantedByUser', p_user_id
    ), p_user_id);
  END IF;

  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now, false, NULL)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id          = EXCLUDED.expedition_id,
    faction_id             = EXCLUDED.faction_id,
    is_neutral             = EXCLUDED.is_neutral,
    planted_at             = EXCLUDED.planted_at,
    by_influence           = false,
    previous_expedition_id = NULL;

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
          jsonb_build_object(
            'placeTitle', v_place_title,
            'isNeutral', v_is_neutral,
            'expeditionId', v_expedition_id,
            'memberCount', jsonb_array_length(v_members_json),
            'members', v_members_json
          ));

  RETURN json_build_object(
    'success',      true,
    'mode',         'plant',
    'placeId',      p_place_id,
    'isNeutral',    v_is_neutral,
    'factionId',    v_expedition_faction,
    'expeditionId', v_expedition_id,
    'members',      v_members_json,
    'plantedAt',    v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO service_role;

COMMIT;
