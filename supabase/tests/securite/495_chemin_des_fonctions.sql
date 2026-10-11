-- 495 : plus aucune fonction privilégiée sans chemin figé ; la vitrine et la carte répondent. Annulé.
BEGIN;
\ir ../../migrations/495_chemin_des_fonctions.sql
DO $test$
DECLARE restantes int; lieux int; carte int;
BEGIN
  SELECT count(*) INTO restantes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef AND pg_get_userbyid(p.proowner) = current_user
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%');
  SELECT json_array_length(public.lieux_au_hasard(8)) INTO lieux;
  SELECT json_array_length(public.carte_publique()) INTO carte;
  RAISE EXCEPTION 'BILAN sans_chemin=% (attendu 0) lieux=% (attendu 8) carte=% (attendu > 3000) territoire=%',
    restantes, lieux, carte, (public.territoire_en(45.5, 5.6))::text;
END $test$;
ROLLBACK;
