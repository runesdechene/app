-- WHY: audit du 11/10/2026 — 112 fonctions SECURITY DEFINER n'avaient pas de search_path figé
--      (alerte 0011 de Supabase) : elles résolvaient leurs noms avec le chemin de l'appelant, ce
--      qui permet, à qui pourrait créer un objet du même nom ailleurs, de détourner une fonction
--      qui tourne avec les droits de son propriétaire. Leur chemin est figé sur celui qu'elles
--      ont toujours eu en pratique (public, puis extensions où vit PostGIS) : rien ne change à
--      leur comportement.
-- SCHEMA CHECKED (11/10/2026, pg_proc live) : prosecdef, proconfig sans search_path ; schéma
--   extensions présent ; les fonctions des extensions ne sont pas touchées.

DO $migration$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND pg_get_userbyid(p.proowner) = current_user
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.sig);
  END LOOP;
END
$migration$;
