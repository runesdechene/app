-- 330_rls_place_moderation_log.sql
-- WHY : place_moderation_log (créée en mig 329) est postérieure à mig 320
-- (enable_rls_public_tables) donc n'a jamais reçu son ENABLE ROW LEVEL SECURITY,
-- et 329 fait `GRANT SELECT ... TO authenticated` → tout joueur connecté peut lire
-- l'intégralité du journal d'audit de modération via PostgREST. Même classe de
-- faille (rls_disabled_in_public) que 320 a corrigée pour les 34 autres tables.
--
-- Aucune RPC ni aucun code frontend ne lit cette table directement (les RPC mod_*
-- SECURITY DEFINER bypassent RLS pour y écrire) → deny-all ne casse rien.
-- Posture identique à place_tags_revisions (320) : ENABLE RLS sans policy.

BEGIN;

ALTER TABLE public.place_moderation_log ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.place_moderation_log FROM authenticated;

COMMIT;
