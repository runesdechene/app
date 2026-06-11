-- 232_defis_board_ends_at.sql
-- WHY : afficher la date limite d'un défi (compte à rebours « Plus que N jours »)
-- sur les défis hebdomadaires. Le board ne renvoyait aucune fin de fenêtre — le
-- front ne pouvait donc pas la calculer sans réimplémenter (et deviner le fuseau
-- serveur de) la logique _defi_window_start. On expose `endsAt` directement.
--
-- Fin de fenêtre = début de fenêtre + durée de cadence :
--   weekly → début (lundi 00 h, date_trunc('week', now())) + 7 jours
--   daily  → début (current_date) + 1 jour
-- (le front n'affiche le compte à rebours que pour les défis weekly, mais on
--  renvoie endsAt pour les deux cadences par cohérence.)
--
-- Source : def LIVE de get_defis_board (pg_get_functiondef). Seul ajout : la clé
-- 'endsAt' dans le json_build_object. Tout le reste est identique au live.
-- Réversible : retirer la clé 'endsAt'.

CREATE OR REPLACE FUNCTION public.get_defis_board(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    'tag', (SELECT json_build_object('icon', t.icon, 'color', t.color, 'background', t.background, 'title', t.title)
             FROM public.tags t WHERE t.id = tag_id)
  ) END) INTO v FROM picks;

  RETURN COALESCE(v, '{}'::json);
END; $function$;
