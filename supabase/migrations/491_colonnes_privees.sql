-- WHY: audit du 11/10/2026 — tout joueur connecté lisait, sur tous les comptes, le code postal,
--      le numéro client Shopify, les comptes qu'il fait taire, son appareil et ses dernières
--      connexions. Ces colonnes ne regardent que lui et l'équipe : l'appli et le Hub ne les
--      lisent jamais en direct (les RPC et la vue users_admin passent par leur propriétaire, les
--      fonctions serveur par la clé serveur). Les politiques n'utilisent que users.id et .role.
--   Et TRUNCATE (qui passe outre la RLS) n'a rien à faire aux rôles publics : retiré partout ;
--   anon perd aussi l'écriture de users (la RLS la refusait déjà).
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users — anon lit id, first_name,
--   display_name, avatar_url, faction_id ; authenticated a des droits SELECT par colonne, sans
--   droit de table ; aucune fonction SECURITY INVOKER ni vue invoker ne lit ces colonnes.

REVOKE SELECT (location_zip, shopify_customer_id, muted_user_ids, last_device_os,
               last_device_version, last_access, last_login_at, timezone,
               push_important_enabled, push_recap_enabled, email_address, password)
  ON public.users FROM authenticated, anon;

REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
