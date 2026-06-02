-- 189_daily_quests_compute_on_read.sql
-- FIX : les Défis du jour restaient à 0. Cause racine : les triggers d'auto-tracking
-- (mig 056) ont été DROP en urgence par la mig 058 (ils rollback-aient harvest/discover)
-- et jamais restaurés → user_quest_progress est mort (0 ligne depuis mai). La mig 185 avait
-- (à tort) rebranché le panneau dessus.
--
-- Solution : calcul À LA LECTURE depuis les tables sources (comme l'ancienne quête
-- "découvre 3 lieux" mig 125 qui, elle, marchait). AUCUN trigger, zéro risque sur les
-- chemins chauds moisson/découverte. Mapping par tracker_kind.
--
-- Les quêtes 'social_action' sont désactivées : la table source (note_reactions) n'existe
-- plus, on ne peut pas les tracker honnêtement. À ré-activer le jour où une source fiable existe.
--
-- Note : la récompense de complétion (XP/Couronnes) des dailies moisson/énigme n'est PAS
-- recréditée ici (elle ne l'était plus depuis 058 de toute façon). La quête découverte garde
-- sa Couronne via le système dédié mig 123/124 (indépendant de cette RPC).

-- 1. Désactiver les quêtes intrackables (social)
UPDATE public.quest_templates
   SET active = false
 WHERE type = 'daily' AND tracker_kind = 'social_action';

-- 2. get_today_quests_state : calcul à la lecture
CREATE OR REPLACE FUNCTION public.get_today_quests_state(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_seed bigint;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN RETURN '[]'::json; END IF;
  v_seed := ('x' || md5(current_date::text))::bit(32)::bigint;

  RETURN (
    WITH picked AS (
      SELECT qt.*
      FROM public.quest_templates qt
      WHERE qt.type = 'daily' AND qt.active
      ORDER BY ((qt.display_order * 2654435761) # v_seed)
      LIMIT 4
    ), withprog AS (
      SELECT p.*,
        (CASE p.tracker_kind
          WHEN 'discoveries' THEN
            (SELECT count(*) FROM public.places_discovered d
              WHERE d.user_id = p_user_id AND d.method = 'remote'
                AND d.discovered_at::date = current_date)
          WHEN 'moisson_claims' THEN
            (SELECT count(*) FROM public.crown_harvest h
              WHERE h.user_id = p_user_id AND h.last_harvested_at::date = current_date)
          WHEN 'enigma_attempt' THEN
            (SELECT count(*) FROM public.enigma_responses e
              WHERE e.user_id = p_user_id AND e.responded_at::date = current_date)
          ELSE 0
        END)::int AS raw_count
      FROM picked p
    )
    SELECT COALESCE(json_agg(json_build_object(
      'id',          w.id,
      'type',        'daily',
      'title',       w.wording,
      'description', w.wording,
      'icon',        w.icon,
      'progress',    LEAST(w.raw_count, w.threshold),
      'target',      w.threshold,
      'reward',      json_build_object(
                       'type', CASE WHEN w.reward_couronnes > 0 THEN 'crowns' ELSE 'xp' END,
                       'amount', CASE WHEN w.reward_couronnes > 0 THEN w.reward_couronnes ELSE w.reward_xp END),
      'completedAt', CASE WHEN w.raw_count >= w.threshold THEN now() ELSE NULL END
    ) ORDER BY w.display_order), '[]'::json)
    FROM withprog w
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_today_quests_state(text) TO authenticated, service_role;
