-- WHY: Missives, lot 1, tâche 2 : l'appli demande, en signant la Charte, si l'on veut recevoir les
--      nouvelles de Runes de Chêne (case non cochée par défaut). Le choix s'écrit sur la fiche du compte
--      connecté, daté, porte 'appli' — la dernière action gagne ensuite face à Shopify.
--      Aucun p_user_id : la fonction lit auth.uid(), comme signer_charte.
-- SCHEMA CHECKED (23/10/2026, live) : signer_charte() (garde auth.uid(), WHERE id = auth.uid()::text) ;
--   users.accord_nouvelles, accord_nouvelles_le, accord_nouvelles_porte créées par la 539.

CREATE FUNCTION public.donner_accord_nouvelles(p_accord boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE users
     SET accord_nouvelles = p_accord, accord_nouvelles_le = now(), accord_nouvelles_porte = 'appli'
   WHERE id = (auth.uid())::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.donner_accord_nouvelles(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donner_accord_nouvelles(boolean) TO authenticated;
