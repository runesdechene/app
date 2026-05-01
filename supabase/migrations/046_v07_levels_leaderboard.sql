-- 046_v07_levels_leaderboard.sql
-- WHY : refonte de get_leaderboard('notoriety') pour trier par niveau (tie-break xp_total).
-- Les autres types ('authored', 'veilled') restent inchangés.

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_type text, p_limit integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY u.xp_total DESC, u.id),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        public._level_from_xp(u.xp_total),
        'xpTotal',      u.xp_total
      ) AS row_data
      FROM public.users u
      LEFT JOIN public.factions f ON f.id = u.faction_id
      WHERE u.xp_total > 0
      ORDER BY u.xp_total DESC, u.id
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    -- Inchangé (mig 038)
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(*)::int
      ) AS row_data
      FROM public.users u
      JOIN public.places p ON p.author_id = u.id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'veilled' THEN
    -- Inchangé (mig 027)
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT pv.place_id) DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(DISTINCT pv.place_id)::int
      ) AS row_data
      FROM public.users u
      JOIN public.expedition_members em ON em.user_id = u.id
      JOIN public.place_veille pv ON pv.expedition_id = em.expedition_id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(DISTINCT pv.place_id) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO authenticated, anon, service_role;
