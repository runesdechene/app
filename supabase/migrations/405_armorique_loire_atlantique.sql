-- WHY: la Loire-Atlantique (Nantes, Bretagne historique) dit aussi « Armorique » sur la carte
--      (Uriel, 01/10/2026), comme les quatre départements bretons (404).
-- SCHEMA CHECKED (01/10/2026) : territoires_historiques(departement text PRIMARY KEY, nom text) ;
--      « Loire-Atlantique » lu dans geo_departements.

INSERT INTO public.territoires_historiques (departement, nom)
VALUES ('Loire-Atlantique', 'Armorique')
ON CONFLICT (departement) DO UPDATE SET nom = EXCLUDED.nom;
