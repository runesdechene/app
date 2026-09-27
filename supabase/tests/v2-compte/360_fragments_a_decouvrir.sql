-- 360 : le nombre de Fragments à découvrir, pour soi seulement. Annulé.
BEGIN;
\ir ../../migrations/360_profil_fragments_a_decouvrir.sql
DO $test$
DECLARE u text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f'; soi json; autre json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  soi := public.get_profil_explorateur(u);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  autre := public.get_profil_explorateur(u);
  RAISE EXCEPTION 'BILAN possedes=% a_decouvrir_soi=% visibles=% a_decouvrir_vu_par_autre=%',
    json_array_length(soi -> 'fragments'), soi ->> 'fragmentsADecouvrir',
    (SELECT count(*) FROM title_fragments WHERE visible), autre -> 'fragmentsADecouvrir';
END $test$;
ROLLBACK;
