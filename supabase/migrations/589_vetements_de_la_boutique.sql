-- WHY: les types de vêtement d'un avis sont ceux que la boutique vend vraiment (Uriel, 11/11) :
--   T-shirt, Sweatshirt, Veste Zip. La 588 avait pris la liste provisoire de la spec (sweat,
--   casquette, autre) : pas de casquette au catalogue, et « Autre » ne range l'avis sur aucune page.
-- SCHEMA CHECKED (11/11/2026, live) : hub_photo_submissions_garment_type_check (mig 588) ;
--   aucune ligne n'a encore de garment_type.

ALTER TABLE public.hub_photo_submissions DROP CONSTRAINT hub_photo_submissions_garment_type_check;
ALTER TABLE public.hub_photo_submissions
  ADD CONSTRAINT hub_photo_submissions_garment_type_check CHECK (garment_type IN ('tshirt', 'sweatshirt', 'veste_zip'));
