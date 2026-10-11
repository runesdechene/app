-- WHY: deux colonnes de nom, héritées de la V1 : la V2 écrit first_name (update_my_profile ;
--      l'onboarding, les deux) et affiche COALESCE(display_name, first_name) ; un déclencheur
--      (182, 487) recopie first_name dans display_name. 467 comptes avaient deux valeurs
--      différentes (Uriel, 11/10 : les aligner) :
--   1. deux comptes montraient un nom réel venu de la V1 au lieu du pseudo qu'ils ont choisi
--      (« Moony », « Ainselia ») : leur nom affiché devient leur pseudo ;
--   2. 142 sans nom affiché : il prend le prénom. Rien ne change à l'écran.
--   3. 323 sans aucun nom avaient un prénom vide ('') face à un nom affiché NULL : le vide devient
--      NULL. Les deux colonnes disent enfin la même chose.
--   Garder une seule colonne : docs/tech-backlog.md (environ 190 lectures à reprendre).
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users(first_name, display_name) ;
--   trg_sync_display_name_with_first_name (BEFORE INSERT OR UPDATE OF first_name).

-- 1. Le pseudo choisi l'emporte (display_name seul : le déclencheur ne part pas).
UPDATE public.users SET display_name = first_name
 WHERE NULLIF(btrim(first_name), '') IS NOT NULL AND display_name IS NOT NULL
   AND display_name IS DISTINCT FROM first_name;

-- 2. La colonne vide prend l'autre.
UPDATE public.users SET first_name = display_name
 WHERE NULLIF(btrim(first_name), '') IS NULL AND NULLIF(btrim(display_name), '') IS NOT NULL;
UPDATE public.users SET display_name = first_name
 WHERE NULLIF(btrim(display_name), '') IS NULL AND NULLIF(btrim(first_name), '') IS NOT NULL;

-- 3. Un prénom vide n'est pas un nom.
UPDATE public.users SET first_name = NULL WHERE btrim(first_name) = '';
