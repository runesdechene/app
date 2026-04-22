-- 084_cleanup_dead_rpcs_fix_signatures.sql
-- Fix : migration 083 a utilisé des signatures incorrectes (p_place_id INT au lieu de TEXT),
-- donc les DROP IF EXISTS n'ont pas matché en prod. On recommence avec les vraies signatures
-- extraites de pg_proc.

BEGIN;

-- ============================================================================
-- RPCs mortes — anciens systèmes Claim / Fortify / Explore
-- ============================================================================

DROP FUNCTION IF EXISTS public.claim_place(text, text, numeric, numeric, boolean, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(text, text, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.explore_place(text, text) CASCADE;

-- ============================================================================
-- RPCs mortes — anciens getters
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_place_detail_v05(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_banner_feed(text, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners(double precision, double precision, double precision, double precision, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(text, double precision, double precision, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety() CASCADE;
DROP FUNCTION IF EXISTS public.get_place_explorers(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_likers(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_reviews(text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_review_by_id(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_places(text, text, integer, integer, text) CASCADE;

-- ============================================================================
-- RPCs mortes — like/unlike direct (remplacés par vote_contribution sur carnets)
-- ============================================================================

DROP FUNCTION IF EXISTS public.like_place(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.unlike_place(text, text) CASCADE;

-- ============================================================================
-- RPC morte — ancien get_submission_tags non-batch
-- ============================================================================
-- Remplacée par get_submission_tags_batch (seule utilisée côté client — Photos.tsx:118)

DROP FUNCTION IF EXISTS public.get_submission_tags(uuid) CASCADE;

-- ============================================================================
-- RPC morte — get_place_gauge (post-V0.5, ressources fusionnées)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_place_gauge(text) CASCADE;

-- ============================================================================
-- Note
-- ============================================================================
-- Les RPCs suivantes étaient listées dans 083 mais déjà absentes de prod :
-- get_user_profile, get_user_composed_title, get_my_abilities, set_composed_title,
-- reset_user_energy, claim_daily_fragment_bonus, use_fragment_ability.
-- Les DROP IF EXISTS sont déjà dans 083 et idempotents (no-op).

COMMIT;
