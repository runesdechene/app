-- WHY: Uriel, 24/10 : l'Empire romain et l'Empire byzantin ne font plus qu'une réponse, « L'Empire romain
--      d'Orient et d'Occident », sous la clé rome ; la clé byzance sort de la liste.
-- SCHEMA CHECKED (24/10/2026, live) : aucun portrait ne porte byzance (0) ; contrainte de la 558.

ALTER TABLE public.portraits DROP CONSTRAINT portraits_epoques_check;
ALTER TABLE public.portraits ADD CONSTRAINT portraits_epoques_check CHECK (cardinality(epoques) <= 2
  AND epoques <@ ARRAY['egypte', 'grece', 'rome', 'celtes', 'scandinavie', 'amazigh', 'slave', 'moyen_age',
    'napoleon', 'jules_verne', 'totems', 'autre']);
