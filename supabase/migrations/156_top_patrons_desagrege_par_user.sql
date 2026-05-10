-- 156_top_patrons_desagrege_par_user.sql
-- WHY : la mig 152 agrégeait topPatrons par beneficiary_user_id, ce qui
-- fondait les soutiens externes dans le score du mécène (cf. bug La Pierre
-- Folle 10/05 — Uriel a soutenu Gautier mais n'apparaît nulle part dans la
-- liste des contributeurs). Le game design figé veut que les défenseurs
-- groupent (cumulent leurs points sur le mécène) MAIS soient visibles
-- individuellement dans l'UI — c'est ce qui fait la stratégie ("on voit qui
-- défend, qui attaque").
--
-- Cette mig désagrège topPatrons par user_id :
--   - defenseTotal = SUM(amount) où beneficiary = veilleur courant ET user = ce user
--   - attackTotal  = SUM(amount) où beneficiary != veilleur ET user = ce user
-- Le score total du veilleur (scoreVeilleur) reste calculé via
-- _user_place_score(veilleur, place) — agrégation côté beneficiary inchangée.
--
-- Cohérence côté frontend :
-- - CourtTensionBar (cluster avatars) : marche déjà via filter
--   defenseTotal>0 / attackTotal>0 — les soutiens externes apparaîtront en
--   défense additionnelle, le veilleur reste leader via la promotion
--   explicite (defenders[0] = leader veilleur).
-- - PatronsList : refonte UI nécessaire (bloc Mécène + sous-liste Soutiens
--   + bloc Challengers) — fait dans le commit frontend associé.

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

COMMIT;
