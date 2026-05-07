-- 125_daily_quests_state.sql
-- WHY : panneau "Tableau de Quêtes" (QuestsBoardPanel) doit afficher l'avancement
-- des quêtes du jour, à commencer par la mini-quête "Découvre 3 lieux à distance"
-- introduite par les mig 123/124. Architecture pensée multi-quêtes : la RPC
-- retourne un array, on n'en a qu'une aujourd'hui mais on en ajoutera d'autres
-- (énigme du jour, lieu à visiter, etc.) sans changer le contrat front.
--
-- Ne touche à aucune table. Pas de mutation. SELECT only. STABLE.
--
-- Format retourné : array json de quêtes
--   {
--     id, type, title, description, icon,
--     progress (clampé à target), target,
--     reward: { type, amount },
--     completedAt: ISO timestamp ou null
--   }

BEGIN;

CREATE OR REPLACE FUNCTION public.get_today_quests_state(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_progress      integer;
  v_target        integer;
  v_reward        integer;
  v_completed_at  timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN '[]'::json;
  END IF;

  -- ─── Quête : Découvre 3 lieux à distance ───
  v_target := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_threshold'), 3);
  v_reward := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_bonus'),     1);

  SELECT count(*)::integer INTO v_progress
  FROM public.places_discovered
  WHERE user_id = p_user_id
    AND method = 'remote'
    AND discovered_at::date = current_date;

  SELECT created_at INTO v_completed_at
  FROM public.activity_log
  WHERE actor_id = p_user_id
    AND type = 'crown_quest_discovery'
    AND created_at::date = current_date
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN json_build_array(
    json_build_object(
      'id',          'daily_discovery_remote',
      'type',        'daily_discovery',
      'title',       'Découvre 3 lieux à distance',
      'description', 'Dépense ton énergie pour révéler de nouveaux lieux sur la carte. Atteins le seuil de 3 découvertes dans la journée pour gagner un bonus.',
      'icon',        '🎯',
      'progress',    LEAST(v_progress, v_target),
      'target',      v_target,
      'reward',      json_build_object('type', 'crowns', 'amount', v_reward),
      'completedAt', v_completed_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_quests_state(text) TO authenticated, service_role;

COMMIT;
