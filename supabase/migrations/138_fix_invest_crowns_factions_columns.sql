-- 138_fix_invest_crowns_factions_columns.sql
-- WHY : bug critique introduit par mig 133. Le SELECT qui récupère couleur +
-- pattern de la nouvelle faction lors d'une bascule pointe vers
-- `factions.tag_id` (n'existe pas) et `tags.pattern_url` (n'existe pas non
-- plus). À chaque bascule (cas vacant ≥1 Couronne ou cas veillé > effectif),
-- la requête plante silencieusement et toute la transaction invest_crowns
-- est rollback → aucune Couronne n'est créditée, aucun lieu ne bascule.
--
-- Symptôme : "ma dernière Couronne pour faire basculer ne veut pas se mettre"
-- (Uriel 8/05).
--
-- Fix : la table `factions` a directement `color` et `pattern`. On simplifie
-- le SELECT pour piocher dedans au lieu de joindre `tags`.
--
-- Reprise verbatim de la mig 133, seul change la ligne du SELECT couleur.

BEGIN;

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
  v_notif_data       jsonb;
  v_target_color     text;
  v_target_pattern   text;
  v_new_members      jsonb;
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

  SELECT faction_id, is_neutral INTO v_target_faction, v_target_neutral
  FROM public.expeditions WHERE id = p_target_expedition_id;
  v_target_neutral := COALESCE(v_target_neutral, false);

  -- BASCULE
  IF v_side = 'attack' THEN
    IF v_was_vacant THEN
      IF v_new_target_score >= 1 THEN
        INSERT INTO public.place_veille
          (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id)
        VALUES
          (p_place_id, p_target_expedition_id, v_target_faction, v_target_neutral,
           v_now, true, NULL)
        ON CONFLICT (place_id) DO NOTHING;

        v_basculed := true;
      END IF;
    ELSE
      v_veilleur_score := public._defender_effective_score(p_place_id);

      IF v_new_target_score > v_veilleur_score THEN
        v_old_exp_id := v_veilleur_exp;

        DELETE FROM public.place_court_score
        WHERE place_id = p_place_id
          AND expedition_id != p_target_expedition_id;

        UPDATE public.place_veille
        SET expedition_id          = p_target_expedition_id,
            faction_id             = v_target_faction,
            is_neutral             = v_target_neutral,
            by_influence           = true,
            previous_expedition_id = COALESCE(v_prev_exp, v_old_exp_id),
            planted_at             = v_now
        WHERE place_id = p_place_id;

        v_basculed := true;
      END IF;
    END IF;
  END IF;

  -- ============================================================
  -- NOTIFICATIONS — activity_log + notify
  -- ============================================================
  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    -- V138 : factions a directement `color` et `pattern` (pas via tag_id).
    SELECT f.color, f.pattern
    INTO v_target_color, v_target_pattern
    FROM public.factions f
    WHERE f.id = v_target_faction;

    SELECT jsonb_agg(jsonb_build_object(
      'userId',      em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl',   u.avatar_url,
      'factionId',   em.faction_id
    ))
    INTO v_new_members
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = p_target_expedition_id;

    IF v_was_vacant THEN
      v_notif_data := jsonb_build_object(
        'placeId',         p_place_id,
        'placeTitle',      v_place_title,
        'expeditionId',    p_target_expedition_id,
        'fromVacant',      true,
        'factionId',       v_target_faction,
        'factionColor',    v_target_color,
        'factionPattern',  v_target_pattern,
        'isNeutral',       v_target_neutral,
        'members',         COALESCE(v_new_members, '[]'::jsonb)
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, v_notif_data);
      PERFORM public.notify(p_user_id, 'place_taken_remote_self', v_notif_data);
    ELSE
      v_notif_data := jsonb_build_object(
        'placeId',         p_place_id,
        'placeTitle',      v_place_title,
        'actorName',       v_actor_name,
        'oldExpeditionId', v_old_exp_id,
        'newExpeditionId', p_target_expedition_id,
        'factionId',       v_target_faction,
        'factionColor',    v_target_color,
        'factionPattern',  v_target_pattern,
        'isNeutral',       v_target_neutral,
        'members',         COALESCE(v_new_members, '[]'::jsonb)
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote', p_user_id, p_place_id, v_notif_data);
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, v_notif_data);
      PERFORM public._notify_court_members(v_old_exp_id, 'place_taken_remote', v_notif_data, p_user_id);
      PERFORM public.notify(p_user_id, 'place_taken_remote_self', v_notif_data);
    END IF;
  ELSIF v_side = 'attack' AND NOT v_was_vacant THEN
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
      PERFORM public._notify_court_members(v_veilleur_exp, 'place_court_attack', v_notif_data, p_user_id);
    END IF;

    v_veilleur_score := public._defender_effective_score(p_place_id);
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

COMMIT;
