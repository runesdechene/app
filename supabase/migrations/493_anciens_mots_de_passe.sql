-- WHY: audit du 11/10/2026 — users.password garde 2 460 empreintes Argon2 de l'ancien serveur de
--      la V1. Plus rien ne les lit (ni l'appli, ni le Hub, ni une fonction : la connexion passe par
--      Supabase Auth, la V2 par le code e-mail) ; une donnée qui ne sert pas ne se garde pas (RGPD,
--      minimisation). Effacées. La colonne, encore dans la vue users_admin, part avec la purge
--      (docs/v2/purge-back.md).
-- SCHEMA CHECKED (11/10/2026, information_schema live) : users.password character varying NULL ;
--   aucune fonction ne la lit.

UPDATE public.users SET password = NULL WHERE password IS NOT NULL;
