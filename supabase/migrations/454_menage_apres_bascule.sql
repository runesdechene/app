-- WHY: lendemain de la bascule (07/10/2026) — la V1 est partie, ses restes s'en vont.
--      1. Le chat : la V1 écrivait elle-même dans chat_messages, nom affiché compris (n'importe
--         qui pouvait signer du nom d'un autre — registre de purge, relecture 28/09). La V2
--         écrit par ecrire_au_registre (SECURITY DEFINER, mig 371) : les policies INSERT des
--         clients ne servent plus qu'à cette faille. Les policies de lecture restent (le temps
--         réel de la V2 en dépend).
--      2. Le verrou d'accès compte par compte (mig 344) : ouvert à tous depuis la 398, sa case
--         `users.v2_access` et set_v2_access ne servent plus. Le Hub a retiré sa case (même
--         commit). has_v2_access() reste : elle dit encore si le compte a sa fiche.
--      La vue users_admin porte la colonne depuis la 344 (SELECT * rejoué) : une vue ne perd
--      pas de colonne par CREATE OR REPLACE, on la défait et on la refait à l'identique. Une
--      vue neuve reçoit ALL pour `authenticated` (default privileges) : on rejoue la 345.
-- SCHEMA CHECKED (07/10/2026, relu en prod à la main) : policies INSERT de chat_messages =
--      chat_insert_bugs / _company / _faction / _general (_company créée hors migration) ;
--      aucune fonction sans SECURITY DEFINER n'écrit dans chat_messages ; set_v2_access(text,
--      boolean) ; users.v2_access ; users_admin = SELECT de la liste de 344 … _is_staff() OR
--      service_role, sans dépendant. Refaite en SELECT *, elle gagne les colonnes ajoutées
--      depuis (show_departement, show_envies, signe_fragment_id, lieux_en_couleur,
--      charte_signee_le) : des réglages de profil, lus par le seul staff.

DROP POLICY IF EXISTS chat_insert_bugs ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_company ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_faction ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert_general ON public.chat_messages;

DROP FUNCTION IF EXISTS public.set_v2_access(text, boolean);

DROP VIEW public.users_admin;

ALTER TABLE public.users DROP COLUMN v2_access;

CREATE VIEW public.users_admin AS
  SELECT *
    FROM public.users
   WHERE public._is_staff()
      OR (SELECT auth.role()) = 'service_role';

ALTER VIEW public.users_admin SET (security_invoker = off);

COMMENT ON VIEW public.users_admin IS
  'Miroir de users reserve au staff (hub). Renvoie zero ligne a un joueur
   ordinaire. Les lectures du back-office passent par ici depuis la mig 337.';

REVOKE ALL ON public.users_admin FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.users_admin TO authenticated, service_role;
