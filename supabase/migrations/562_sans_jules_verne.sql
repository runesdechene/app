-- WHY: Uriel, 24/10 : l'univers de Jules Verne sort des collections proposées.
-- SCHEMA CHECKED (24/10/2026, live) : aucun portrait ne porte jules_verne (0) ; contrainte de la 559.

ALTER TABLE public.portraits DROP CONSTRAINT portraits_epoques_check;
ALTER TABLE public.portraits ADD CONSTRAINT portraits_epoques_check CHECK (cardinality(epoques) <= 2
  AND epoques <@ ARRAY['egypte', 'grece', 'rome', 'celtes', 'scandinavie', 'amazigh', 'slave', 'moyen_age',
    'napoleon', 'totems', 'autre']);
