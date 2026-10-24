-- WHY: Uriel, 24/10 : « Mes lieux en couleur » devient le réglage par défaut. Avec la carte inversée
--      (ce qui reste à faire à l'encre, le visité en clair), les lieux visités prennent la couleur de
--      leur type. Les comptes existants passent aussi en couleur : la colonne valait `false` par
--      défaut, on ne distingue pas un refus d'un réglage jamais touché ; chacun peut l'éteindre dans
--      ses Préférences.
-- SCHEMA CHECKED (24/10/2026) : users.lieux_en_couleur boolean NOT NULL DEFAULT false (mig 363).

ALTER TABLE public.users ALTER COLUMN lieux_en_couleur SET DEFAULT true;

UPDATE public.users SET lieux_en_couleur = true WHERE lieux_en_couleur = false;
