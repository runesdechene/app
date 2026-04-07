-- 044_recent_activity_enrich_name.sql
-- get_recent_activity : joindre users + places pour toujours avoir actorName/placeTitle/coords

CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT
        a.id,
        a.type,
        a.actor_id,
        a.place_id,
        a.faction_id,
        -- Enrichir data avec actorName + placeTitle/coords si absents
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
      ORDER BY a.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_activity(INT) TO authenticated;
