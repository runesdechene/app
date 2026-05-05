-- 075_drop_dead_rpcs.sql
-- WHY: Sprint Purification (mai 2026) — petit nettoyage final RPCs vraiment
--      mortes (0 ref code, version "v2/v3/batch" prend le relais).
--
-- L'audit B8 a révélé que la majorité des RPCs flaguées par l'audit Phase 1
-- comme "candidates DROP" sont en fait encore utilisées (cheat_refill,
-- moderate_*, log_*_activity triggers, create_user_from_submission, etc.).
-- Seuls 2 doublons restent légitimement à dropper.

-- ============================================================
-- 1. set_displayed_titles (sans v3) — la version v3 (mig 044) est l'active
-- ============================================================

DROP FUNCTION IF EXISTS public.set_displayed_titles(text, integer[]);

-- ============================================================
-- 2. get_submission_images (sans batch) — la version batch est utilisée
--    par Photos.tsx du Hub (ligne 117 : get_submission_images_batch)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_submission_images(uuid);
