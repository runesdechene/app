-- 204_get_contribution_likers.sql
-- WHY : pouvoir afficher QUI a aimé une contribution (description ou commentaire).
-- Liste les votants (vote=1) avec nom + avatar, du plus récent au plus ancien.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_contribution_likers(p_contribution_id integer)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'userId', u.id, 'name', u.first_name, 'avatar', u.avatar_url
  ) ORDER BY cv.created_at DESC), '[]'::json)
  FROM contribution_votes cv
  JOIN users u ON u.id = cv.user_id
  WHERE cv.contribution_id = p_contribution_id AND cv.vote = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_contribution_likers(integer) TO authenticated, anon, service_role;

COMMIT;
