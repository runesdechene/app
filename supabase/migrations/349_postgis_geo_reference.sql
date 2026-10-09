-- 349 — PostGIS et les contours des départements et des pays
--
-- WHY : la zone Compte affiche « Noble représentant des Alpes-Maritimes » (ou d'un pays hors
-- de France), déduit des visites. Il faut savoir, pour chaque lieu, dans quel département ou
-- pays il se trouve. PostGIS est l'outil standard : on charge les contours une fois, et un
-- déclencheur rattache chaque nouveau lieu à l'insertion — sans aucun appel à un service externe.
-- Extension installée dans le schéma `extensions` (conseil Supabase : pas d'extension dans public).

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.geo_departements (
  code   text PRIMARY KEY,
  nom    text NOT NULL,
  de_nom text NOT NULL,   -- « des Alpes-Maritimes », « de l'Ain » : article officiel INSEE (TNCC)
  geom   extensions.geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_departements_geom_idx ON public.geo_departements USING gist (geom);

CREATE TABLE IF NOT EXISTS public.geo_pays (
  iso2   text PRIMARY KEY,
  nom_fr text NOT NULL,
  geom   extensions.geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_pays_geom_idx ON public.geo_pays USING gist (geom);

-- Données de référence publiques, lues seulement par les fonctions de rattachement.
ALTER TABLE public.geo_departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_pays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_departements, public.geo_pays FROM anon, authenticated;
