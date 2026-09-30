-- 391 : la vitrine publique (sans compte). Annulé.
BEGIN;
\ir ../../migrations/391_vitrine_publique.sql
DO $test$
DECLARE
  natures json; dolm json; chateaux json; activite json; apercu json; masque text; apercu_masque json;
  refus text := '';
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  natures := public.natures_publiques();
  dolm := public.recherche_publique('DOLM', NULL, 5);
  chateaux := public.recherche_publique(NULL, (natures->0->>'id'), 3);
  activite := public.activite_publique(5);
  apercu := public.apercu_lieu((dolm->'lieux'->0->>'id'));
  PERFORM set_config('role', 'postgres', true);
  SELECT id INTO masque FROM places WHERE masked IS TRUE LIMIT 1;
  PERFORM set_config('role', 'anon', true);
  apercu_masque := public.apercu_lieu(masque);
  BEGIN PERFORM public.carte_lieux(); refus := 'carte-ouverte-a-anon'; EXCEPTION WHEN others THEN refus := 'carte fermée aux visiteurs'; END;
  RAISE EXCEPTION 'BILAN natures=% premiere=% | dolm total=% lieux=% natures=% | nature0 total=% | activite=% | apercu=% | masque=% | %',
    json_array_length(natures), natures->0->>'nom',
    dolm->>'total', (SELECT string_agg(x->>'nom', ', ') FROM json_array_elements(dolm->'lieux') x), dolm->'natures',
    chateaux->>'total', left(activite::text, 200), left(apercu::text, 400), apercu_masque, refus;
END $test$;
ROLLBACK;
