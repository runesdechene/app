-- Ménage Hub (juin 2026) : suppression de deux features mortes.
-- 1) Pipeline AVIS (hub_review_submissions) : UI hub Reviews.tsx + formulaire public
--    ReviewSubmit.tsx supprimés ; aucun appelant code ni couplage DB restant.
-- 2) Constructions/fortification : remplacé par l'Influence en V0.5 ; page hub
--    auto-désactivée, construction_types lu nulle part.
-- Vérifié en prod le 2026-06-29 : 0 FK entrante, 0 fonction/vue dépendante.

DROP FUNCTION IF EXISTS public.get_review_submissions(p_status text);
DROP FUNCTION IF EXISTS public.moderate_review(p_review_id uuid, p_status text, p_rejection_reason text, p_crowns integer);
DROP FUNCTION IF EXISTS public.delete_review_submission(p_review_id uuid);
DROP FUNCTION IF EXISTS public.create_review_submission(p_user_id character varying, p_submitter_name text, p_submitter_email text, p_location_name text, p_location_zip text, p_review_text text, p_rating integer, p_purchase_status text, p_consent_account boolean, p_consent_republish boolean, p_image_url text, p_storage_path text);
DROP FUNCTION IF EXISTS public.get_construction_types();

DROP TABLE IF EXISTS public.hub_review_submissions;
DROP TABLE IF EXISTS public.construction_types;
