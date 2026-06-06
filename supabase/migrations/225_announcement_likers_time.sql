-- 225_announcement_likers_time.sql
-- WHY : la modale « Aimé par » de l'annonce affiche désormais depuis combien de
-- temps chaque personne a aimé (sur la même ligne). On ajoute likedAt (created_at)
-- au retour de get_announcement_likers. (Inchangé pour les commentaires.)

CREATE OR REPLACE FUNCTION public.get_announcement_likers(p_announcement_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'userId',  u.id,
    'name',    COALESCE(u.display_name, u.first_name),
    'avatar',  u.avatar_url,
    'likedAt', al.created_at
  ) ORDER BY al.created_at DESC), '[]'::json)
  FROM public.announcement_likes al
  JOIN public.users u ON u.id = al.user_id
  WHERE al.announcement_id = p_announcement_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_likers(uuid) TO authenticated, anon;
