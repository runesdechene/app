-- 135_fix_court_state_order_by.sql
-- WHY : la mig 134 a un bug SQL — le ORDER BY (defense_total + attack_total)
-- dans la sous-requête échoue avec "column defense_total does not exist".
-- Postgres n'autorise pas les alias d'agrégation dans ORDER BY d'une
-- sous-requête imbriquée selon le contexte. Fix : utiliser une CTE WITH.
--
-- Reprise verbatim de get_place_court_state (mig 134), seuls les deux blocs
-- topPatrons sont restructurés en WITH.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_place_court_state(
  p_place_id text,
  p_user_id  text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
  v_score_to_beat    integer;
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
  -- CAS VACANT
  -- ============================================================
  IF v_veilleur_exp IS NULL THEN
    WITH agg AS (
      SELECT
        user_id,
        0::integer AS defense_total,
        SUM(CASE
          WHEN expedition_id IN (
            SELECT expedition_id FROM public.place_court_score
            WHERE place_id = p_place_id AND score > 0
          ) THEN amount ELSE 0
        END)::integer AS attack_total
      FROM public.place_court_action
      WHERE place_id = p_place_id
      GROUP BY user_id
    ),
    top5 AS (
      SELECT * FROM agg
      WHERE defense_total + attack_total > 0
      ORDER BY (defense_total + attack_total) DESC
      LIMIT 5
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'userId',         x.user_id,
      'displayName',    COALESCE(u.display_name, u.first_name, u.id),
      'total',          x.defense_total + x.attack_total,
      'defenseTotal',   x.defense_total,
      'attackTotal',    x.attack_total,
      'factionId',      u.faction_id,
      'factionColor',   f.color,
      'factionPattern', f.pattern
    ) ORDER BY (x.defense_total + x.attack_total) DESC), '[]'::jsonb)
    INTO v_top_patrons
    FROM top5 x
    JOIN public.users u ON u.id = x.user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id;

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
      WHERE pcs.place_id = p_place_id AND pcs.score > 0
      ORDER BY pcs.score DESC
      LIMIT 5
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
      WHERE em.user_id = p_user_id AND e.place_id = p_place_id;
    END IF;

    RETURN json_build_object(
      'vacant',         true,
      'veilleur',       NULL,
      'scoreVeilleur',  0,
      'threats',        v_threats,
      'menaceHaute',    NULL,
      'scoreToBeat',    0,
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
  -- CAS VEILLÉ
  -- ============================================================
  SELECT COALESCE(score, 0) INTO v_score_defense
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
  v_score_defense := COALESCE(v_score_defense, 0);

  v_score_veilleur := public._defender_effective_score(p_place_id);

  SELECT MAX(score) INTO v_menace_haute
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id != v_veilleur_exp;
  v_menace_haute := COALESCE(v_menace_haute, 0);

  IF v_score_veilleur <= 0 THEN
    v_status := CASE WHEN v_menace_haute > 0 THEN 'en_siege' ELSE 'paisible' END;
  ELSIF v_menace_haute = 0 OR v_menace_haute < (v_score_veilleur * 10 / 100) THEN
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

  -- V134/V135 : sides dynamiques selon expedition_id == veilleur courant.
  -- Couronnes investies sur expés mortes (perdantes wipe) → disparaissent.
  WITH agg AS (
    SELECT
      user_id,
      SUM(CASE
        WHEN expedition_id = v_veilleur_exp THEN amount ELSE 0
      END)::integer AS defense_total,
      SUM(CASE
        WHEN expedition_id != v_veilleur_exp
         AND expedition_id IN (
           SELECT expedition_id FROM public.place_court_score
           WHERE place_id = p_place_id
             AND expedition_id != v_veilleur_exp
             AND score > 0
         ) THEN amount ELSE 0
      END)::integer AS attack_total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY user_id
  ),
  top5 AS (
    SELECT * FROM agg
    WHERE defense_total + attack_total > 0
    ORDER BY (defense_total + attack_total) DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',         x.user_id,
    'displayName',    COALESCE(u.display_name, u.first_name, u.id),
    'total',          x.defense_total + x.attack_total,
    'defenseTotal',   x.defense_total,
    'attackTotal',    x.attack_total,
    'factionId',      u.faction_id,
    'factionColor',   f.color,
    'factionPattern', f.pattern
  ) ORDER BY (x.defense_total + x.attack_total) DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM top5 x
  JOIN public.users u ON u.id = x.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id;

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

  v_score_to_beat := CASE WHEN NOT v_is_member_v THEN v_score_veilleur ELSE NULL END;

  RETURN json_build_object(
    'vacant',         false,
    'veilleur',       v_veilleur_obj,
    'scoreVeilleur',  v_score_veilleur,
    'threats',        v_threats,
    'menaceHaute',    CASE WHEN v_is_member_v THEN v_menace_haute ELSE NULL END,
    'scoreToBeat',    v_score_to_beat,
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
  TO anon, authenticated, service_role;

COMMIT;
