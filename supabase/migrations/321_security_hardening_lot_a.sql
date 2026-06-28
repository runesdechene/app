-- 321_security_hardening_lot_a.sql
-- WHY : durcissement sécurité Lot A (suite advisor, après 320 RLS).
--
-- 1) Helpers internes appelables par le public. 5 fonctions _…_internal sont
--    SECURITY DEFINER et exposées en RPC à anon/authenticated → un attaquant peut
--    les appeler en direct et court-circuiter les gardes (level/discoveries/anti-
--    triche) de leurs wrappers publics. Elles ne sont appelées QUE par ces wrappers
--    (eux-mêmes SECURITY DEFINER → s'exécutent en owner), donc retirer l'EXECUTE au
--    public ne casse rien.
--    Advisor: 0028_anon_security_definer_function_executable.
--
-- 2) Énumération de fichiers (storage). Deux policies fourre-tout
--    SELECT … USING(true) sur storage.objects laissent lister TOUS les fichiers de
--    TOUS les buckets. Les buckets publics restent servis par URL sans policy SELECT ;
--    les seuls .list() de l'app (app-assets, tag-icons) ont leur propre policy SELECT
--    scopée. Suppression sûre.
--    Advisor: 0025_public_bucket_allows_listing.
--
-- NB : des policies fourre-tout INSERT/UPDATE/DELETE USING(true) subsistent sur
-- storage.objects (write anon non voulu) — traitées dans une passe dédiée (il faut
-- d'abord ajouter des policies d'écriture scopées aux buckets app-ads/app-fragments/
-- home-banners/faction-emblems). ADDITIF.

BEGIN;

-- 1) Helpers internes : plus appelables par anon/authenticated
REVOKE EXECUTE ON FUNCTION public._answer_enigma_internal(text,integer,text)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._contribute_to_place_internal(text,text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._unlike_contribution_internal(text,integer)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._visit_place_gps_internal(text,text,numeric,numeric)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._vote_contribution_internal(text,integer,integer)               FROM PUBLIC, anon, authenticated;

-- 2) Énumération cross-bucket : suppression des 2 policies SELECT fourre-tout
DROP POLICY IF EXISTS "Allow all 1snxhtj_0" ON storage.objects;
DROP POLICY IF EXISTS "Enable storage 1lvpvk4_1" ON storage.objects;

COMMIT;
