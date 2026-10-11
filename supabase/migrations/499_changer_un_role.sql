-- WHY: « Changer le rôle » dans le Hub (Users.tsx) écrivait users en direct ; la RLS n'a aucune
--      politique d'écriture sur users (et ne doit pas en avoir : un joueur se ferait admin) :
--      l'écriture ne touchait aucune ligne, sans erreur, et le Hub affichait le nouveau rôle
--      quand même (audit du 11/10/2026). Une fonction réservée aux admins le fait, sur une
--      liste fermée de rôles.
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(id, role) ; rôles du Hub :
--   user, ambassador, moderator, admin ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public.changer_role(p_user text, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_role NOT IN ('user', 'ambassador', 'moderator', 'admin') THEN
    PERFORM _refus('Rôle inconnu', 'role');
  END IF;
  UPDATE users SET role = p_role WHERE id = p_user;
  IF NOT FOUND THEN PERFORM _refus('Compte introuvable', 'compte'); END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.changer_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_role(text, text) TO authenticated;
