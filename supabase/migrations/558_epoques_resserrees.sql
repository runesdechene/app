-- WHY: Uriel, 24/10 : « Les esprits de la nature » deviennent « Les totems animaliers » (clé totems), et
--      cinq époques de la 557 sortent de la liste : l'Écosse médiévale, la Renaissance, les grands
--      explorateurs, la Belle Époque, la Première Guerre mondiale.
-- SCHEMA CHECKED (24/10/2026, live) : aucun portrait ne porte nature ni l'une des cinq clés retirées (0) ;
--      la contrainte portraits_epoques_check est celle de la 557.

ALTER TABLE public.portraits DROP CONSTRAINT portraits_epoques_check;
ALTER TABLE public.portraits ADD CONSTRAINT portraits_epoques_check CHECK (cardinality(epoques) <= 2
  AND epoques <@ ARRAY['egypte', 'grece', 'rome', 'celtes', 'byzance', 'scandinavie', 'amazigh', 'slave', 'moyen_age',
    'napoleon', 'jules_verne', 'totems', 'autre']);
