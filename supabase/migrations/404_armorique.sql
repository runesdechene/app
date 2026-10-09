-- WHY: sur la carte, l'inscription dit « Armorique » plutôt que le nom des départements bretons
--      (Uriel, 01/10/2026), comme « Comté de Nice » pour les Alpes-Maritimes (363).
-- SCHEMA CHECKED (01/10/2026) : territoires_historiques(departement text PRIMARY KEY = geo_departements.nom,
--      nom text) ; noms exacts lus dans geo_departements : Côtes-d'Armor, Finistère, Ille-et-Vilaine,
--      Morbihan.

INSERT INTO public.territoires_historiques (departement, nom) VALUES
  ('Finistère', 'Armorique'),
  ('Côtes-d''Armor', 'Armorique'),
  ('Morbihan', 'Armorique'),
  ('Ille-et-Vilaine', 'Armorique')
ON CONFLICT (departement) DO UPDATE SET nom = EXCLUDED.nom;
