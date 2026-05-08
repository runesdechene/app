-- 136_plant_flag_preserve_defense_and_court_state_favor.sql
-- WHY : 2 changements liés autour du Cour (Uriel 8/05) :
--
--   1) FIX game-design "veilleur par influence qui confirme IRL".
--      Aujourd'hui dans plant_flag cas B (le veilleur par influence va sur
--      place et plante), DELETE FROM place_court_score WHERE place_id = X
--      wipe AUSSI sa propre défense investie. Punit le mécène qui a payé pour
--      reprendre. Décision Uriel : préserver la défense en confirmant IRL,
--      symétrique au fix mig 133 (bascule par influence).
--
--   2) Ajouter defenseFavorPoints à get_place_court_state pour que la
--      CourtTensionBar puisse afficher la frontière "faveur du plantage IRL"
--      en doré, vs "défense investie" en couleur normale. Utilise le helper
--      _defender_effective_score - invest_pur pour calculer la part bonus.
--      Plus précisément : retourne le bonus pur (50 + 30×(extra members capé))
--      quand plant_flag plein, 0 sinon.
--
-- Reprise B1 verbatim de plant_flag (mig 117 ou plus récente — verbatim courant).
-- Reprise B1 verbatim de get_place_court_state (mig 135). Modifs ciblées.

BEGIN;

-- ============================================================
-- Helper : faveur défensive (bonus pur sans invest réel)
-- ============================================================
-- Retourne uniquement le bonus IRL (50 + 30×extra membres capé), 0 si by_influence.
-- Permet à get_place_court_state de séparer "faveur IRL" vs "défense investie".
CREATE OR REPLACE FUNCTION public._defender_favor_only(p_place_id text)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_exp_id        uuid;
  v_by_influence  boolean;
  v_members       integer;
  v_solo          integer;
  v_per_extra     integer;
  v_max_for_bonus integer;
  v_extra         integer;
BEGIN
  SELECT pv.expedition_id, COALESCE(pv.by_influence, false)
  INTO v_exp_id, v_by_influence
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_exp_id IS NULL OR v_by_influence THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer INTO v_members
  FROM public.expedition_members em
  WHERE em.expedition_id = v_exp_id;
  v_members := GREATEST(COALESCE(v_members, 1), 1);

  v_solo          := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),            50);
  v_per_extra     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'),      30);
  v_max_for_bonus := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_extra := LEAST(v_members, v_max_for_bonus) - 1;
  IF v_extra < 0 THEN v_extra := 0; END IF;

  RETURN v_solo + v_per_extra * v_extra;
END;
$$;

GRANT EXECUTE ON FUNCTION public._defender_favor_only(text) TO authenticated, service_role;

-- ============================================================
-- plant_flag — fix cas B (veilleur par influence confirme IRL)
-- Reprend le code courant. Seul change : le DELETE du cas B préserve la
-- ligne place_court_score du veilleur par influence devenu plein.
-- ============================================================
CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id              text,
  p_place_id             text,
  p_user_lat             numeric,
  p_user_lng             numeric,
  p_partners_user_ids    text[] DEFAULT '{}'::text[]
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
  -- V136 : préserve la défense investie du veilleur par influence (DELETE
  -- exclut sa ligne) — symétrique au fix bascule mig 133.
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

    -- V136 : on garde la ligne du veilleur (sa défense investie reste).
    DELETE FROM public.place_court_score
    WHERE place_id = p_place_id
      AND expedition_id != v_prev_veilleur;

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

    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur
    );
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur, 'place_reaffirmed', v_notif_data, p_user_id);

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

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[])
  TO authenticated, service_role;

-- ============================================================
-- get_place_court_state — ajout defenseFavorPoints + defenseInvestedPoints
-- au callerContext et au top niveau pour la CourtTensionBar.
-- Reprise verbatim mig 135. Seul change : 4 nouveaux champs au RETURN.
-- ============================================================
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
  v_favor_points     integer;
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
      'vacant',               true,
      'veilleur',             NULL,
      'scoreVeilleur',        0,
      'defenseFavorPoints',   0,
      'defenseInvested',      0,
      'threats',              v_threats,
      'menaceHaute',          NULL,
      'scoreToBeat',          0,
      'topPatrons',           v_top_patrons,
      'chronicle',            v_chronicle,
      'status',               'vacant',
      'callerContext',        CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
        'balance',                v_balance,
        'isMemberOfVeilleur',     false,
        'challengerExpeditions',  v_challenger_exps,
        'userTotalOnPlace',       v_user_total
      ) END
    );
  END IF;

  -- CAS VEILLÉ
  SELECT COALESCE(score, 0) INTO v_score_defense
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
  v_score_defense := COALESCE(v_score_defense, 0);

  v_score_veilleur := public._defender_effective_score(p_place_id);
  v_favor_points   := public._defender_favor_only(p_place_id);

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
      'vacant',               false,
      'veilleur',             v_veilleur_obj,
      'scoreVeilleur',        v_score_veilleur,
      'defenseFavorPoints',   v_favor_points,
      'defenseInvested',      v_score_defense,
      'threats',              v_threats,
      'menaceHaute',          NULL,
      'scoreToBeat',          NULL,
      'topPatrons',           v_top_patrons,
      'chronicle',            v_chronicle,
      'status',               v_status,
      'callerContext',        NULL
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
    'vacant',               false,
    'veilleur',             v_veilleur_obj,
    'scoreVeilleur',        v_score_veilleur,
    'defenseFavorPoints',   v_favor_points,
    'defenseInvested',      v_score_defense,
    'threats',              v_threats,
    'menaceHaute',          CASE WHEN v_is_member_v THEN v_menace_haute ELSE NULL END,
    'scoreToBeat',          v_score_to_beat,
    'topPatrons',           v_top_patrons,
    'chronicle',            v_chronicle,
    'status',               v_status,
    'callerContext',        jsonb_build_object(
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
