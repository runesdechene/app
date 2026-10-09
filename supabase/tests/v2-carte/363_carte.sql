-- 363 : la carte d'Explore. Annulé.
BEGIN;
\ir ../../migrations/363_carte_explore.sql
SELECT set_config('request.jwt.claims', json_build_object('sub','cb16ff47-1ead-4adf-8eff-04d117551541','role','authenticated')::text, true);
DO $test$
DECLARE c json; vu int; connus int; prive_autre int; visibles int; revend int;
BEGIN
  c := public.carte_lieux();
  SELECT count(*) INTO vu FROM json_array_elements(c) e WHERE e->>'etat' = 'visite';
  SELECT count(*) INTO connus FROM json_array_elements(c) e WHERE e->>'etat' = 'connu';
  SELECT count(*) INTO revend FROM json_array_elements(c) e WHERE e->'revendication' IS NOT NULL AND e->>'revendication' <> 'null';
  SELECT count(*) INTO prive_autre FROM json_array_elements(c) e JOIN places p ON p.id = e->>'id'
   WHERE (p.private OR p.masked) AND p.author_id <> 'cb16ff47-1ead-4adf-8eff-04d117551541';
  SELECT count(*) INTO visibles FROM places
   WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     AND ((masked IS NOT TRUE AND private IS NOT TRUE) OR author_id = 'cb16ff47-1ead-4adf-8eff-04d117551541');
  RAISE EXCEPTION 'BILAN lieux=%/% visites=% connus=% revendiques=% prives_autres=% nice=% mer=% pref=% exemple=%',
    json_array_length(c), visibles, vu, connus, revend, prive_autre,
    public.territoire_en(43.70, 7.26), public.territoire_en(43.4, 7.4),
    public.get_my_preferences() -> 'lieuxEnCouleur',
    (SELECT e FROM json_array_elements(c) e WHERE e->>'etat' = 'visite' LIMIT 1);
END $test$;
ROLLBACK;
