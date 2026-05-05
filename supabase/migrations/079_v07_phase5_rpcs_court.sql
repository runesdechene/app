-- 079_v07_phase5_rpcs_court.sql
-- WHY : Phase 5 (La Cour). Quatre RPCs métier :
--   - create_challenger_expedition : créer une expé challenger solo à distance
--     (sans plantage GPS) pour pouvoir attaquer un lieu lointain.
--   - join_challenger_expedition  : rejoindre une expé challenger existante.
--   - invest_crowns               : action d'investissement (défense ou attaque),
--     bascule atomique, log activity_log avec cap 1×/jour pour place_court_attack.
--   - get_place_court_state       : retour unifié pour la fiche lieu (veilleur,
--     score, top mécènes, chronique, statut, contexte caller).
-- Faveur 50 du veilleur : implicite, jamais stockée. Calculée à la volée.

BEGIN;

-- ============================================================
-- RPC create_challenger_expedition
-- ============================================================
-- Crée une expédition solo (1 membre = caller) sur un lieu donné, sans plantage
-- GPS. Cette expé n'est PAS associée à place_veille — elle existe pour servir de
-- vecteur d'attaque distance. Plusieurs expés peuvent exister sur un même lieu
-- en parallèle (la veilleuse + N challengers).
-- Garde-fou : un user ne peut pas créer 2 expés challengers sur le même lieu.

CREATE OR REPLACE FUNCTION public.create_challenger_expedition(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id    text;
  v_veilleur_exp  uuid;
  v_existing_exp  uuid;
  v_new_exp_id    uuid;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Récupère faction_id du user (champ stocké sur expedition + expedition_members)
  SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Lieu existe + veilleur ?
  SELECT pv.expedition_id INTO v_veilleur_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_veilleur_exp IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- Le user appartient déjà à l'expé veilleuse ? Pas la peine de créer une challenger.
  IF EXISTS (
    SELECT 1 FROM public.expedition_members em
    WHERE em.expedition_id = v_veilleur_exp AND em.user_id = p_user_id
  ) THEN
    RETURN json_build_object('error', 'already_veilleur');
  END IF;

  -- Existe déjà une expé challenger pour ce user sur ce lieu ?
  SELECT e.id INTO v_existing_exp
  FROM public.expeditions e
  JOIN public.expedition_members em ON em.expedition_id = e.id
  WHERE e.place_id = p_place_id
    AND em.user_id = p_user_id
    AND e.id != v_veilleur_exp
  LIMIT 1;

  IF v_existing_exp IS NOT NULL THEN
    RETURN json_build_object(
      'success',      true,
      'expeditionId', v_existing_exp,
      'reused',       true
    );
  END IF;

  -- Création nouvelle expé challenger
  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, false, v_faction_id, now())
  RETURNING id INTO v_new_exp_id;

  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_new_exp_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success',      true,
    'expeditionId', v_new_exp_id,
    'reused',       false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_challenger_expedition(text, text)
  TO authenticated, service_role;

-- ============================================================
-- RPC join_challenger_expedition
-- ============================================================
-- Permet à un user de rejoindre une expé challenger existante. Garde-fou :
-- l'expé doit être différente de l'expé veilleuse du lieu.

CREATE OR REPLACE FUNCTION public.join_challenger_expedition(
  p_user_id        text,
  p_expedition_id  uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id    text;
  v_place_id      text;
  v_veilleur_exp  uuid;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Récupère le lieu de cette expé
  SELECT place_id INTO v_place_id FROM public.expeditions WHERE id = p_expedition_id;
  IF v_place_id IS NULL THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  -- Vérifie que ce n'est pas l'expé veilleuse
  SELECT pv.expedition_id INTO v_veilleur_exp
  FROM public.place_veille pv
  WHERE pv.place_id = v_place_id;

  IF v_veilleur_exp = p_expedition_id THEN
    RETURN json_build_object('error', 'cannot_join_veilleur_remotely');
  END IF;

  -- Insertion idempotente
  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (p_expedition_id, p_user_id, v_faction_id)
  ON CONFLICT (expedition_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'success',      true,
    'expeditionId', p_expedition_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_challenger_expedition(text, uuid)
  TO authenticated, service_role;

-- ============================================================
-- RPC invest_crowns
-- ============================================================
-- Args :
--   p_user_id : user investisseur
--   p_place_id : lieu cible
--   p_target_expedition_id : expé qui reçoit l'investissement (défense ou attaque)
--   p_amount : montant en Couronnes (>0)
--
-- Logique :
--   1. Auth check : p_user_id = auth.uid()
--   2. Lieu veillé ? Sinon error not_veilled
--   3. Balance >= amount ? Sinon error insufficient_crowns
--   4. side = 'defense' si target_expedition = veilleur actuel, sinon 'attack'
--   5. Pour 'attack' : user doit être membre de target_expedition. Sinon not_member.
--   6. Pour 'defense' : tout user peut investir (mécénat libre).
--   7. Débit balance, insert action, upsert score.
--   8. Si attack : score atteint le score veilleur ? Bascule.
--   9. Notifications activity_log selon contexte (cap 1×/jour pour court_attack).
--
-- Retour : JSON { success, side, newScore, balance, basculed, basculedExpeditionId? }

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
  v_target_place     text;
  v_is_member_target boolean;
  v_balance          integer;
  v_side             text;
  v_veilleur_score   integer;  -- 50 + sum defense
  v_new_target_score integer;
  v_basculed         boolean := false;
  v_place_title      text;
  v_actor_name       text;
  v_threshold_50pct  integer;
  v_old_exp_id       uuid;
BEGIN
  -- Auth
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('error', 'invalid_amount');
  END IF;

  -- Lieu veillé ?
  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_veilleur_exp, v_was_by_influence, v_prev_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_veilleur_exp IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- target_expedition existe + est sur ce lieu ?
  SELECT EXISTS (
    SELECT 1 FROM public.expeditions
    WHERE id = p_target_expedition_id AND place_id = p_place_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  -- Balance suffisante ?
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  -- Détermination side
  IF p_target_expedition_id = v_veilleur_exp THEN
    v_side := 'defense';
  ELSE
    v_side := 'attack';
    -- Pour attaque : user doit être membre de target_expedition
    SELECT EXISTS (
      SELECT 1 FROM public.expedition_members em
      WHERE em.expedition_id = p_target_expedition_id AND em.user_id = p_user_id
    ) INTO v_is_member_target;

    IF NOT v_is_member_target THEN
      RETURN json_build_object('error', 'not_member');
    END IF;
  END IF;

  -- ============================================================
  -- TRANSACTION : débit balance, insert action, upsert score
  -- ============================================================

  UPDATE public.user_crowns
  SET balance = balance - p_amount,
      updated_at = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, side, amount)
  VALUES (p_place_id, p_user_id, p_target_expedition_id, v_side, p_amount);

  INSERT INTO public.place_court_score (place_id, expedition_id, score, last_action_at)
  VALUES (p_place_id, p_target_expedition_id, p_amount, v_now)
  ON CONFLICT (place_id, expedition_id) DO UPDATE SET
    score          = place_court_score.score + EXCLUDED.score,
    last_action_at = EXCLUDED.last_action_at
  RETURNING score INTO v_new_target_score;

  -- ============================================================
  -- BASCULE check (uniquement si attack)
  -- ============================================================

  IF v_side = 'attack' THEN
    -- Score veilleur = 50 + sum defense de l'expé veilleuse
    SELECT COALESCE(score, 0) INTO v_veilleur_score
    FROM public.place_court_score
    WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
    v_veilleur_score := 50 + COALESCE(v_veilleur_score, 0);

    IF v_new_target_score > v_veilleur_score THEN
      -- BASCULE
      v_old_exp_id := v_veilleur_exp;

      -- Reset tous les scores (le nouveau veilleur démarre avec faveur 50 implicite)
      DELETE FROM public.place_court_score WHERE place_id = p_place_id;

      -- Update place_veille : nouveau veilleur "par influence"
      -- Conservation de la chaîne : si l'ancien était déjà by_influence, garder
      -- son previous_expedition_id (l'ancien légitime original conserve son droit).
      UPDATE public.place_veille
      SET expedition_id = p_target_expedition_id,
          by_influence  = true,
          previous_expedition_id = COALESCE(v_prev_exp, v_old_exp_id),
          planted_at    = v_now
      WHERE place_id = p_place_id;

      v_basculed := true;
    END IF;
  END IF;

  -- ============================================================
  -- NOTIFICATIONS
  -- ============================================================

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    -- Notif aux membres de l'ancienne expé veilleuse
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_remote', p_user_id, p_place_id, jsonb_build_object(
      'placeTitle',      v_place_title,
      'actorName',       v_actor_name,
      'oldExpeditionId', v_old_exp_id,
      'newExpeditionId', p_target_expedition_id
    ));

    -- Notif aux membres de la nouvelle expé veilleuse
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_remote_self', p_user_id, p_place_id, jsonb_build_object(
      'placeTitle',     v_place_title,
      'expeditionId',   p_target_expedition_id
    ));
  ELSIF v_side = 'attack' THEN
    -- Cap 1×/jour : ne logger place_court_attack que si pas déjà loggé
    -- aujourd'hui pour cette tuple (place, expedition_attaquante).
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_log
      WHERE type = 'place_court_attack'
        AND place_id = p_place_id
        AND (data->>'expeditionId')::uuid = p_target_expedition_id
        AND created_at::date = v_today_date
    ) THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_attack', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',   v_place_title,
        'actorName',    v_actor_name,
        'expeditionId', p_target_expedition_id
      ));
    END IF;

    -- High threat : si menace franchit 50% du score veilleur
    v_threshold_50pct := v_veilleur_score / 2;
    IF v_new_target_score >= v_threshold_50pct
       AND (v_new_target_score - p_amount) < v_threshold_50pct
    THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_high_threat', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',   v_place_title,
        'expeditionId', p_target_expedition_id,
        'score',        v_new_target_score
      ));
    END IF;
  END IF;

  -- ============================================================
  -- TITRE Mécène Principal — émission de notif si user devient #1
  -- ============================================================
  -- Best-effort : si après cet investissement le user est #1 mécène cumulatif
  -- du lieu ET pas déjà notifié dans la dernière heure, on log la notif.
  -- mecene_principal_lost (ancien #1 déchu) non émis en V1 — V2 si pertinent.

  WITH totals AS (
    SELECT user_id, SUM(amount) AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY user_id
  ),
  ranked AS (
    SELECT user_id, total, ROW_NUMBER() OVER (ORDER BY total DESC, user_id) AS rk
    FROM totals
  )
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  SELECT 'mecene_principal_gained', p_user_id, p_place_id,
         jsonb_build_object('placeTitle', v_place_title, 'total', r.total)
  FROM ranked r
  WHERE r.user_id = p_user_id AND r.rk = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.activity_log al
      WHERE al.type = 'mecene_principal_gained'
        AND al.actor_id = p_user_id
        AND al.place_id = p_place_id
        AND al.created_at > v_now - interval '1 hour'
    );

  RETURN json_build_object(
    'success',                true,
    'side',                   v_side,
    'newScore',               v_new_target_score,
    'balance',                v_balance - p_amount,
    'basculed',               v_basculed,
    'basculedExpeditionId',   CASE WHEN v_basculed THEN p_target_expedition_id ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer)
  TO authenticated, service_role;

-- ============================================================
-- RPC get_place_court_state
-- ============================================================
-- Retour unifié pour la fiche lieu La Cour.

CREATE OR REPLACE FUNCTION public.get_place_court_state(
  p_place_id text,
  p_user_id  text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_veilleur_exp     uuid;
  v_by_influence     boolean;
  v_planted_at       timestamptz;
  v_score_defense    integer;
  v_score_veilleur   integer;
  v_menace_haute     integer;
  v_status           text;
  v_is_member_v      boolean;
  v_balance          integer;
  v_user_total       integer;
  v_veilleur_obj     jsonb;
  v_threats          jsonb;
  v_top_patrons      jsonb;
  v_chronicle        jsonb;
  v_challenger_exps  jsonb;
BEGIN
  -- Veilleur info
  SELECT pv.expedition_id, pv.by_influence, pv.planted_at
  INTO v_veilleur_exp, v_by_influence, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_veilleur_exp IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- Score veilleur = 50 + defense
  SELECT COALESCE(score, 0) INTO v_score_defense
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
  v_score_veilleur := 50 + COALESCE(v_score_defense, 0);

  -- Menace haute (max score parmi expés challengers)
  SELECT MAX(score) INTO v_menace_haute
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id != v_veilleur_exp;
  v_menace_haute := COALESCE(v_menace_haute, 0);

  -- Statut (pourcentage menace / score veilleur)
  IF v_menace_haute = 0 OR v_menace_haute < (v_score_veilleur * 10 / 100) THEN
    v_status := 'paisible';
  ELSIF v_menace_haute < (v_score_veilleur * 50 / 100) THEN
    v_status := 'convoite';
  ELSIF v_menace_haute < (v_score_veilleur * 80 / 100) THEN
    v_status := 'sous_pression';
  ELSE
    v_status := 'en_siege';
  END IF;

  -- Veilleur object (avec membres)
  SELECT jsonb_build_object(
    'expeditionId', e.id,
    'name',         COALESCE(f.title, 'Expédition'),
    'planted_at',   v_planted_at,
    'byInfluence',  v_by_influence,
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId',      em.user_id,
        'displayName', COALESCE(u.display_name, u.first_name, u.id)
      ))
      FROM public.expedition_members em
      JOIN public.users u ON u.id = em.user_id
      WHERE em.expedition_id = e.id
    ), '[]'::jsonb)
  ) INTO v_veilleur_obj
  FROM public.expeditions e
  LEFT JOIN public.factions f ON f.id = e.faction_id
  WHERE e.id = v_veilleur_exp;

  -- Threats (top 5 challengers, score>0)
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
      AND pcs.expedition_id != v_veilleur_exp
      AND pcs.score > 0
    ORDER BY pcs.score DESC
    LIMIT 5
  ) sub;

  -- Top mécènes (cumulatif à vie sur ce lieu)
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'total')::int DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM (
    SELECT jsonb_build_object(
      'userId',      x.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, u.id),
      'total',       x.total
    ) AS t,
    x.total
    FROM (
      SELECT user_id, SUM(amount)::integer AS total
      FROM public.place_court_action
      WHERE place_id = p_place_id
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT 5
    ) x
    JOIN public.users u ON u.id = x.user_id
  ) sub;

  -- Chronique (10 dernières actions)
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
    JOIN public.expeditions e ON e.id = c.expedition_id
    LEFT JOIN public.factions f ON f.id = e.faction_id
  ) sub;

  -- Caller context
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'veilleur',       v_veilleur_obj,
      'scoreVeilleur',  v_score_veilleur,
      'threats',        v_threats,
      'menaceHaute',    NULL,
      'scoreToBeat',    NULL,
      'topPatrons',     v_top_patrons,
      'chronicle',      v_chronicle,
      'status',         v_status,
      'callerContext',  NULL
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.expedition_members em
    WHERE em.expedition_id = v_veilleur_exp AND em.user_id = p_user_id
  ) INTO v_is_member_v;

  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  SELECT COALESCE(SUM(amount), 0)::integer INTO v_user_total
  FROM public.place_court_action
  WHERE place_id = p_place_id AND user_id = p_user_id;

  -- Expéditions challengers où le caller est membre (pour bouton "Investir pour [expé]")
  SELECT COALESCE(jsonb_agg(em.expedition_id), '[]'::jsonb)
  INTO v_challenger_exps
  FROM public.expedition_members em
  JOIN public.expeditions e ON e.id = em.expedition_id
  WHERE em.user_id = p_user_id
    AND em.expedition_id != v_veilleur_exp
    AND e.place_id = p_place_id;

  RETURN json_build_object(
    'veilleur',       v_veilleur_obj,
    'scoreVeilleur',  v_score_veilleur,
    'threats',        v_threats,
    'menaceHaute',    CASE WHEN v_is_member_v THEN v_menace_haute ELSE NULL END,
    'scoreToBeat',    CASE WHEN NOT v_is_member_v THEN v_score_veilleur ELSE NULL END,
    'topPatrons',     v_top_patrons,
    'chronicle',      v_chronicle,
    'status',         v_status,
    'callerContext',  jsonb_build_object(
      'balance',                v_balance,
      'isMemberOfVeilleur',     v_is_member_v,
      'challengerExpeditions',  v_challenger_exps,
      'userTotalOnPlace',       v_user_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_court_state(text, text)
  TO authenticated, anon, service_role;

COMMIT;
