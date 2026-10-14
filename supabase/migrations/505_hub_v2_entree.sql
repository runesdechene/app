-- WHY: Hub V2, plan 1 (spec 2026-10-14-hub-v2-design §4, §13.1).
--      1. La contrainte users_account_source_check accepte 'flyer' en prod (26 comptes, changée
--         à la main) mais aucune migration ne le dit : le dépôt redevient la vérité, sans rien
--         changer en prod.
--      2. hub_est_admin() : la porte du Hub V2 demande si le compte connecté est admin, sans
--         erreur pour un joueur (la porte affiche « réservé à l'équipe »).
--      3. Deux index par date : le pouls et le fil du Hub lisent les visites et les réponses
--         d'énigme par période, toutes personnes confondues.
-- SCHEMA CHECKED (14/10/2026, live) : pg_constraint users_account_source_check =
--   CHECK (account_source IN ('app','shopify','stand','flyer')) ; places_discovered(discovered_at),
--   enigma_responses(responded_at) sans index par date seule ; _is_admin() (219).

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_source_check;
ALTER TABLE public.users ADD CONSTRAINT users_account_source_check
  CHECK ((account_source)::text = ANY (ARRAY['app'::varchar, 'shopify'::varchar, 'stand'::varchar, 'flyer'::varchar]::text[]));

CREATE OR REPLACE FUNCTION public.hub_est_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _is_admin();
$function$;

REVOKE ALL ON FUNCTION public.hub_est_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_est_admin() TO authenticated;

CREATE INDEX IF NOT EXISTS places_discovered_par_date ON public.places_discovered (discovered_at DESC);
CREATE INDEX IF NOT EXISTS enigma_responses_par_date ON public.enigma_responses (responded_at DESC);
