-- 071_v07_get_my_recent_activity.sql
-- WHY: get_recent_activity retourne les N events globaux les plus récents
-- (tous joueurs confondus). Pour un user actif, ses propres actions peuvent
-- être noyées dans le flot et ne pas apparaître dans les 50 events ramenés
-- au boot → ses toasts (énigmes, plantages, contributions...) "disparaissent"
-- au reload même s'ils sont en base. Bug signalé Uriel 03/05/2026.
--
-- Cette nouvelle RPC retourne les N derniers events d'un user spécifique,
-- avec le même enrichissement de data (actorName / placeTitle / etc.). Le
-- frontend l'appelle en parallèle de get_recent_activity et merge les deux
-- listes par id pour garantir que les actions de l'user sont toujours là.

CREATE OR REPLACE FUNCTION public.get_my_recent_activity(
  p_user_id text,
  p_limit   integer DEFAULT 50
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN '[]'::json;
  END IF;

  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT
        a.id,
        a.type,
        a.actor_id,
        a.place_id,
        a.faction_id,
        a.data
          || (CASE WHEN NOT (a.data ? 'actorName') AND u.id IS NOT NULL
              THEN jsonb_build_object('actorName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'))
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'actorAvatarUrl') AND u.id IS NOT NULL AND u.avatar_url IS NOT NULL
              THEN jsonb_build_object('actorAvatarUrl', u.avatar_url)
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'factionColor') AND u.id IS NOT NULL AND u.faction_id IS NOT NULL
              THEN jsonb_build_object('factionColor', (SELECT color FROM factions WHERE id = u.faction_id))
              ELSE '{}'::jsonb END)
          || (CASE WHEN NOT (a.data ? 'placeTitle') AND p.id IS NOT NULL
              THEN jsonb_build_object('placeTitle', p.title, 'placeLatitude', p.latitude, 'placeLongitude', p.longitude)
              ELSE '{}'::jsonb END)
        AS data,
        a.created_at
      FROM activity_log a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN places p ON p.id = a.place_id
      WHERE a.actor_id = p_user_id
      ORDER BY a.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_recent_activity(text, integer) TO authenticated, service_role;
