-- WHY: Uriel, 25/10 : la « Carte Skyrim » devient le réglage par défaut, pour tout le monde (les
--      visiteurs sans compte aussi, côté appli). Comme la 563 pour les couleurs : la colonne valait
--      `false` par défaut depuis la 565 (le matin même), on ne distingue pas un refus d'un réglage
--      jamais touché ; chacun peut l'éteindre dans ses Préférences.
-- SCHEMA CHECKED (25/10/2026) : users.carte_skyrim boolean NOT NULL DEFAULT false (mig 565).

ALTER TABLE public.users ALTER COLUMN carte_skyrim SET DEFAULT true;

UPDATE public.users SET carte_skyrim = true WHERE carte_skyrim = false;
