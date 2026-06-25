-- 303_defi_collectif_ferme_a_accomplissement.sql
-- WHY : bug grave signalé par Uriel (25/06) — un défi COLLECTIF restait réclamable
-- tant que la semaine ISO courait, même longtemps après que l'objectif était atteint.
-- Constat prod : « La communauté recense 15 monuments » accompli le 22/06 13h00 (15e
-- monument), mais 65/15 trois jours plus tard, et 10 joueurs sur 20 ont touché la
-- récompense en participant APRÈS l'accomplissement. Le « terminé » affiché était
-- purement cosmétique : le serveur ne fermait jamais le défi à l'objectif, seulement
-- à la bascule de semaine.
--
-- DÉCISION (Uriel) : un défi collectif se FERME à l'instant où l'objectif est atteint.
-- Seuls les joueurs ayant contribué AVANT cet instant (= ceux qui ont aidé à le gagner)
-- gardent le droit à la récompense. Les retardataires : rien (erreur 'too_late').
--
-- Implémentation, 100% calcul-à-la-lecture (aucun trigger, cf. incident 058) :
--   - _defi_events(action, tag, ws)      : ensemble des contributions COLLECTIVES
--       (uid, ts) sur la fenêtre. Reproduit EXACTEMENT le périmètre du _defi_progress
--       collectif LIVE (incl. visit = place_explorers ∪ places_discovered gps, dédup
--       (user, place)). Vérifié sur prod : count identiques (reveal 65=65, visit 4=4).
--   - _defi_completed_at(action, tag, ws, threshold) : timestamp de la threshold-ième
--       contribution dans l'ordre chronologique = instant d'accomplissement (NULL si
--       l'objectif n'est pas encore atteint).
--   - claim_defi : branche collective ré-écrite — refuse si non atteint ('not_eligible')
--       ou si la 1re contribution du joueur est postérieure à l'accomplissement ('too_late').
--   - get_defis_board : expose 'completedAt' + 'myFirstContribAt' (collectif uniquement)
--       pour que le front montre « accompli » et n'auto-claim plus les retardataires.
--
-- Bases LIVE (pg_get_functiondef) : claim_defi (mig 206 + inchangé) et get_defis_board
-- (mig 232). Deltas appliqués uniquement sur la branche collective / les 2 clés JSON.
-- ADDITIF, réversible. N'altère AUCUN défi individuel ni le calcul de _defi_progress.

-- ───────────────── Helper : ensemble des contributions collectives (uid, ts) ─────────────────
-- Périmètre calqué sur _defi_progress(..., p_collective=true, ...) LIVE.
CREATE OR REPLACE FUNCTION public._defi_events(p_action text, p_tag_id text, p_ws timestamptz)
RETURNS TABLE(uid text, ts timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  -- enigma : toute bonne ou mauvaise tentative depuis ws (comme _defi_progress)
  SELECT e.user_id, e.responded_at
    FROM public.enigma_responses e
   WHERE p_action = 'enigma' AND e.responded_at >= p_ws
  UNION ALL
  -- reveal : découverte à distance (remote)
  SELECT pd.user_id, pd.discovered_at
    FROM public.places_discovered pd
   WHERE p_action = 'reveal' AND pd.method = 'remote' AND pd.discovered_at >= p_ws
     AND (p_tag_id IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id))
  UNION ALL
  -- add : création de lieu
  SELECT p.author_id, p.created_at
    FROM public.places p
   WHERE p_action = 'add' AND p.created_at >= p_ws
     AND (p_tag_id IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id))
  UNION ALL
  -- veilleur : plantage d'étendard GPS (hors influence)
  SELECT pv.veilleur_user_id, pv.planted_at
    FROM public.place_veille pv
   WHERE p_action = 'veilleur' AND pv.by_influence = false AND pv.planted_at >= p_ws
     AND (p_tag_id IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = p_tag_id))
  UNION ALL
  -- visit : sur place (GPS) — double source dédupliquée par (user, place), 1 event = ts le plus tôt
  SELECT v.user_id, min(v.ts)
    FROM (
      SELECT pe.user_id, pe.place_id, pe.visited_at AS ts
        FROM public.place_explorers pe
       WHERE p_action = 'visit' AND pe.visited_at >= p_ws
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pe.place_id AND pt.tag_id = p_tag_id))
      UNION ALL
      SELECT pd.user_id, pd.place_id, pd.discovered_at
        FROM public.places_discovered pd
       WHERE p_action = 'visit' AND pd.method = 'gps' AND pd.discovered_at >= p_ws
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id))
    ) v
   GROUP BY v.user_id, v.place_id;
$$;

-- ───────────────── Helper : instant d'accomplissement (threshold-ième contribution) ─────────────────
CREATE OR REPLACE FUNCTION public._defi_completed_at(p_action text, p_tag_id text, p_ws timestamptz, p_threshold int)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT q.ts FROM (
    SELECT e.ts, row_number() OVER (ORDER BY e.ts) AS rn
    FROM public._defi_events(p_action, p_tag_id, p_ws) e
  ) q WHERE q.rn = p_threshold;
$$;

-- ───────────────── claim_defi : la branche collective ferme à l'accomplissement ─────────────────
CREATE OR REPLACE FUNCTION public.claim_defi(p_defi_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text := auth.uid()::text;
  d public.defis;
  v_ws timestamptz; v_pk text; v_mine int; v_rows int;
  v_completed_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth_required'); END IF;
  SELECT * INTO d FROM public.defis WHERE id = p_defi_id AND active;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'defi_not_found'); END IF;

  v_ws := public._defi_effective_ws(d.cadence, d.counts_from);
  v_pk := public._defi_period_key(d.cadence);
  v_mine := public._defi_progress(d.action, d.tag_id, v_uid, false, v_ws);

  IF d.scope = 'collective' THEN
    -- Objectif communautaire atteint ? sinon rien à réclamer.
    v_completed_at := public._defi_completed_at(d.action, d.tag_id, v_ws, d.threshold);
    IF v_completed_at IS NULL THEN
      RETURN json_build_object('ok', false, 'error', 'not_eligible'); END IF;
    -- Le joueur a-t-il contribué AVANT l'accomplissement ? sinon défi fermé pour lui.
    IF NOT EXISTS (
      SELECT 1 FROM public._defi_events(d.action, d.tag_id, v_ws) e
       WHERE e.uid = v_uid AND e.ts <= v_completed_at
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'too_late'); END IF;
  ELSE
    IF v_mine < d.threshold THEN
      RETURN json_build_object('ok', false, 'error', 'not_complete'); END IF;
  END IF;

  INSERT INTO public.defi_claims (user_id, defi_id, period_key, reward_couronnes)
    VALUES (v_uid, d.id, v_pk, d.reward_couronnes) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN json_build_object('ok', true, 'alreadyClaimed', true); END IF;

  IF d.reward_couronnes > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_uid, LEAST(500, d.reward_couronnes), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + d.reward_couronnes), updated_at = now();
  END IF;

  RETURN json_build_object('ok', true, 'alreadyClaimed', false,
    'icon', d.icon, 'title', d.wording,
    'reward', json_build_object('crowns', d.reward_couronnes));
END; $function$;
GRANT EXECUTE ON FUNCTION public.claim_defi(text) TO authenticated;

-- ───────────────── get_defis_board : expose completedAt + myFirstContribAt (collectif) ─────────────────
CREATE OR REPLACE FUNCTION public.get_defis_board(p_user_id text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text := auth.uid()::text;
  v json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> v_uid THEN RETURN '{}'::json; END IF;

  WITH picks AS (
    SELECT 'daily'::text k, (public._pick_defi('daily','individual')).*
    UNION ALL SELECT 'weeklyIndividual', (public._pick_defi('weekly','individual')).*
    UNION ALL SELECT 'weeklyCollective', (public._pick_defi('weekly','collective')).*
  )
  SELECT json_object_agg(k, CASE WHEN id IS NULL THEN NULL ELSE json_build_object(
    'id', id, 'action', action, 'scope', scope, 'cadence', cadence,
    'title', wording, 'icon', icon, 'tagId', tag_id,
    'target', threshold,
    'reward', reward_couronnes,
    'progress', LEAST(public._defi_progress(action, tag_id, v_uid, (scope='collective'),
                        public._defi_effective_ws(cadence, counts_from)), threshold),
    'myContribution', public._defi_progress(action, tag_id, v_uid, false,
                        public._defi_effective_ws(cadence, counts_from)),
    'claimed', EXISTS (SELECT 1 FROM public.defi_claims dc
                        WHERE dc.user_id = v_uid AND dc.defi_id = id
                          AND dc.period_key = public._defi_period_key(cadence)),
    'endsAt', (public._defi_window_start(cadence)
                + CASE WHEN cadence = 'weekly' THEN interval '7 days' ELSE interval '1 day' END),
    -- Instant où l'objectif collectif a été atteint (NULL si pas encore / non collectif).
    'completedAt', CASE WHEN scope = 'collective'
                     THEN public._defi_completed_at(action, tag_id,
                            public._defi_effective_ws(cadence, counts_from), threshold)
                     ELSE NULL END,
    -- 1re contribution du joueur sur la fenêtre (collectif) — sert à juger « à temps » côté front.
    'myFirstContribAt', CASE WHEN scope = 'collective'
                     THEN (SELECT min(e.ts) FROM public._defi_events(action, tag_id,
                            public._defi_effective_ws(cadence, counts_from)) e WHERE e.uid = v_uid)
                     ELSE NULL END,
    'tag', (SELECT json_build_object('icon', t.icon, 'color', t.color, 'background', t.background, 'title', t.title)
             FROM public.tags t WHERE t.id = tag_id)
  ) END) INTO v FROM picks;

  RETURN COALESCE(v, '{}'::json);
END; $function$;
GRANT EXECUTE ON FUNCTION public.get_defis_board(text) TO authenticated, service_role;
