-- WHY: les conditions d'utilisation et la politique de confidentialité s'acceptent — à
--      l'inscription (case à cocher, à côté de la Charte), et à chaque nouvelle version, par une
--      fenêtre qu'il faut valider pour entrer (Uriel, 11/10). La preuve du consentement se garde
--      (RGPD art. 7.1) : la version acceptée et sa date.
--   accepter_conditions(p_version) : le compte appelant accepte cette version.
--   mes_conditions() : la version qu'il a acceptée (null : jamais).
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users n'a pas ces colonnes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS conditions_version text,
  ADD COLUMN IF NOT EXISTS conditions_acceptees_le timestamptz;

CREATE OR REPLACE FUNCTION public.accepter_conditions(p_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN PERFORM _refus('Non connecté', 'session'); END IF;
  IF p_version !~ '^\d{4}-\d{2}-\d{2}$' THEN PERFORM _refus('Version inconnue', 'version'); END IF;
  UPDATE users SET conditions_version = p_version, conditions_acceptees_le = now()
   WHERE id = (auth.uid())::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mes_conditions()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT conditions_version FROM users WHERE id = (auth.uid())::text;
$function$;

REVOKE ALL ON FUNCTION public.accepter_conditions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mes_conditions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_conditions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mes_conditions() TO authenticated;
