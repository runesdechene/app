-- 396 : ce que les filtres de la carte lisent. Annulé.
BEGIN;
\ir ../../migrations/396_filtres_de_carte.sql
DO $test$
DECLARE
  carte json; filtres json; lieu json; mes_ajouts int; avec_natures int; taille int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'cb16ff47-1ead-4adf-8eff-04d117551541', 'role', 'authenticated')::text, true);
  carte := public.carte_lieux();
  filtres := public.filtres_de_carte();
  SELECT x INTO lieu FROM json_array_elements(carte) x WHERE json_array_length(x->'natures') > 1 LIMIT 1;
  SELECT count(*) INTO mes_ajouts FROM json_array_elements(carte) x WHERE (x->>'ajoute')::boolean;
  SELECT count(*) INTO avec_natures FROM json_array_elements(carte) x WHERE json_array_length(x->'natures') > 0;
  taille := length(carte::text);
  RAISE EXCEPTION 'BILAN lieux=% avec_natures=% mes_ajouts=% | exemple natures=% epoque=% | filtres natures=% epoques=% (premiere=% , dernieres=% %) | poids=% Ko',
    json_array_length(carte), avec_natures, mes_ajouts, replace((lieu->'natures')::text, '"', ''), lieu->>'epoque',
    json_array_length(filtres->'natures'), json_array_length(filtres->'epoques'),
    filtres->'epoques'->0->>'nom',
    filtres->'epoques'->(json_array_length(filtres->'epoques') - 2)->>'nom',
    filtres->'epoques'->(json_array_length(filtres->'epoques') - 1)->>'nom',
    taille / 1024;
END $test$;
ROLLBACK;
