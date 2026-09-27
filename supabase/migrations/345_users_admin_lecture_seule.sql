-- 345 — La vue staff users_admin redevient une vue de LECTURE
--
-- WHY : relecture du 27/09/2026. Les default privileges du schéma public (baseline) donnent ALL
-- à `authenticated` sur toute nouvelle table ou vue : la vue users_admin (mig 337) a donc reçu
-- INSERT, UPDATE, DELETE… en plus du SELECT voulu. Or elle s'exécute avec les droits de son
-- propriétaire (security_invoker = off), qui passe au-dessus des RLS et des droits par colonne,
-- et elle est auto-modifiable (une seule table, pas de WITH CHECK OPTION) :
--   · n'importe quel joueur connecté pouvait INSERT dans users (le filtre _is_staff() ne
--     s'applique pas à un INSERT) ;
--   · un modérateur pouvait UPDATE role = 'admin', ou contourner set_v2_access (réservé admin).
-- Aucune application n'écrit par cette vue (vérifié : le Hub ne fait que la lire) : on ne
-- retire que des droits inutilisés. Relevé live avant correction (27/09) : authenticated =
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.users_admin FROM authenticated;
REVOKE ALL ON public.users_admin FROM anon;
GRANT SELECT ON public.users_admin TO authenticated;
