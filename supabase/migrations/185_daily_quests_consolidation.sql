-- 185_daily_quests_consolidation.sql
-- Consolide get_today_quests_state sur le moteur quest_templates (mig 056) avec
-- sélection déterministe par date (mêmes défis pour tous le même jour) + progression réelle.

CREATE OR REPLACE FUNCTION public.get_today_quests_state(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
  v_pick_count int := 4;
  v_seed bigint;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN RETURN '[]'::json; END IF;
  v_date := public._user_date_local(p_user_id);
  v_seed := ('x' || md5(v_date::text))::bit(32)::bigint;

  RETURN (
    WITH picked AS (
      SELECT qt.*
      FROM public.quest_templates qt
      WHERE qt.type = 'daily' AND qt.active
      ORDER BY ((qt.display_order * 2654435761) # v_seed)
      LIMIT v_pick_count
    )
    SELECT COALESCE(json_agg(json_build_object(
      'id',          p.id,
      'type',        'daily',
      'title',       p.wording,
      'description', p.wording,
      'icon',        p.icon,
      'progress',    LEAST(COALESCE(up.count,0), p.threshold),
      'target',      p.threshold,
      'reward',      json_build_object(
                       'type', CASE WHEN p.reward_couronnes > 0 THEN 'crowns' ELSE 'xp' END,
                       'amount', CASE WHEN p.reward_couronnes > 0 THEN p.reward_couronnes ELSE p.reward_xp END),
      'completedAt', up.completed_at
    ) ORDER BY p.display_order), '[]'::json)
    FROM picked p
    LEFT JOIN public.user_quest_progress up
      ON up.quest_template_id = p.id AND up.user_id = p_user_id AND up.date_local = v_date
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_today_quests_state(text) TO authenticated, service_role;
