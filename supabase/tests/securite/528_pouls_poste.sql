-- 528 + 529 : les deux fonctions internes du pouls restent fermées à tout le monde — service_role
-- compris depuis que la 529 a repris son grant, la fonction edge `pouls` étant retirée ;
-- hub_ouverture reste ouverte aux connectés et fermée à anon. Annulé.
BEGIN;
\ir ../../migrations/528_pouls_poste.sql
\ir ../../migrations/529_pouls_poste_ferme.sql
DO $test$
DECLARE r text := '';
  fermer text[] := ARRAY['public._hub_bornes(text)','public._hub_pouls_periode(text)'];
  x text;
BEGIN
  FOREACH x IN ARRAY fermer LOOP
    IF has_function_privilege('anon', x, 'EXECUTE') THEN r := r || ' OUVERT_ANON:' || x; END IF;
    IF has_function_privilege('authenticated', x, 'EXECUTE') THEN r := r || ' OUVERT_CONNECTE:' || x; END IF;
  END LOOP;
  SELECT r || ' serveur_pouls_periode=' || has_function_privilege('service_role', 'public._hub_pouls_periode(text)', 'EXECUTE')
           || ' connecte_hub_ouverture=' || has_function_privilege('authenticated', 'public.hub_ouverture(text)', 'EXECUTE')
           || ' anon_hub_ouverture=' || has_function_privilege('anon', 'public.hub_ouverture(text)', 'EXECUTE')
    INTO r;
  RAISE EXCEPTION 'BILAN% (attendu : rien d''ouvert à tort, serveur_pouls_periode false, connecte_hub_ouverture true, anon_hub_ouverture false)', r;
END $test$;
ROLLBACK;
