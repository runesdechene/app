-- WHY: l'onboarding encourage à mettre une photo, puis la montre sur l'écran de bienvenue (Uriel,
--      11/10). mon_entree rend désormais l'avatar, pour que la bienvenue l'affiche même après un
--      rechargement. Rien d'autre ne change.
-- SCHEMA CHECKED (11/10/2026, live) : users(avatar_url text) ; mon_entree() copiée de
--   pg_get_functiondef, un champ ajouté.

CREATE OR REPLACE FUNCTION public.mon_entree()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'nom', NULLIF(COALESCE(NULLIF(u.display_name, ''), u.first_name), ''),
    'numero', (SELECT count(*) FROM users v WHERE v.created_at <= u.created_at),
    'fragments', (SELECT count(*) FROM user_fragments f WHERE f.user_id = u.id),
    'charteSignee', u.charte_signee_le IS NOT NULL,
    'avatar', NULLIF(u.avatar_url, ''))
  FROM users u
  WHERE u.id = (auth.uid())::text;
$function$;
