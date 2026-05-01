-- 041_v07_fix_app_settings.sql  (fix pour mig 040)
-- WHY : la mig 040 a créé une table `app_config` (key/value) par erreur.
-- Le repo a déjà une table `app_settings` (mig baseline 001) avec la même
-- structure (key/value/updated_at). Cette mig de correction :
--   1. Déplace la ligne xp_epoch de app_config vers app_settings
--   2. Drop la table app_config (devenue redondante)
--
-- À partir de cette mig, TOUTES les configs app vivent dans app_settings.

-- 1. Migrer xp_epoch vers app_settings (idempotent)
INSERT INTO public.app_settings (key, value)
SELECT key, value FROM public.app_config WHERE key = 'xp_epoch'
ON CONFLICT (key) DO NOTHING;

-- 2. Drop la table redondante (CASCADE pour éviter les soucis de FK orphelines, mais
-- normalement il n'y en a pas puisque app_config était toute neuve)
DROP TABLE IF EXISTS public.app_config CASCADE;
