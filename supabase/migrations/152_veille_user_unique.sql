-- 152_veille_user_unique.sql
-- WHY : refonte capitale (Uriel 9/05). Le système de veille passe de
-- "expédition contrôle un lieu" à "1 user = 1 mécène = 1 veilleur".
-- Cf feedback_modele_veille_user_unique.md — la spec 5/05 avait été falsifiée
-- par moi (XO) en mettant "expédition" partout alors que la règle d'Uriel
-- depuis le départ était "user-vs-user". Cette mig corrige le modèle.
--
-- IMPORTANT — pas de refonte UI. Le frontend continue à appeler la même
-- signature `invest_crowns(p_user_id, p_place_id, p_target_expedition_id,
-- p_amount)`. On interprète p_target_expedition_id pour déduire le bénéficiaire
-- user :
--   - Si la cible est l'expé du veilleur courant → le veilleur user est
--     crédité (renfort si caller=veilleur, soutien si caller=tiers).
--   - Sinon → le caller est crédité (challenge).
-- L'affichage du veilleur passe de "leader de l'expé" à "user au top score".
--
-- Mécanique :
-- - Score(user, lieu) = SUM(place_court_action.amount WHERE beneficiary_user_id=user)
-- - Veilleur du lieu = place_veille.veilleur_user_id (= top score user)
-- - Bascule par influence : beneficiary != veilleur courant ET son score
--   dépasse celui du veilleur → il devient veilleur immédiatement.
-- - plant_flag : wipe les scores des autres users sur ce lieu, le planteur
--   garde son propre score, +50 + 30/compagnon (max 10 → max +350). Le
--   planteur devient veilleur user.

BEGIN;

-- ============================================================
-- 1. Schéma — ajouts non-destructifs
-- ============================================================

-- expeditions : nom custom pour les groupes plantés ensemble (>1 membre).
-- Si NULL, on affiche le user solo. Si rempli, l'expedition est traitée
-- comme un GROUPE avec ce nom (cas plantage à plusieurs).
ALTER TABLE public.expeditions
  ADD COLUMN IF NOT EXISTS title text;

-- Backfill : pour les expeditions avec >1 membre, générer un title par
-- défaut basé sur le 1er membre (planteur). On le laisse NULL pour les
-- expeditions d'1 seul membre (= veilleur user solo).
UPDATE public.expeditions e
SET title = 'Expédition de ' || COALESCE(u.display_name, u.first_name, 'Quelqu''un')
FROM public.users u
WHERE e.title IS NULL
  AND u.id = (
    SELECT em.user_id FROM public.expedition_members em
    WHERE em.expedition_id = e.id
    ORDER BY em.user_id LIMIT 1
  )
  AND (SELECT COUNT(*) FROM public.expedition_members em WHERE em.expedition_id = e.id) > 1;

-- place_court_action : qui investit pour qui
ALTER TABLE public.place_court_action
  ADD COLUMN IF NOT EXISTS beneficiary_user_id text REFERENCES public.users(id) ON DELETE CASCADE;

-- Backfill : les actions historiques sont auto-investissements (le user a
-- investi pour lui-même via son expedition challenger ou pour son expedition
-- veilleuse — dans tous les cas, beneficiary par défaut = user_id).
UPDATE public.place_court_action
  SET beneficiary_user_id = user_id
  WHERE beneficiary_user_id IS NULL;

ALTER TABLE public.place_court_action
  ALTER COLUMN beneficiary_user_id SET NOT NULL;

-- side : on relâche la contrainte pour accepter 'plant_bonus'
ALTER TABLE public.place_court_action
  DROP CONSTRAINT IF EXISTS place_court_action_side_check;
ALTER TABLE public.place_court_action
  ADD CONSTRAINT place_court_action_side_check
  CHECK (side IN ('defense', 'attack', 'plant_bonus'));

-- Index pour le calcul de score user-centric
CREATE INDEX IF NOT EXISTS place_court_action_place_beneficiary_idx
  ON public.place_court_action (place_id, beneficiary_user_id);

-- place_veille : ajout veilleur_user_id (source de vérité user-centric)
ALTER TABLE public.place_veille
  ADD COLUMN IF NOT EXISTS veilleur_user_id text REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill : pour chaque lieu actuellement veillé, le veilleur user =
-- top user en Couronnes investies. À défaut (jamais d'invest), le 1er
-- membre de l'expédition (cohérent avec l'affichage "leader" actuel).
UPDATE public.place_veille pv
SET veilleur_user_id = COALESCE(
  (SELECT pca.beneficiary_user_id
   FROM public.place_court_action pca
   WHERE pca.place_id = pv.place_id
   GROUP BY pca.beneficiary_user_id
   HAVING SUM(pca.amount) > 0
   ORDER BY SUM(pca.amount) DESC, MIN(pca.created_at) ASC
   LIMIT 1),
  (SELECT em.user_id
   FROM public.expedition_members em
   WHERE em.expedition_id = pv.expedition_id
   ORDER BY em.user_id
   LIMIT 1)
);

-- ============================================================
-- 2. Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_place_score(p_user_id text, p_place_id text)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.place_court_action
  WHERE place_id = p_place_id AND beneficiary_user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public._top_user_for_place(p_place_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT beneficiary_user_id
  FROM public.place_court_action
  WHERE place_id = p_place_id
  GROUP BY beneficiary_user_id
  HAVING SUM(amount) > 0
  ORDER BY SUM(amount) DESC, MIN(created_at) ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public._user_place_score(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public._top_user_for_place(text) TO authenticated, anon, service_role;

-- ============================================================
-- 3. invest_crowns — ANCIENNE signature, NOUVELLE sémantique
-- ============================================================
-- Le frontend continue d'appeler invest_crowns(p_user_id, p_place_id,
-- p_target_expedition_id, p_amount). On déduit le bénéficiaire user :
--   - Si p_target_expedition_id == place_veille.expedition_id (= expé veilleuse)
--     → beneficiary = veilleur_user_id courant (renfort/soutien)
--   - Sinon → beneficiary = caller (challenge)
-- Le score de l'expé existante (place_court_score) reste maintenu pour
-- rétrocompat des composants/RPCs qui le lisent encore, mais la source de
-- vérité de l'affichage devient le score user-centric.

CREATE OR REPLACE FUNCTION public.invest_crowns(
  p_user_id              text,
  p_place_id             text,
  p_target_expedition_id uuid,
  p_amount               integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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

  -- Détermination camp + bénéficiaire
  v_target_is_veilleur := (NOT v_was_vacant AND p_target_expedition_id = v_current_veilleur_exp);

  IF v_target_is_veilleur THEN
    v_side := 'defense';
    v_beneficiary := v_current_veilleur_user;
  ELSE
    v_side := 'attack';
    v_beneficiary := p_user_id;
  END IF;

  -- Balance
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  UPDATE public.user_crowns
  SET balance = balance - p_amount, updated_at = v_now
  WHERE user_id = p_user_id;

  -- Action user-centric (avec beneficiary)
  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_place_id, p_user_id, p_target_expedition_id, v_beneficiary, v_side, p_amount);

  -- Maintien score legacy par expé (pour rétrocompat des helpers/notifs)
  INSERT INTO public.place_court_score (place_id, expedition_id, score, last_action_at)
  VALUES (p_place_id, p_target_expedition_id, p_amount, v_now)
  ON CONFLICT (place_id, expedition_id) DO UPDATE SET
    score          = place_court_score.score + EXCLUDED.score,
    last_action_at = EXCLUDED.last_action_at;

  -- Score user du bénéficiaire
  v_new_score := public._user_place_score(v_beneficiary, p_place_id);

  -- Bascule si bénéficiaire ≠ veilleur courant ET dépasse le score du veilleur
  IF v_beneficiary IS DISTINCT FROM v_current_veilleur_user THEN
    v_old_veilleur_score := COALESCE(public._user_place_score(v_current_veilleur_user, p_place_id), 0);
    IF v_current_veilleur_user IS NULL OR v_new_score > v_old_veilleur_score THEN
      -- Bascule : le bénéficiaire devient veilleur user
      -- L'expedition cible (challenger) devient l'expé veilleuse (legacy)
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

  -- ============================================================
  -- Notifications (alignées avec mig 150 — sémantique préservée)
  -- ============================================================
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
        'actorName',    v_actor_name,
        'expeditionId', p_target_expedition_id
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_attack', p_user_id, p_place_id, v_notif_data);
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
      PERFORM public._notify_court_members(v_current_veilleur_exp, 'place_court_high_threat', v_notif_data, p_user_id);
    END IF;
  END IF;

  -- Mécène principal (notif si le bénéficiaire devient #1)
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
  ) AND v_beneficiary = p_user_id  -- on ne notifie le mécène principal que si c'est l'investisseur lui-même
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
$$;

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer)
  TO authenticated, service_role;

-- ============================================================
-- 4. get_place_court_state — affichage user-centric
-- ============================================================
-- Le `veilleur` retourné est désormais le user au top score (= veilleur_user_id),
-- présenté avec les mêmes champs que l'ancienne forme expé pour préserver le
-- frontend (expeditionId = place_veille.expedition_id = legacy, leaderUserId =
-- veilleur user, leaderName = display_name veilleur user, etc.).
-- topPatrons : score user agrégé (SUM par beneficiary_user_id), avec
-- defenseTotal/attackTotal mappés de manière à préserver le visuel de
-- CourtTensionBar (cluster gauche = veilleur, cluster droite = challengers).

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

  -- Faveur : 50 + 30*(extra members capés) si non by_influence et veilleur user a planté.
  -- Comme on n'a plus de logique by_influence pure côté user, on conserve la helper
  -- existante pour préserver l'affichage de la barre dorée.
  v_favor_points := COALESCE(public._defender_favor_only(p_place_id), 0);

  -- topPatrons (top 5 par score user)
  WITH agg AS (
    SELECT beneficiary_user_id AS user_id, SUM(amount)::integer AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY beneficiary_user_id
    HAVING SUM(amount) > 0
  ),
  top5 AS (
    SELECT * FROM agg ORDER BY total DESC LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',         t.user_id,
    'displayName',    COALESCE(u.display_name, u.first_name, u.id),
    'avatarUrl',      u.avatar_url,
    'total',          t.total,
    -- Mapping defense/attack pour CourtTensionBar :
    -- veilleur courant → defense ; autres → attack.
    'defenseTotal',   CASE WHEN t.user_id = v_veilleur_user THEN t.total ELSE 0 END,
    'attackTotal',    CASE WHEN t.user_id = v_veilleur_user THEN 0 ELSE t.total END,
    'factionId',      u.faction_id,
    'factionColor',   f.color,
    'factionPattern', f.pattern
  ) ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM top5 t
  JOIN public.users u ON u.id = t.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id;

  -- Plus grosse menace = top score parmi non-veilleurs
  SELECT COALESCE(MAX(total), 0) INTO v_threat_score
  FROM (
    SELECT SUM(amount) AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
      AND (v_veilleur_user IS NULL OR beneficiary_user_id IS DISTINCT FROM v_veilleur_user)
    GROUP BY beneficiary_user_id
  ) sub;

  -- Statut
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

  -- Veilleur obj (forme préservée pour le frontend).
  -- Si l'expedition veilleuse a >1 membre ET un title custom → affichage
  -- "groupe" : leaderName = title du groupe. Sinon → user-centric : leaderName
  -- = displayname du veilleur user.
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

  -- Chronique (10 dernières actions, forme préservée)
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

  -- threats (forme legacy par expé, conservée pour rétrocompat — peut afficher
  -- des expés sans veilleur user dominant si le score expé est élevé sans
  -- qu'un user user-centric ne mène)
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

  -- callerContext
  v_is_member_v := (NOT v_vacant AND p_user_id = v_veilleur_user);

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  v_user_total := COALESCE(public._user_place_score(p_user_id, p_place_id), 0);

  -- Challenger expeditions (legacy, lu par PlaceCourtView pour la modale "Influencer")
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

-- ============================================================
-- 5. plant_flag — wipe scores autres users + bonus planteur
-- ============================================================
-- Reprise verbatim mig 136 (cas A/B/C/D), avec à chaque cas (V152) :
--   1. UPDATE place_veille SET veilleur_user_id = p_user_id
--   2. DELETE FROM place_court_action WHERE place_id=X AND beneficiary != p_user_id
--   3. INSERT bonus planteur (amount = 50 + 30*min(nb_compagnons, 10))
--
-- Le frontend appelle plant_flag avec la même signature, aucun changement UI.

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
  v_prev_veilleur_exp   uuid;
  v_prev_by_influence   boolean;
  v_prev_previous_exp   uuid;
  v_threats_cleared     int;
  v_notif_data          jsonb;
  -- V152
  v_solo_bonus          integer;
  v_per_extra           integer;
  v_max_companions      integer;
  v_companions_count    integer;
  v_plant_bonus_amount  integer;
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
  INTO v_prev_veilleur_exp, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- V152 : calcul du bonus planteur (commun à tous les cas)
  v_solo_bonus     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),            50);
  v_per_extra      := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'),      30);
  v_max_companions := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_companions_count := LEAST(
    COALESCE(array_length(p_partners_user_ids, 1), 0),
    v_max_companions
  );
  v_plant_bonus_amount := v_solo_bonus + v_per_extra * v_companions_count;

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
        veilleur_user_id       = p_user_id,
        faction_id             = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral             = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
    WHERE place_id = p_place_id;

    -- V152 : wipe + bonus planteur
    DELETE FROM public.place_court_action
    WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_previous_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    -- legacy
    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur_exp,
      'reclaimedBy',  v_prev_previous_exp
    );

    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_back_gps', p_user_id, p_place_id, v_notif_data);

    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', v_notif_data, p_user_id);

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
      'plantedAt',    v_now,
      'plantBonus',   v_plant_bonus_amount
    );
  END IF;

  -- ============================================================
  -- CAS B — Confirmation IRL par membre de l'expé "par influence"
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now,
        veilleur_user_id       = p_user_id
    WHERE place_id = p_place_id;

    -- V152 : wipe + bonus
    DELETE FROM public.place_court_action
    WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_veilleur_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    -- legacy : préserve la défense de l'expé veilleuse (mig 136 logique)
    DELETE FROM public.place_court_score
    WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object(
      'success',      true,
      'mode',         'confirm_gps',
      'placeId',      p_place_id,
      'expeditionId', v_prev_veilleur_exp,
      'members',      v_members_json,
      'plantedAt',    v_now,
      'plantBonus',   v_plant_bonus_amount
    );
  END IF;

  -- ============================================================
  -- CAS D — Réaffirmation IRL par plein-veilleur
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET planted_at       = v_now,
        veilleur_user_id = p_user_id
    WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur_exp
    );
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur_exp, 'place_reaffirmed', v_notif_data, p_user_id);

    -- V152 : wipe + bonus
    DELETE FROM public.place_court_action
    WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_veilleur_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    -- legacy
    DELETE FROM public.place_court_score
    WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;
    GET DIAGNOSTICS v_threats_cleared = ROW_COUNT;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur_exp, p_user_id, v_user_faction, false, v_now);

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
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object(
      'success',         true,
      'mode',            'reaffirm_gps',
      'placeId',         p_place_id,
      'expeditionId',    v_prev_veilleur_exp,
      'members',         v_members_json,
      'plantedAt',       v_now,
      'threatsCleared',  v_threats_cleared,
      'plantBonus',      v_plant_bonus_amount
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

  -- V152 : si compagnons, on génère un title (= nom du groupe veilleur).
  -- Affichage côté get_place_court_state : si l'expé a >1 membre + title,
  -- veilleur affiché = nom du groupe au lieu du planteur seul.
  DECLARE
    v_planter_name text;
    v_title        text;
  BEGIN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_planter_name
    FROM public.users WHERE id = p_user_id;
    v_title := CASE
      WHEN COALESCE(array_length(p_partners_user_ids, 1), 0) > 0
        THEN 'Expédition de ' || v_planter_name
      ELSE NULL
    END;

    INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
    VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_title, v_now)
    RETURNING id INTO v_expedition_id;
  END;

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

  IF v_prev_veilleur_exp IS NOT NULL AND v_prev_veilleur_exp != v_expedition_id THEN
    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', jsonb_build_object(
      'placeId',      p_place_id,
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur_exp,
      'reclaimedBy',  v_expedition_id,
      'plantedByUser', p_user_id
    ), p_user_id);
  END IF;

  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now, false, NULL, p_user_id)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id          = EXCLUDED.expedition_id,
    faction_id             = EXCLUDED.faction_id,
    is_neutral             = EXCLUDED.is_neutral,
    planted_at             = EXCLUDED.planted_at,
    by_influence           = false,
    previous_expedition_id = NULL,
    veilleur_user_id       = EXCLUDED.veilleur_user_id;

  -- V152 : wipe + bonus
  DELETE FROM public.place_court_action
  WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_place_id, p_user_id, v_expedition_id, p_user_id, 'plant_bonus', v_plant_bonus_amount);

  -- legacy
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
    'plantedAt',    v_now,
    'plantBonus',   v_plant_bonus_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[])
  TO authenticated, service_role;

COMMIT;
