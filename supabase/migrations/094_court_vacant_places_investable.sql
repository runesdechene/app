-- 094_court_vacant_places_investable.sql
-- WHY : ouvrir l'influence à distance sur les lieux SANS veilleur (jamais
-- plantés, ou abandonnés). Cas type : la Mongolie. Avant cette mig, ces
-- lieux étaient doublement bloqués : pas de plantage GPS possible (trop
-- loin), pas de Cour ouverte (RPC retournait error: not_veilled).
--
-- Logique : si pas de veilleur → tu peux quand même investir tes Couronnes
-- via une expé challenger. À 50 Couronnes cumulées (la faveur de référence),
-- ton expé bascule automatiquement en veilleuse "par influence". Tu peux
-- ensuite confirmer par GPS (cas B de plant_flag) si tu y vas un jour.
--
-- Modifs :
--   - get_place_court_state : retourne un état `vacant: true` lisible au lieu
--     de error: not_veilled. Inclut callerContext (balance), scoreToBeat=50,
--     threats (expés challengers existantes), top patrons accumulés.
--   - invest_crowns : autorise le cas vacant. Pas de veilleur → side='attack'
--     forcé. Bascule automatique au franchissement du seuil 50.

BEGIN;

-- ============================================================
-- 1. get_place_court_state — gère l'état vacant
-- ============================================================

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
  v_place_exists     boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_place_exists;
  IF NOT v_place_exists THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  SELECT pv.expedition_id, pv.by_influence, pv.planted_at
  INTO v_veilleur_exp, v_by_influence, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- ============================================================
  -- CAS VACANT — pas de veilleur (V094)
  -- ============================================================
  IF v_veilleur_exp IS NULL THEN
    -- Top mécènes accumulés sur ce lieu (peut être >0 même sans veilleur,
    -- si quelqu'un a investi sur une expé challenger qui n'a pas encore basculé).
    SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'total')::int DESC), '[]'::jsonb)
    INTO v_top_patrons
    FROM (
      SELECT jsonb_build_object(
        'userId',         x.user_id,
        'displayName',    COALESCE(u.display_name, u.first_name, u.id),
        'total',          x.total,
        'defenseTotal',   x.defense_total,
        'attackTotal',    x.attack_total,
        'factionId',      u.faction_id,
        'factionColor',   f.color,
        'factionPattern', f.pattern
      ) AS t,
      x.total
      FROM (
        SELECT
          user_id,
          SUM(amount)::integer                                            AS total,
          SUM(CASE WHEN side = 'defense' THEN amount ELSE 0 END)::integer AS defense_total,
          SUM(CASE WHEN side = 'attack'  THEN amount ELSE 0 END)::integer AS attack_total
        FROM public.place_court_action
        WHERE place_id = p_place_id
        GROUP BY user_id
        ORDER BY total DESC
        LIMIT 5
      ) x
      JOIN public.users u ON u.id = x.user_id
      LEFT JOIN public.factions f ON f.id = u.faction_id
    ) sub;

    -- Threats (expés challengers actives sur ce lieu vacant)
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
        AND pcs.score > 0
      ORDER BY pcs.score DESC
      LIMIT 5
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

    -- Caller context (balance + expés challengers du caller sur ce lieu)
    IF p_user_id IS NOT NULL THEN
      SELECT COALESCE(balance, 0) INTO v_balance
      FROM public.user_crowns WHERE user_id = p_user_id;
      v_balance := COALESCE(v_balance, 0);

      SELECT COALESCE(SUM(amount), 0)::integer INTO v_user_total
      FROM public.place_court_action
      WHERE place_id = p_place_id AND user_id = p_user_id;

      SELECT COALESCE(jsonb_agg(em.expedition_id), '[]'::jsonb)
      INTO v_challenger_exps
      FROM public.expedition_members em
      JOIN public.expeditions e ON e.id = em.expedition_id
      WHERE em.user_id = p_user_id
        AND e.place_id = p_place_id;
    END IF;

    RETURN json_build_object(
      'vacant',         true,
      'veilleur',       NULL,
      'scoreVeilleur',  0,
      'threats',        v_threats,
      'menaceHaute',    NULL,
      'scoreToBeat',    50,  -- seuil pour basculer en veilleur "par influence"
      'topPatrons',     v_top_patrons,
      'chronicle',      v_chronicle,
      'status',         'vacant',
      'callerContext',  CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
        'balance',                v_balance,
        'isMemberOfVeilleur',     false,
        'challengerExpeditions',  v_challenger_exps,
        'userTotalOnPlace',       v_user_total
      ) END
    );
  END IF;

  -- ============================================================
  -- CAS VEILLÉ — comportement standard (verbatim mig 090)
  -- ============================================================

  SELECT COALESCE(score, 0) INTO v_score_defense
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
  v_score_veilleur := 50 + COALESCE(v_score_defense, 0);

  SELECT MAX(score) INTO v_menace_haute
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id != v_veilleur_exp;
  v_menace_haute := COALESCE(v_menace_haute, 0);

  IF v_menace_haute = 0 OR v_menace_haute < (v_score_veilleur * 10 / 100) THEN
    v_status := 'paisible';
  ELSIF v_menace_haute < (v_score_veilleur * 50 / 100) THEN
    v_status := 'convoite';
  ELSIF v_menace_haute < (v_score_veilleur * 80 / 100) THEN
    v_status := 'sous_pression';
  ELSE
    v_status := 'en_siege';
  END IF;

  SELECT jsonb_build_object(
    'expeditionId',     e.id,
    'name',             COALESCE(f.title, 'Expédition'),
    'planted_at',       v_planted_at,
    'byInfluence',      v_by_influence,
    'leaderName',       COALESCE(lead_u.display_name, lead_u.first_name, lead_u.email_address, 'le veilleur'),
    'leaderUserId',     lead_u.id,
    'leaderAvatarUrl',  lead_u.avatar_url,
    'factionId',        e.faction_id,
    'factionColor',     f.color,
    'factionPattern',   f.pattern,
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
  LEFT JOIN LATERAL (
    SELECT u.id, u.display_name, u.first_name, u.email_address, u.avatar_url
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = e.id
    ORDER BY u.id
    LIMIT 1
  ) lead_u ON TRUE
  WHERE e.id = v_veilleur_exp;

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

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'total')::int DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM (
    SELECT jsonb_build_object(
      'userId',         x.user_id,
      'displayName',    COALESCE(u.display_name, u.first_name, u.id),
      'total',          x.total,
      'defenseTotal',   x.defense_total,
      'attackTotal',    x.attack_total,
      'factionId',      u.faction_id,
      'factionColor',   f.color,
      'factionPattern', f.pattern
    ) AS t,
    x.total
    FROM (
      SELECT
        user_id,
        SUM(amount)::integer                                            AS total,
        SUM(CASE WHEN side = 'defense' THEN amount ELSE 0 END)::integer AS defense_total,
        SUM(CASE WHEN side = 'attack'  THEN amount ELSE 0 END)::integer AS attack_total
      FROM public.place_court_action
      WHERE place_id = p_place_id
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT 5
    ) x
    JOIN public.users u ON u.id = x.user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
  ) sub;

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

  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'vacant',         false,
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

  SELECT COALESCE(jsonb_agg(em.expedition_id), '[]'::jsonb)
  INTO v_challenger_exps
  FROM public.expedition_members em
  JOIN public.expeditions e ON e.id = em.expedition_id
  WHERE em.user_id = p_user_id
    AND em.expedition_id != v_veilleur_exp
    AND e.place_id = p_place_id;

  RETURN json_build_object(
    'vacant',         false,
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

-- ============================================================
-- 2. invest_crowns — gère le cas vacant (bascule auto à 50)
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
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('error', 'invalid_amount');
  END IF;

  -- État du lieu
  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_veilleur_exp, v_was_by_influence, v_prev_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_was_vacant := (v_veilleur_exp IS NULL);

  -- target_expedition existe + est sur ce lieu ?
  SELECT EXISTS (
    SELECT 1 FROM public.expeditions
    WHERE id = p_target_expedition_id AND place_id = p_place_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  -- Balance
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  -- Détermination side
  IF v_was_vacant THEN
    -- Lieu vierge : on est forcément en attaque (poser sa marque)
    v_side := 'attack';
    -- L'utilisateur doit être membre de l'expé cible
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

  -- Transaction
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
  -- BASCULE
  -- ============================================================

  IF v_side = 'attack' THEN
    IF v_was_vacant THEN
      -- Lieu vierge : seuil de pose = 50 (la faveur de référence)
      IF v_new_target_score >= 50 THEN
        SELECT faction_id, is_neutral INTO v_target_faction, v_target_neutral
        FROM public.expeditions WHERE id = p_target_expedition_id;

        -- Création place_veille en mode by_influence (jamais planté IRL)
        INSERT INTO public.place_veille
          (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id)
        VALUES
          (p_place_id, p_target_expedition_id, v_target_faction, COALESCE(v_target_neutral, false),
           v_now, true, NULL)
        ON CONFLICT (place_id) DO NOTHING;

        DELETE FROM public.place_court_score WHERE place_id = p_place_id;

        v_basculed := true;
      END IF;
    ELSE
      -- Lieu déjà veillé : seuil = score veilleur courant
      SELECT COALESCE(score, 0) INTO v_veilleur_score
      FROM public.place_court_score
      WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
      v_veilleur_score := 50 + COALESCE(v_veilleur_score, 0);

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
  -- NOTIFICATIONS
  -- ============================================================

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    IF v_was_vacant THEN
      -- Lieu vierge planté à distance — notif unique pour la nouvelle expé
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',     v_place_title,
        'expeditionId',   p_target_expedition_id,
        'fromVacant',     true
      ));
    ELSE
      -- Bascule classique sur lieu veillé
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',      v_place_title,
        'actorName',       v_actor_name,
        'oldExpeditionId', v_old_exp_id,
        'newExpeditionId', p_target_expedition_id
      ));
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_taken_remote_self', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',     v_place_title,
        'expeditionId',   p_target_expedition_id
      ));
    END IF;
  ELSIF v_side = 'attack' AND NOT v_was_vacant THEN
    -- Cap 1×/jour pour place_court_attack
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

  -- Mécène principal (best-effort)
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
    'basculedExpeditionId',   CASE WHEN v_basculed THEN p_target_expedition_id ELSE NULL END,
    'fromVacant',             v_was_vacant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer)
  TO authenticated, service_role;

-- ============================================================
-- 3. create_challenger_expedition — autoriser sur lieu vacant
-- ============================================================
-- L'ancien check `NOT EXISTS place_veille` est devenu obsolète : sur lieu
-- vacant il faut justement créer une expé pour pouvoir investir.

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
  v_place_exists  boolean;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_faction_id FROM public.users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_place_exists;
  IF NOT v_place_exists THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  SELECT pv.expedition_id INTO v_veilleur_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- Si lieu veillé : ne pas créer si user déjà dans l'expé veilleuse
  IF v_veilleur_exp IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.expedition_members em
    WHERE em.expedition_id = v_veilleur_exp AND em.user_id = p_user_id
  ) THEN
    RETURN json_build_object('error', 'already_veilleur');
  END IF;

  -- Réutiliser une expé existante du user sur ce lieu
  SELECT e.id INTO v_existing_exp
  FROM public.expeditions e
  JOIN public.expedition_members em ON em.expedition_id = e.id
  WHERE e.place_id = p_place_id
    AND em.user_id = p_user_id
    AND (v_veilleur_exp IS NULL OR e.id != v_veilleur_exp)
  LIMIT 1;

  IF v_existing_exp IS NOT NULL THEN
    RETURN json_build_object(
      'success',      true,
      'expeditionId', v_existing_exp,
      'reused',       true
    );
  END IF;

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

COMMIT;
