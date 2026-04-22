-- 083_cleanup_dead_rpcs_post_v05.sql
-- Nettoyage post-stabilisation V0.5 : suppression des RPC, fonctions internes
-- et policies qui ne sont plus référencées par le client ni par aucune fonction vivante.
--
-- Stratégie : tous les DROP sont IF EXISTS (idempotent). Si un artefact a déjà
-- disparu côté prod (suite à migrations précédentes), la ligne est no-op.
--
-- Source d'autorité : audit Phase 1.2 du plan 2026-04-15-audit-pre-lancement.md.
-- Chaque artefact supprimé a été vérifié :
--   - soit jamais appelé dans src/ (grep 0 résultat)
--   - soit remplacé par une version plus récente (vote_*_v3, etc.)
--
-- Ce qu'on NE supprime PAS (prudence) :
--   - Colonnes factions.bonus_conquest/construction/regen_* : référencées dans
--     d'anciennes versions de fonctions en baseline. Inertes à 0 côté runtime.
--   - Table place_claims : encore utilisée par migrate_user_to_auth_id.
--   - Triggers actifs autres que log_fortify : nécessitent analyse dédiée.
--   - RPCs internes potentiellement référencées (check_title_condition,
--     place_influence_score, territory_radius_km) : à confirmer via pg_proc
--     avant suppression.

BEGIN;

-- ============================================================================
-- 1. Fonction orpheline (trigger trg_log_fortify déjà droppé en migration 072)
-- ============================================================================

DROP FUNCTION IF EXISTS public.log_fortify_activity() CASCADE;


-- ============================================================================
-- 2. Policy RLS redondante (masquée par fragment_tag_affinities_all)
-- ============================================================================

DROP POLICY IF EXISTS fragment_tag_affinities_select ON public.fragment_tag_affinities;


-- ============================================================================
-- 3. RPCs mortes — anciens systèmes Claim / Fortify / Explore (remplacés V0.5)
-- ============================================================================
-- Remplacées par : place_influence_action, visit_place_gps

DROP FUNCTION IF EXISTS public.claim_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.claim_place(TEXT, INT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, INT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.explore_place(TEXT, INT) CASCADE;


-- ============================================================================
-- 4. RPCs mortes — anciens getters non utilisés
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_place_detail_v05(INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_banner_feed(TEXT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_banner_feed(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners() CASCADE;
DROP FUNCTION IF EXISTS public.get_map_banners(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(TEXT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_regular_feed(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_faction_notoriety(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_explorers(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_likers(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_place_reviews(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_review_by_id(INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_places(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_profile(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_composed_title(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_abilities(TEXT) CASCADE;


-- ============================================================================
-- 5. RPCs mortes — fragments / abilities non utilisés
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[]) CASCADE;
DROP FUNCTION IF EXISTS public.like_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.unlike_place(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.reset_user_energy(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.claim_daily_fragment_bonus(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.use_fragment_ability(TEXT, INT) CASCADE;


-- ============================================================================
-- 6. RPC morte — ancien get_submission_tags non-batch
-- ============================================================================
-- Remplacée par get_submission_tags_batch (seule utilisée côté client)

DROP FUNCTION IF EXISTS public.get_submission_tags(TEXT) CASCADE;


-- ============================================================================
-- 7. RPC morte — get_place_gauge (plus d'appel post-V0.5, ressources fusionnées)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_place_gauge(INT) CASCADE;

COMMIT;
