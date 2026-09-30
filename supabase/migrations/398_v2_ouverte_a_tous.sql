-- WHY: la V2 s'ouvre à tous les comptes (Uriel, 30/09/2026) : tout Explorateur connecté entre sous
--      /v2, la V1 reste à la racine. Le verrou compte par compte (344) tombe ; la case
--      `users.v2_access` et set_v2_access ne servent plus (registre de purge).
--      Ce verrou ne réglait que l'affichage : la V2 passe par les mêmes RLS que la V1.
--      Pour refermer : remettre la définition de 344.
-- SCHEMA CHECKED (30/09/2026, définition live) : has_v2_access() telle que 344 l'a posée ;
--      users(id). Aucune fonction SQL ne l'appelle, seule la V2 (useV2Access).

CREATE OR REPLACE FUNCTION public.has_v2_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id::text = (auth.uid())::text
  );
$function$;
