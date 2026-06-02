-- 193_defis_board_tag_visuals.sql
-- get_defis_board renvoie en plus, pour chaque défi, les visuels du tag de lieu
-- (icon SVG / color / background / title) afin que le front affiche la vraie pastille
-- de tag (fond couleur + icône blanche, comme la carte) au lieu d'un emoji générique.
-- Additif : ajoute le champ 'tag' (null si pas de tag, ex. énigme). Reste inchangé.

CREATE OR REPLACE FUNCTION public.get_defis_board(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid text := auth.uid()::text; v json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> v_uid THEN RETURN '{}'::json; END IF;
  WITH picks AS (
    SELECT 'daily'::text k, (public._pick_defi('daily','individual')).*
    UNION ALL SELECT 'weeklyIndividual', (public._pick_defi('weekly','individual')).*
    UNION ALL SELECT 'weeklyCollective', (public._pick_defi('weekly','collective')).*
  )
  SELECT json_object_agg(k, CASE WHEN id IS NULL THEN NULL ELSE json_build_object(
    'id', id, 'action', action, 'scope', scope, 'cadence', cadence,
    'title', wording, 'icon', icon, 'tagId', tag_id, 'target', threshold, 'reward', reward_couronnes,
    'progress', LEAST(public._defi_progress(action, tag_id, v_uid, (scope='collective'), public._defi_window_start(cadence)), threshold),
    'myContribution', public._defi_progress(action, tag_id, v_uid, false, public._defi_window_start(cadence)),
    'claimed', EXISTS (SELECT 1 FROM public.defi_claims dc WHERE dc.user_id = v_uid AND dc.defi_id = id AND dc.period_key = public._defi_period_key(cadence)),
    'tag', (SELECT json_build_object('icon', t.icon, 'color', t.color, 'background', t.background, 'title', t.title)
             FROM public.tags t WHERE t.id = tag_id)
  ) END) INTO v FROM picks;
  RETURN COALESCE(v, '{}'::json);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_defis_board(text) TO authenticated, service_role;
