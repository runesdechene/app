-- 206_defi_counts_from.sql
-- Fenêtre de comptage d'un défi : plancher optionnel `counts_from`.
--
-- Problème : la progression d'un défi hebdo se comptait depuis le début de la
-- semaine ISO (date_trunc('week', now())). Un défi mis en place en milieu de
-- semaine agrégeait donc des actions antérieures à son lancement.
--
-- Fix : colonne defis.counts_from (timestamptz, nullable). La fenêtre effective
-- devient GREATEST(début_de_fenêtre_cadence, counts_from). NULL = comportement
-- d'origine (aucun changement pour les défis sans date de mise en place).
-- Plancher, pas remplacement : la semaine suivante, counts_from étant dans le
-- passé, on repart naturellement du lundi.

ALTER TABLE public.defis ADD COLUMN IF NOT EXISTS counts_from timestamptz;

-- Fenêtre effective = max(fenêtre cadence, date de mise en place).
CREATE OR REPLACE FUNCTION public._defi_effective_ws(p_cadence text, p_counts_from timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT GREATEST(public._defi_window_start(p_cadence),
                  COALESCE(p_counts_from, '-infinity'::timestamptz));
$$;

-- ───────────────── get_defis_board : fenêtre effective ─────────────────
CREATE OR REPLACE FUNCTION public.get_defis_board(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    -- Visuels du tag (mig 193) : conservés ici, sinon le front retombe sur l'emoji.
    'tag', (SELECT json_build_object('icon', t.icon, 'color', t.color, 'background', t.background, 'title', t.title)
             FROM public.tags t WHERE t.id = tag_id)
  ) END) INTO v FROM picks;

  RETURN COALESCE(v, '{}'::json);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_defis_board(text) TO authenticated, service_role;

-- ───────────────── claim_defi : fenêtre effective ─────────────────
CREATE OR REPLACE FUNCTION public.claim_defi(p_defi_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  d public.defis;
  v_ws timestamptz; v_pk text; v_global int; v_mine int; v_rows int;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth_required'); END IF;
  SELECT * INTO d FROM public.defis WHERE id = p_defi_id AND active;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'defi_not_found'); END IF;

  v_ws := public._defi_effective_ws(d.cadence, d.counts_from);
  v_pk := public._defi_period_key(d.cadence);
  v_mine := public._defi_progress(d.action, d.tag_id, v_uid, false, v_ws);

  IF d.scope = 'collective' THEN
    v_global := public._defi_progress(d.action, d.tag_id, NULL, true, v_ws);
    IF v_global < d.threshold OR v_mine < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'not_eligible'); END IF;
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
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_defi(text) TO authenticated;

-- ───────────────── get_defi_participants : fenêtre effective ─────────────────
CREATE OR REPLACE FUNCTION public.get_defi_participants(p_defi_id text, p_limit int DEFAULT 12)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  d public.defis;
  v_ws timestamptz;
  v_total int;
  v_list json;
BEGIN
  SELECT * INTO d FROM public.defis WHERE id = p_defi_id;
  IF NOT FOUND THEN
    RETURN json_build_object('total', 0, 'participants', '[]'::json);
  END IF;
  v_ws := public._defi_effective_ws(d.cadence, d.counts_from);

  WITH src AS (
    SELECT pd.user_id AS u_id, pd.discovered_at AS ts
      FROM public.places_discovered pd
     WHERE d.action IN ('reveal','visit')
       AND pd.method = CASE d.action WHEN 'reveal' THEN 'remote' ELSE 'gps' END
       AND pd.discovered_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = d.tag_id))
    UNION ALL
    SELECT p.author_id, p.created_at
      FROM public.places p
     WHERE d.action = 'add'
       AND p.created_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = d.tag_id))
    UNION ALL
    SELECT pv.veilleur_user_id, pv.planted_at
      FROM public.place_veille pv
     WHERE d.action = 'veilleur'
       AND pv.by_influence = false AND pv.planted_at >= v_ws
       AND (d.tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = d.tag_id))
    UNION ALL
    SELECT e.user_id, e.responded_at
      FROM public.enigma_responses e
     WHERE d.action = 'enigma' AND e.responded_at >= v_ws
  ),
  agg AS (
    SELECT u_id, count(*) AS n, max(ts) AS last_at
      FROM src
     WHERE u_id IS NOT NULL
     GROUP BY u_id
  )
  SELECT
    (SELECT count(*) FROM agg),
    COALESCE((
      SELECT json_agg(json_build_object(
               'userId', t.u_id,
               'name',   u.first_name,
               'avatar', u.avatar_url,
               'count',  t.n,
               'lastAt', t.last_at
             ) ORDER BY t.last_at DESC, t.u_id)
        FROM (SELECT u_id, n, last_at FROM agg ORDER BY last_at DESC, u_id LIMIT p_limit) t
        JOIN public.users u ON u.id = t.u_id
    ), '[]'::json)
  INTO v_total, v_list;

  RETURN json_build_object('total', COALESCE(v_total, 0), 'participants', v_list);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_defi_participants(text, int) TO authenticated, service_role;
