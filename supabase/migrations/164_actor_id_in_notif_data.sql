-- 164_actor_id_in_notif_data.sql
-- Ajoute 'actorId' dans le JSON data des notifs/activity_log qui contiennent
-- actorName, pour permettre au frontend de fetcher l'avatar de l'acteur via
-- useUserAvatars (cf. NotificationPanel, ActivityFeed, GameToast).
--
-- Avant cette mig : "X s'intéresse à Y" (place_court_attack) avait actorName
-- mais pas actorId → frontend ne pouvait pas afficher l'avatar → icône épée
-- générique. Désormais l'avatar est uniformément affichable.
--
-- Fonctions touchées :
--   - invest_crowns : 3 blocs jsonb_build_object (place_taken_remote,
--     place_court_attack, place_court_support)
--   - log_like_activity : 1 bloc (activity 'like')
--
-- Méthode : copy-paste baseline ENTIÈRE de pg_get_functiondef + ajout du
-- couplet 'actorId', <id> à côté de chaque 'actorName'. Aucune autre logique
-- modifiée. (cf. feedback_redef_rpc_copy_paste_baseline.md)

-- ============================================================
-- invest_crowns
-- ============================================================
CREATE OR REPLACE FUNCTION public.invest_crowns(p_user_id text, p_place_id text, p_target_expedition_id uuid, p_amount integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_now                  timestamptz := now();
  v_balance              integer;
  v_current_veilleur_exp uuid;
  v_current_veilleur_user text;
  v_target_exists        boolean;
  v_target_is_veilleur   boolean;
  v_side                 text;
  v_beneficiary          text;
  v_new_score            integer;
  v_old_veilleur_score   integer;
  v_basculed             boolean := false;
  v_was_vacant           boolean := false;
  v_place_title          text;
  v_actor_name           text;
  v_target_faction       text;
  v_target_neutral       boolean;
  v_target_color         text;
  v_target_pattern       text;
  v_new_members          jsonb;
  v_notif_data           jsonb;
  v_threshold_50pct      integer;
  v_today_date           date := current_date;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('error', 'invalid_amount');
  END IF;

  SELECT pv.expedition_id, pv.veilleur_user_id
  INTO v_current_veilleur_exp, v_current_veilleur_user
  FROM public.place_veille pv WHERE pv.place_id = p_place_id;

  v_was_vacant := (v_current_veilleur_exp IS NULL);

  SELECT EXISTS (
    SELECT 1 FROM public.expeditions
    WHERE id = p_target_expedition_id AND place_id = p_place_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  v_target_is_veilleur := (NOT v_was_vacant AND p_target_expedition_id = v_current_veilleur_exp);

  IF v_target_is_veilleur THEN
    v_side := 'defense';
    v_beneficiary := v_current_veilleur_user;
  ELSE
    v_side := 'attack';
    v_beneficiary := p_user_id;
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  UPDATE public.user_crowns
  SET balance = balance - p_amount, updated_at = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_place_id, p_user_id, p_target_expedition_id, v_beneficiary, v_side, p_amount);

  INSERT INTO public.place_court_score (place_id, expedition_id, score, last_action_at)
  VALUES (p_place_id, p_target_expedition_id, p_amount, v_now)
  ON CONFLICT (place_id, expedition_id) DO UPDATE SET
    score          = place_court_score.score + EXCLUDED.score,
    last_action_at = EXCLUDED.last_action_at;

  v_new_score := public._user_place_score(v_beneficiary, p_place_id);

  IF v_beneficiary IS DISTINCT FROM v_current_veilleur_user THEN
    v_old_veilleur_score := COALESCE(public._user_place_score(v_current_veilleur_user, p_place_id), 0);
    IF v_current_veilleur_user IS NULL OR v_new_score > v_old_veilleur_score THEN
      SELECT faction_id, COALESCE(is_neutral, false)
      INTO v_target_faction, v_target_neutral
      FROM public.expeditions WHERE id = p_target_expedition_id;

      INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
      VALUES (p_place_id, p_target_expedition_id, v_target_faction, v_target_neutral, v_now, true, v_current_veilleur_exp, v_beneficiary)
      ON CONFLICT (place_id) DO UPDATE SET
        expedition_id          = EXCLUDED.expedition_id,
        faction_id             = EXCLUDED.faction_id,
        is_neutral             = EXCLUDED.is_neutral,
        by_influence           = true,
        previous_expedition_id = COALESCE(public.place_veille.previous_expedition_id, v_current_veilleur_exp),
        planted_at             = v_now,
        veilleur_user_id       = EXCLUDED.veilleur_user_id;

      v_basculed := true;
    END IF;
  END IF;

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    SELECT f.color, f.pattern INTO v_target_color, v_target_pattern
    FROM public.factions f WHERE f.id = v_target_faction;

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
        'actorId',         p_user_id,
        'actorName',       v_actor_name,
        'oldExpeditionId', v_current_veilleur_exp,
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

      IF v_current_veilleur_user IS NOT NULL AND v_current_veilleur_user != p_user_id THEN
        PERFORM public.notify(v_current_veilleur_user, 'place_taken_remote', v_notif_data);
      END IF;
      PERFORM public._notify_court_members(v_current_veilleur_exp, 'place_taken_remote', v_notif_data, p_user_id);
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
        'actorId',      p_user_id,
        'actorName',    v_actor_name,
        'expeditionId', p_target_expedition_id
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_attack', p_user_id, p_place_id, v_notif_data);

      IF v_current_veilleur_user IS NOT NULL AND v_current_veilleur_user != p_user_id THEN
        PERFORM public.notify(v_current_veilleur_user, 'place_court_attack', v_notif_data);
      END IF;
      PERFORM public._notify_court_members(v_current_veilleur_exp, 'place_court_attack', v_notif_data, p_user_id);
    END IF;

    v_threshold_50pct := COALESCE(public._user_place_score(v_current_veilleur_user, p_place_id), 0) / 2;
    IF v_threshold_50pct > 0
       AND v_new_score >= v_threshold_50pct
       AND (v_new_score - p_amount) < v_threshold_50pct
    THEN
      v_notif_data := jsonb_build_object(
        'placeId',      p_place_id,
        'placeTitle',   v_place_title,
        'expeditionId', p_target_expedition_id,
        'score',        v_new_score
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_high_threat', p_user_id, p_place_id, v_notif_data);

      IF v_current_veilleur_user IS NOT NULL AND v_current_veilleur_user != p_user_id THEN
        PERFORM public.notify(v_current_veilleur_user, 'place_court_high_threat', v_notif_data);
      END IF;
      PERFORM public._notify_court_members(v_current_veilleur_exp, 'place_court_high_threat', v_notif_data, p_user_id);
    END IF;
  ELSIF v_side = 'defense'
      AND NOT v_was_vacant
      AND v_beneficiary IS NOT NULL
      AND v_beneficiary IS DISTINCT FROM p_user_id
  THEN
    -- V159 (10/05) : un user soutient le veilleur (defense vers veilleur ≠ self).
    -- Notif perso au veilleur + log activity pour le toast feed live.
    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'actorId',      p_user_id,
      'actorName',    v_actor_name,
      'amount',       p_amount,
      'expeditionId', p_target_expedition_id
    );
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_court_support', p_user_id, p_place_id, v_notif_data);
    PERFORM public.notify(v_beneficiary, 'place_court_support', v_notif_data);
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      WITH totals AS (
        SELECT beneficiary_user_id AS uid, SUM(amount) AS total
        FROM public.place_court_action
        WHERE place_id = p_place_id
        GROUP BY beneficiary_user_id
      )
      SELECT 1 FROM totals t1
      WHERE t1.uid = v_beneficiary
        AND t1.total = (SELECT MAX(total) FROM totals)
    ) sub
  ) AND v_beneficiary = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = p_user_id
        AND n.type = 'mecene_principal_gained'
        AND (n.data->>'placeId') = p_place_id
        AND n.created_at > v_now - interval '1 hour'
    )
  THEN
    PERFORM public.notify(p_user_id, 'mecene_principal_gained', jsonb_build_object(
      'placeId',    p_place_id,
      'placeTitle', v_place_title
    ));
  END IF;

  RETURN json_build_object(
    'success',                true,
    'side',                   v_side,
    'newScore',               v_new_score,
    'balance',                v_balance - p_amount,
    'basculed',               v_basculed,
    'basculedExpeditionId',   CASE WHEN v_basculed THEN p_target_expedition_id ELSE NULL END,
    'fromVacant',             v_was_vacant,
    'beneficiaryUserId',      v_beneficiary
  );
END;
$function$;

-- ============================================================
-- log_like_activity (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_like_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'like',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorId', NEW.user_id,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$function$;
