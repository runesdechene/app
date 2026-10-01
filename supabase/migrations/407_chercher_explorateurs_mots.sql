-- WHY: mentionner « Le Marcheur de Plumes » était impossible (Uriel, 01/10/2026) : la recherche
--      ne rendait que les 6 noms les plus courts commençant par ce qu'on tape — « le » en compte
--      28. Désormais : le début du nom OU le début de n'importe quel mot (« plumes » le trouve),
--      les noms qui commencent par la recherche d'abord, puis les plus courts ; jusqu'à 20.
-- SCHEMA CHECKED (01/10/2026, définition live) : chercher_explorateurs(text, int) copiée du live ;
--      users(id, display_name, first_name, avatar_url, is_active) ; user_public_name(text, text, text).

CREATE OR REPLACE FUNCTION public.chercher_explorateurs(p_debut text, p_limite integer DEFAULT 6)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT replace(replace(btrim(p_debut), '%', ''), '_', '') AS debut)
  SELECT COALESCE(json_agg(json_build_object('id', x.id, 'nom', x.nom, 'avatar', x.avatar) ORDER BY x.rang), '[]'::json)
  FROM (
    SELECT u.id, user_public_name(u.id, u.display_name, u.first_name) AS nom, u.avatar_url AS avatar,
           row_number() OVER (
             ORDER BY (user_public_name(u.id, u.display_name, u.first_name) ILIKE q.debut || '%') DESC,
                      char_length(user_public_name(u.id, u.display_name, u.first_name))) AS rang
    FROM users u CROSS JOIN q
    WHERE u.is_active IS NOT FALSE
      AND u.id <> (auth.uid())::text
      AND q.debut <> ''
      AND (user_public_name(u.id, u.display_name, u.first_name) ILIKE q.debut || '%'
           OR user_public_name(u.id, u.display_name, u.first_name) ILIKE '% ' || q.debut || '%')
    ORDER BY rang
    LIMIT least(greatest(p_limite, 1), 20)
  ) x
  WHERE auth.uid() IS NOT NULL;
$function$;
