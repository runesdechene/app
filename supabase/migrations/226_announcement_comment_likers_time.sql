-- 226_announcement_comment_likers_time.sql
-- WHY : on uniformise — la modale « Aimé par » affiche « il y a X » partout
-- (annonce ET commentaires), via un seul composant. get_announcement_comment_likers
-- renvoie donc aussi likedAt (created_at), comme get_announcement_likers (mig 225).

CREATE OR REPLACE FUNCTION public.get_announcement_comment_likers(p_comment_id bigint)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'userId',  u.id,
    'name',    COALESCE(u.display_name, u.first_name),
    'avatar',  u.avatar_url,
    'likedAt', cl.created_at
  ) ORDER BY cl.created_at DESC), '[]'::json)
  FROM public.announcement_comment_likes cl
  JOIN public.users u ON u.id = cl.user_id
  WHERE cl.comment_id = p_comment_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_comment_likers(bigint) TO authenticated, anon;
