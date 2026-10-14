-- WHY: rename_faction(text, text) tournait en SECURITY DEFINER, ouverte à tout compte connecté, sans
--      aucune vérification d'admin ni d'équipe (relevé du 14/10/2026) : n'importe quel joueur pouvait
--      changer l'identifiant d'une Compagnie. Et elle la recrée avec les seules colonnes de la V1 :
--      devise, emblème, privée, titres des rôles et slug public étaient perdus. Ni l'appli, ni les
--      fonctions serveur, ni les pages SEO ne l'appellent ; seul l'ancien Hub (renommage de l'identifiant
--      au blur) s'en servait. Le nouveau Hub modifie le nom affiché, jamais l'identifiant.
--      Fermée à tous sauf au serveur (service_role). Réversible : un GRANT la rouvrirait.
-- SCHEMA CHECKED (14/10/2026, live) : rename_faction(text, text) SECURITY DEFINER, aucune garde
--   _is_admin/_is_staff ; EXECUTE accordé à postgres, authenticated, service_role, supabase_auth_admin.

REVOKE ALL ON FUNCTION public.rename_faction(text, text) FROM PUBLIC, anon, authenticated, supabase_auth_admin;
