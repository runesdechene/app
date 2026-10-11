-- WHY: 45 noms portent un espace de bord (« Rémy ») : il se glisse avant une virgule, une
--      parenthèse, et deux noms identiques ne se ressemblent plus (Uriel, 11/10 : « purifier »).
--   1. sync_display_name_with_first_name (définition live du 11/10, copiée entière) : le prénom
--      perd ses espaces de bord au moment où il s'enregistre. La cause, pas la trace.
--   2. Les noms déjà là : les prénoms (le déclencheur recopie chacun dans le nom affiché), puis
--      les noms affichés. Un seul compte avait un nom affiché distinct de son prénom à espace :
--      il le garde, nettoyé lui aussi (il est mis de côté avant, rendu après — le déclencheur ne
--      part que sur un changement de first_name).
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(id, first_name, display_name) ;
--   déclencheur trg_sync_display_name_with_first_name, BEFORE INSERT OR UPDATE OF first_name.

CREATE OR REPLACE FUNCTION public.sync_display_name_with_first_name()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.first_name := btrim(NEW.first_name);
  IF NEW.first_name IS NOT NULL AND NEW.first_name <> '' THEN
    NEW.display_name := NEW.first_name;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TEMP TABLE noms_choisis AS
  SELECT id, btrim(display_name) AS nom FROM public.users
   WHERE first_name <> btrim(first_name) AND display_name IS DISTINCT FROM first_name;

UPDATE public.users SET first_name = btrim(first_name) WHERE first_name <> btrim(first_name);
UPDATE public.users SET display_name = btrim(display_name) WHERE display_name <> btrim(display_name);
UPDATE public.users u SET display_name = n.nom FROM noms_choisis n WHERE u.id = n.id;
DROP TABLE noms_choisis;
