-- 322_security_hardening_lot_b.sql
-- WHY : durcissement sécurité Lot B (vues SECURITY DEFINER + policies always-true).
--
-- A) Vues SECURITY DEFINER (advisor 0010) : 3 vues s'exécutaient avec les droits du
--    créateur (bypass RLS). On les passe en security_invoker → elles respectent les
--    droits du rôle appelant.
--    - daily_enigma_status : VUE MORTE (aucune référence dans le code) mais lisible par
--      anon → exposait les réponses énigme de TOUS les users. invoker ferme la fuite.
--    - movement_stats / movement_wall_photos : lues uniquement par seo-pages, qui se
--      connecte en SERVICE_ROLE (bypass RLS) au build → invoker ne change rien pour lui
--      et nettoie le lint. (Pages SEO = HTML pré-généré, aucun lecteur anon runtime.)
--
-- B) Policies always-true (advisor 0024) réellement ouvertes :
--    - hub_photo_submissions « Anyone can submit photos » (INSERT anon) et
--      hub_submission_images « Anyone can add submission images » (INSERT anon) :
--      aucun insert direct côté client (grep app + thème) — tout passe par les RPC
--      create_photo_submission / add_submission_image (SECURITY DEFINER). On droppe
--      ces écritures anon (anti-spam).
--    - places « users_can_set_era » (UPDATE authenticated USING true WITH CHECK true) :
--      permettait à TOUT user connecté de modifier N'IMPORTE QUEL lieu en entier. L'era
--      est posée à la création via create_place (INSERT) ; aucun UPDATE direct de places
--      côté client (les éditions passent par RPC rename_place / update_place_position).
--      Policy inutilisée + dangereuse → DROP. La policy scopée « Authors can update
--      their places » reste en place.
--
-- NON touché ici : place_tags « Authenticated can insert » est utilisé en direct par
-- explore-web (AddPlaceFlow) → conservé (authenticated, faible valeur d'abus ;
-- bascule vers RPC = chantier app séparé).
-- ADDITIF / réversible.

BEGIN;

-- A) Vues → security_invoker
ALTER VIEW public.daily_enigma_status   SET (security_invoker = true);
ALTER VIEW public.movement_stats        SET (security_invoker = true);
ALTER VIEW public.movement_wall_photos  SET (security_invoker = true);

-- B) Policies always-true ouvertes
DROP POLICY IF EXISTS "Anyone can submit photos"       ON public.hub_photo_submissions;
DROP POLICY IF EXISTS "Anyone can add submission images" ON public.hub_submission_images;
DROP POLICY IF EXISTS "users_can_set_era"              ON public.places;

COMMIT;
