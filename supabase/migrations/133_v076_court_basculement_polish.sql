-- 133_v076_court_basculement_polish.sql
-- WHY : 4 changements liés autour du système Cour / mécénat (Uriel 8/05) :
--
--   1) FIX score post-bascule : aujourd'hui DELETE FROM place_court_score
--      WHERE place_id = X efface aussi la ligne du gagnant. Le challenger qui
--      vient d'investir 58 Couronnes pour prendre se retrouve avec un score
--      Cour de 0 alors qu'il est nouveau veilleur. Décision Uriel : le gagnant
--      garde sa ligne (qui devient automatiquement défense en runtime puisque
--      pcs.expedition_id == pv.expedition_id). Une seule ligne change : on
--      ajoute une condition AND expedition_id != gagnant au DELETE.
--
--   2) NOUVEAU : bonus défense plant_flag par membre. Le veilleur GPS plein
--      avait 50 fixes. Désormais : 50 (solo) + 30 par membre additionnel,
--      capé à 10 membres (= 50 + 9×30 = 320 max). Encourage la marche à
--      plusieurs et la cohésion d'expédition.
--
--      Paramètres dans app_settings (ajustable à chaud) :
--        - plant_flag_solo_bonus = 50
--        - plant_flag_per_extra_member = 30
--        - plant_flag_max_members_for_bonus = 10
--
--   3) Nouveau helper _defender_effective_score(p_place_id) qui centralise
--      le calcul (50 + bonus membres + invest défensif), réutilisable dans
--      invest_crowns ET list_places_in_siege. Source de vérité unique.
--
--   4) Enrichir le data du log place_taken_remote(_self) avec le nouveau
--      veilleur complet (factionId, factionColor, factionPattern, isNeutral,
--      members) → permet au frontend de mettre à jour la carte en temps
--      réel sans re-fetch (cf. pushVeilleOverride existant pour plant_flag).
--
-- Reprise B1 verbatim de la version courante d'invest_crowns. Les deltas sont
-- limités au calcul de v_veilleur_score (utilise helper), au DELETE bascule,
-- et au data des deux INSERT activity_log de bascule.

BEGIN;

-- ============================================================
-- 1) Seed app_settings — bonus membres
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
  ('plant_flag_solo_bonus',            '50'),
  ('plant_flag_per_extra_member',      '30'),
  ('plant_flag_max_members_for_bonus', '10')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2) Helper : score effectif du défenseur d'un lieu
-- ============================================================
-- Calcul : (si plant_flag plein) bonus_solo + per_extra × (members_count - 1, capé) + invest_defense
--          (si by_influence)     invest_defense
--          (si pas de veilleur)  0
CREATE OR REPLACE FUNCTION public._defender_effective_score(p_place_id text)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_exp_id        uuid;
  v_by_influence  boolean;
  v_members       integer;
  v_invested      integer;
  v_solo          integer;
  v_per_extra     integer;
  v_max_for_bonus integer;
  v_extra         integer;
BEGIN
  SELECT pv.expedition_id, COALESCE(pv.by_influence, false)
  INTO v_exp_id, v_by_influence
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_exp_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Investissement défensif courant (place_court_score du veilleur lui-même)
  SELECT COALESCE(pcs.score, 0)::integer INTO v_invested
  FROM public.place_court_score pcs
  WHERE pcs.place_id = p_place_id AND pcs.expedition_id = v_exp_id;
  v_invested := COALESCE(v_invested, 0);

  -- Veilleur "par influence" : pas de bonus 50 ni de bonus membres (pris à
  -- distance, pas de présence physique IRL).
  IF v_by_influence THEN
    RETURN v_invested;
  END IF;

  -- Veilleur plein : bonus solo + bonus membres (capé)
  SELECT COUNT(*)::integer INTO v_members
  FROM public.expedition_members em
  WHERE em.expedition_id = v_exp_id;
  v_members := GREATEST(COALESCE(v_members, 1), 1);

  v_solo          := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),            50);
  v_per_extra     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'),      30);
  v_max_for_bonus := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_extra := LEAST(v_members, v_max_for_bonus) - 1;
  IF v_extra < 0 THEN v_extra := 0; END IF;

  RETURN v_solo + v_per_extra * v_extra + v_invested;
END;
$$;

GRANT EXECUTE ON FUNCTION public._defender_effective_score(text) TO authenticated, service_role;

-- ============================================================
-- 3) invest_crowns — réécriture (verbatim + 3 modifs)
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

  -- Faction de l'expé cible (récupérée AVANT la branche bascule)
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
      -- V133 : score effectif via helper centralisé (50 base + bonus membres + invest)
      v_veilleur_score := public._defender_effective_score(p_place_id);

      IF v_new_target_score > v_veilleur_score THEN
        v_old_exp_id := v_veilleur_exp;

        -- V133 : on garde la ligne du gagnant (qui devient défense en runtime
        -- puisque pcs.expedition_id == pv.expedition_id après l'UPDATE ci-dessous).
        -- Avant : DELETE all → le gagnant arrivait avec score Cour 0, déceptif.
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
  -- NOTIFICATIONS — activity_log (ambient public) + notify (perso)
  -- V133 : data enrichi avec faction + members complets pour permettre au
  -- frontend de mettre à jour la carte en temps réel sans re-fetch.
  -- ============================================================
  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    -- Récupère couleur + pattern de la nouvelle faction (NULL si is_neutral)
    SELECT t.color, t.pattern_url
    INTO v_target_color, v_target_pattern
    FROM public.factions f
    LEFT JOIN public.tags t ON t.id = f.tag_id
    WHERE f.id = v_target_faction;

    -- Membres de l'expé qui vient de prendre (pour update overlay store front)
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

    -- V133 : seuil high_threat utilise aussi le nouveau score effectif
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

-- ============================================================
-- 4) list_places_in_siege — utilise désormais le helper
-- ============================================================
DROP FUNCTION IF EXISTS public.list_places_in_siege();

CREATE OR REPLACE FUNCTION public.list_places_in_siege()
RETURNS TABLE(
  place_id                  text,
  challenger_count          integer,
  max_challenger_score      integer,
  defender_effective_score  integer,
  is_at_risk                boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH defenders AS (
    SELECT
      pv.place_id,
      pv.expedition_id                                     AS defender_exp,
      public._defender_effective_score(pv.place_id)        AS effective_score
    FROM public.place_veille pv
    WHERE pv.expedition_id IS NOT NULL
  ),
  challengers AS (
    SELECT
      pcs.place_id,
      d.defender_exp,
      d.effective_score,
      COUNT(*)::integer                  AS challenger_count,
      MAX(pcs.score)::integer            AS max_challenger_score
    FROM public.place_court_score pcs
    JOIN defenders d ON d.place_id = pcs.place_id
    WHERE pcs.score > 0
      AND pcs.expedition_id != d.defender_exp
    GROUP BY pcs.place_id, d.defender_exp, d.effective_score
  )
  SELECT
    p.id                                                    AS place_id,
    c.challenger_count,
    c.max_challenger_score,
    c.effective_score::integer                              AS defender_effective_score,
    (c.max_challenger_score::numeric >= c.effective_score::numeric / 2.0
     AND c.effective_score > 0)                             AS is_at_risk
  FROM challengers c
  JOIN public.places p ON p.id = c.place_id
  WHERE NOT p.private AND NOT p.masked;
$$;

GRANT EXECUTE ON FUNCTION public.list_places_in_siege() TO anon, authenticated, service_role;

COMMIT;
