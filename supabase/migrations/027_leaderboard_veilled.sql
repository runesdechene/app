-- 027_leaderboard_veilled.sql
-- WHY : remplace 'planted' (count de veille_history, donc historique) par
-- 'veilled' (count des lieux ACTUELLEMENT veillés via place_veille JOIN
-- expedition_members). Plus juste pour un classement temps réel "qui tient
-- le plus de territoire en ce moment" — un user supplanté ne compte plus
-- son ancien plantage, ce qui colle à la promesse V0.7.

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
        'rank',         ROW_NUMBER() OVER (ORDER BY scored.glory DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        scored.glory
      ) AS row_data
      FROM (
        SELECT
          uid,
          (
            COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers WHERE user_id = uid), 0) * 1
          + COALESCE((SELECT COUNT(*)            FROM public.places              WHERE author_id = uid), 0) * 7
          + COALESCE((SELECT COUNT(*)            FROM public.place_contributions WHERE user_id = uid AND type = 'carnet'), 0) * 3
          + COALESCE((SELECT SUM(
                COALESCE(jsonb_array_length(images), 0)
                + CASE
                    WHEN (images IS NULL OR jsonb_array_length(images) = 0)
                     AND image_url IS NOT NULL AND image_url != ''
                    THEN 1 ELSE 0
                  END
              )::int FROM public.place_contributions WHERE user_id = uid), 0) * 1
          + COALESCE((SELECT COUNT(*)            FROM public.veille_history     WHERE user_id = uid), 0) * 5
          + COALESCE((SELECT COUNT(*)            FROM public.enigma_responses   WHERE user_id = uid AND correct = TRUE), 0) * 1
          )::int AS glory
        FROM (SELECT id AS uid FROM public.users) base
      ) scored
      JOIN public.users u ON u.id = scored.uid
      LEFT JOIN public.factions f ON f.id = u.faction_id
      WHERE scored.glory > 0
      ORDER BY scored.glory DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
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
    -- V0.7 phase 3.5 — Lieux ACTUELLEMENT veillés par chaque user (state
    -- en cours, pas l'historique). Un user supplanté ne compte plus.
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
