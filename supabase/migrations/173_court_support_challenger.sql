-- 173_court_support_challenger.sql
-- WHY : mécénat d'un challenger (Uriel 24/05). Aujourd'hui invest_crowns ne sait
-- créditer que le veilleur (soutien) ou le caller (attaque solo). On ajoute la
-- capacité de créditer un CHALLENGER désigné (p_beneficiary_user_id), pour
-- pouvoir financer une offensive existante au lieu de lancer la sienne. Modèle
-- faiseur-de-roi : le challenger soutenu monte, et c'est LUI qui bascule.
-- get_place_court_state expose une liste `challengers` (cibles soutenables).
--
-- Baselines (plus haut numéro) : invest_crowns mig 164, get_place_court_state mig 156.

BEGIN;

-- 1. invest_crowns  (baseline mig 164, verbatim, + diffs steps 2-4)
CREATE OR REPLACE FUNCTION public.invest_crowns(p_user_id text, p_place_id text, p_target_expedition_id uuid, p_amount integer, p_beneficiary_user_id text DEFAULT NULL)
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

  -- V173 : bénéficiaire explicite (mécénat d'un challenger). Prime sur la
  -- déduction par expédition. NULL = comportement legacy.
  IF p_beneficiary_user_id IS NOT NULL AND p_beneficiary_user_id IS DISTINCT FROM p_user_id THEN
    IF NOT v_was_vacant AND p_beneficiary_user_id = v_current_veilleur_user THEN
      v_side := 'defense';
      v_beneficiary := v_current_veilleur_user;
    ELSE
      -- Le bénéficiaire doit être un challenger réel (score > 0).
      IF COALESCE(public._user_place_score(p_beneficiary_user_id, p_place_id), 0) <= 0 THEN
        RETURN json_build_object('error', 'not_a_challenger');
      END IF;
      v_side := 'attack';
      v_beneficiary := p_beneficiary_user_id;
      -- V173 : on NE fait PAS confiance au p_target_expedition_id du client pour
      -- un mécénat de challenger. On dérive l'expé challenger du bénéficiaire
      -- côté serveur (celle utilisée pour le score legacy + la bascule), pour
      -- éviter un place_veille incohérent (user crédité ≠ expédition plantée).
      SELECT e.id INTO p_target_expedition_id
      FROM public.expeditions e
      JOIN public.expedition_members em ON em.expedition_id = e.id
      WHERE em.user_id = p_beneficiary_user_id
        AND e.place_id = p_place_id
        AND (v_current_veilleur_exp IS NULL OR e.id != v_current_veilleur_exp)
      LIMIT 1;
      IF p_target_expedition_id IS NULL THEN
        RETURN json_build_object('error', 'challenger_expedition_missing');
      END IF;
    END IF;
  ELSIF v_target_is_veilleur THEN
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
      -- V173 : la prise du lieu ("self") revient au BÉNÉFICIAIRE (= nouveau
      -- veilleur), pas forcément au caller. En mécénat d'un challenger, le
      -- caller (mécène) ≠ bénéficiaire. actor_id = bénéficiaire pour que la
      -- pop-up Victoire se déclenche chez le bon user (useCourtNotifications
      -- teste actor_id === userId). En self-attaque legacy, v_beneficiary =
      -- p_user_id → comportement identique.
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', v_beneficiary, p_place_id, v_notif_data);

      IF v_current_veilleur_user IS NOT NULL AND v_current_veilleur_user != p_user_id THEN
        PERFORM public.notify(v_current_veilleur_user, 'place_taken_remote', v_notif_data);
      END IF;
      PERFORM public._notify_court_members(v_current_veilleur_exp, 'place_taken_remote', v_notif_data, p_user_id);
      PERFORM public.notify(v_beneficiary, 'place_taken_remote_self', v_notif_data);

      -- V173 : bascule déclenchée par un mécène (caller ≠ bénéficiaire) →
      -- prévenir le mécène que son soutien a fait basculer le lieu.
      IF v_beneficiary IS DISTINCT FROM p_user_id THEN
        PERFORM public.notify(p_user_id, 'place_court_support', jsonb_build_object(
          'placeId',         p_place_id,
          'placeTitle',      v_place_title,
          'actorId',         p_user_id,
          'actorName',       v_actor_name,
          'amount',          p_amount,
          'targetSide',      'attack',
          'beneficiaryName', (SELECT COALESCE(display_name, first_name, 'le challenger')
                              FROM public.users WHERE id = v_beneficiary)
        ));
      END IF;
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

    -- V173 : mécénat d'un challenger → notif perso au challenger soutenu.
    -- (Pas émise si la bascule a eu lieu : le challenger reçoit alors place_taken_remote_self.)
    IF v_beneficiary IS DISTINCT FROM p_user_id THEN
      v_notif_data := jsonb_build_object(
        'placeId',         p_place_id,
        'placeTitle',      v_place_title,
        'actorId',         p_user_id,
        'actorName',       v_actor_name,
        'amount',          p_amount,
        'targetSide',      'attack',
        'beneficiaryName', (SELECT COALESCE(display_name, first_name, 'le challenger')
                            FROM public.users WHERE id = v_beneficiary)
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_support', p_user_id, p_place_id, v_notif_data);
      PERFORM public.notify(v_beneficiary, 'place_court_support', v_notif_data);
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

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer, text)
  TO authenticated, service_role;

-- 2. get_place_court_state (baseline mig 156, verbatim, + diff step 5)
CREATE OR REPLACE FUNCTION public.get_place_court_state(
  p_place_id text,
  p_user_id  text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_veilleur_exp     uuid;
  v_veilleur_user    text;
  v_by_influence     boolean;
  v_planted_at       timestamptz;
  v_score_veilleur   integer;
  v_top_patrons      jsonb;
  v_chronicle        jsonb;
  v_balance          integer;
  v_user_total       integer;
  v_place_exists     boolean;
  v_status           text;
  v_threat_score     integer;
  v_veilleur_obj     jsonb;
  v_vacant           boolean;
  v_score_to_beat    integer;
  v_is_member_v      boolean;
  v_threats          jsonb;
  v_challenger_exps  jsonb;
  v_favor_points     integer;
  v_challengers      jsonb;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_place_exists;
  IF NOT v_place_exists THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  SELECT pv.expedition_id, pv.veilleur_user_id, pv.by_influence, pv.planted_at
  INTO v_veilleur_exp, v_veilleur_user, v_by_influence, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_vacant := (v_veilleur_exp IS NULL);
  v_score_veilleur := COALESCE(public._user_place_score(v_veilleur_user, p_place_id), 0);

  v_favor_points := COALESCE(public._defender_favor_only(p_place_id), 0);

  -- V156 : topPatrons désagrégé par user_id (chaque contributeur visible).
  --   defense_total = ses invests dont beneficiary = veilleur courant
  --   attack_total  = ses invests dont beneficiary != veilleur (= challenger)
  -- Limit 10 (vs 5 avant) car on liste défenseurs + challengers ensemble.
  WITH agg AS (
    SELECT
      pca.user_id,
      SUM(CASE
        WHEN v_veilleur_user IS NOT NULL AND pca.beneficiary_user_id = v_veilleur_user
        THEN pca.amount ELSE 0
      END)::integer AS defense_total,
      SUM(CASE
        WHEN v_veilleur_user IS NULL OR pca.beneficiary_user_id IS DISTINCT FROM v_veilleur_user
        THEN pca.amount ELSE 0
      END)::integer AS attack_total
    FROM public.place_court_action pca
    WHERE pca.place_id = p_place_id
    GROUP BY pca.user_id
    HAVING SUM(pca.amount) > 0
  ),
  top10 AS (
    SELECT * FROM agg ORDER BY (defense_total + attack_total) DESC LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',         t.user_id,
    'displayName',    COALESCE(u.display_name, u.first_name, u.id),
    'avatarUrl',      u.avatar_url,
    'total',          t.defense_total + t.attack_total,
    'defenseTotal',   t.defense_total,
    'attackTotal',    t.attack_total,
    'factionId',      u.faction_id,
    'factionColor',   f.color,
    'factionPattern', f.pattern
  ) ORDER BY (t.defense_total + t.attack_total) DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM top10 t
  JOIN public.users u ON u.id = t.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id;

  -- V173 : challengers user-centric = cibles soutenables. Groupé par bénéficiaire,
  -- non-veilleur, score > 0. expeditionId = expé challenger du user sur ce lieu
  -- (passée telle quelle par le front à invest_crowns).
  WITH chal AS (
    SELECT pca.beneficiary_user_id AS user_id, SUM(pca.amount)::integer AS score
    FROM public.place_court_action pca
    WHERE pca.place_id = p_place_id
      AND (v_veilleur_user IS NULL OR pca.beneficiary_user_id IS DISTINCT FROM v_veilleur_user)
    GROUP BY pca.beneficiary_user_id
    HAVING SUM(pca.amount) > 0
    ORDER BY SUM(pca.amount) DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',         c.user_id,
    'displayName',    COALESCE(u.display_name, u.first_name, u.id),
    'avatarUrl',      u.avatar_url,
    'score',          c.score,
    'factionColor',   f.color,
    'factionPattern', f.pattern,
    'expeditionId',   (
      SELECT e.id FROM public.expeditions e
      JOIN public.expedition_members em ON em.expedition_id = e.id
      WHERE em.user_id = c.user_id AND e.place_id = p_place_id
        AND (v_veilleur_exp IS NULL OR e.id != v_veilleur_exp)
      LIMIT 1
    )
  ) ORDER BY c.score DESC), '[]'::jsonb)
  INTO v_challengers
  FROM chal c
  JOIN public.users u ON u.id = c.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id;

  -- Plus grosse menace = top score parmi non-veilleurs (inchangé)
  SELECT COALESCE(MAX(total), 0) INTO v_threat_score
  FROM (
    SELECT SUM(amount) AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
      AND (v_veilleur_user IS NULL OR beneficiary_user_id IS DISTINCT FROM v_veilleur_user)
    GROUP BY beneficiary_user_id
  ) sub;

  IF v_vacant THEN
    v_status := 'vacant';
  ELSIF v_score_veilleur <= 0 THEN
    v_status := CASE WHEN v_threat_score > 0 THEN 'en_siege' ELSE 'paisible' END;
  ELSIF v_threat_score = 0 OR v_threat_score < (v_score_veilleur * 10 / 100) THEN
    v_status := 'paisible';
  ELSIF v_threat_score < (v_score_veilleur * 50 / 100) THEN
    v_status := 'convoite';
  ELSIF v_threat_score < (v_score_veilleur * 80 / 100) THEN
    v_status := 'sous_pression';
  ELSE
    v_status := 'en_siege';
  END IF;

  IF NOT v_vacant AND v_veilleur_user IS NOT NULL THEN
    DECLARE
      v_exp_member_count integer;
      v_exp_title        text;
      v_is_group         boolean;
    BEGIN
      SELECT COUNT(*)::integer INTO v_exp_member_count
      FROM public.expedition_members em WHERE em.expedition_id = v_veilleur_exp;

      SELECT title INTO v_exp_title
      FROM public.expeditions WHERE id = v_veilleur_exp;

      v_is_group := (v_exp_member_count > 1 AND v_exp_title IS NOT NULL);

      SELECT jsonb_build_object(
        'expeditionId',     v_veilleur_exp,
        'name',             CASE WHEN v_is_group THEN v_exp_title ELSE COALESCE(f.title, 'Veilleur') END,
        'planted_at',       v_planted_at,
        'byInfluence',      COALESCE(v_by_influence, false),
        'leaderName',       CASE WHEN v_is_group THEN v_exp_title ELSE COALESCE(u.display_name, u.first_name, u.id) END,
        'leaderUserId',     u.id,
        'leaderAvatarUrl',  u.avatar_url,
        'factionId',        u.faction_id,
        'factionColor',     f.color,
        'factionPattern',   f.pattern,
        'isGroup',          v_is_group,
        'groupTitle',       v_exp_title,
        'members', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'userId',      em.user_id,
            'displayName', COALESCE(u2.display_name, u2.first_name, u2.id)
          ))
          FROM public.expedition_members em
          JOIN public.users u2 ON u2.id = em.user_id
          WHERE em.expedition_id = v_veilleur_exp
        ), '[]'::jsonb)
      ) INTO v_veilleur_obj
      FROM public.users u
      LEFT JOIN public.factions f ON f.id = u.faction_id
      WHERE u.id = v_veilleur_user;
    END;
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'ts') DESC), '[]'::jsonb)
  INTO v_chronicle
  FROM (
    SELECT jsonb_build_object(
      'ts',             c.created_at,
      'actorName',      COALESCE(u.display_name, u.first_name, u.id),
      'expeditionName', COALESCE(f.title, 'Expédition'),
      'side',           c.side,
      'amount',         c.amount
    ) AS t
    FROM (
      SELECT pca.* FROM public.place_court_action pca
      WHERE pca.place_id = p_place_id
      ORDER BY pca.created_at DESC
      LIMIT 10
    ) c
    JOIN public.users u ON u.id = c.user_id
    LEFT JOIN public.expeditions e ON e.id = c.expedition_id
    LEFT JOIN public.factions f ON f.id = e.faction_id
  ) sub;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'score')::int DESC), '[]'::jsonb)
  INTO v_threats
  FROM (
    SELECT jsonb_build_object(
      'expeditionId', pcs.expedition_id,
      'name',         COALESCE(f.title, 'Expédition'),
      'score',        pcs.score
    ) AS t
    FROM public.place_court_score pcs
    JOIN public.expeditions e ON e.id = pcs.expedition_id
    LEFT JOIN public.factions f ON f.id = e.faction_id
    WHERE pcs.place_id = p_place_id
      AND (v_veilleur_exp IS NULL OR pcs.expedition_id != v_veilleur_exp)
      AND pcs.score > 0
    ORDER BY pcs.score DESC
    LIMIT 5
  ) sub;

  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'vacant',             v_vacant,
      'veilleur',           v_veilleur_obj,
      'scoreVeilleur',      v_score_veilleur,
      'defenseFavorPoints', v_favor_points,
      'defenseInvested',    GREATEST(v_score_veilleur - v_favor_points, 0),
      'threats',            v_threats,
      'menaceHaute',        NULL,
      'scoreToBeat',        v_score_veilleur,
      'topPatrons',         v_top_patrons,
      'challengers',        v_challengers,
      'chronicle',          v_chronicle,
      'status',             v_status,
      'callerContext',      NULL
    );
  END IF;

  v_is_member_v := (NOT v_vacant AND p_user_id = v_veilleur_user);

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  v_user_total := COALESCE(public._user_place_score(p_user_id, p_place_id), 0);

  SELECT COALESCE(jsonb_agg(em.expedition_id), '[]'::jsonb)
  INTO v_challenger_exps
  FROM public.expedition_members em
  JOIN public.expeditions e ON e.id = em.expedition_id
  WHERE em.user_id = p_user_id
    AND (v_veilleur_exp IS NULL OR em.expedition_id != v_veilleur_exp)
    AND e.place_id = p_place_id;

  v_score_to_beat := CASE WHEN NOT v_is_member_v THEN v_score_veilleur ELSE NULL END;

  RETURN json_build_object(
    'vacant',             v_vacant,
    'veilleur',           v_veilleur_obj,
    'scoreVeilleur',      v_score_veilleur,
    'defenseFavorPoints', v_favor_points,
    'defenseInvested',    GREATEST(v_score_veilleur - v_favor_points, 0),
    'threats',            v_threats,
    'menaceHaute',        CASE WHEN NOT v_is_member_v THEN v_threat_score ELSE NULL END,
    'scoreToBeat',        v_score_to_beat,
    'topPatrons',         v_top_patrons,
    'challengers',        v_challengers,
    'chronicle',          v_chronicle,
    'status',             v_status,
    'callerContext',      jsonb_build_object(
      'balance',                v_balance,
      'isMemberOfVeilleur',     v_is_member_v,
      'challengerExpeditions',  v_challenger_exps,
      'userTotalOnPlace',       v_user_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_court_state(text, text)
  TO anon, authenticated, service_role;

-- Retire l'ancienne surcharge à 4 args (remplacée par la version à 5 args).
DROP FUNCTION IF EXISTS public.invest_crowns(text, text, uuid, integer);

COMMIT;
