-- 358 : chaque lieu du profil est une carte complète. Annulé. Joue 357 d'abord.
BEGIN;
\ir ../../migrations/357_profil_fragments_visibles.sql
\ir ../../migrations/358_profil_cartes_de_lieux.sql
DO $test$
DECLARE
  u text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  carte json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  carte := public.get_profil_explorateur(u) -> 'visites' -> 0;
  RAISE EXCEPTION 'BILAN cles=% categorie=% auteur=% anon_carte=%',
    (SELECT string_agg(k, ',' ORDER BY k) FROM json_object_keys(carte) k),
    carte -> 'categorie' ->> 'couleur', carte -> 'auteur' ->> 'nom',
    has_function_privilege('authenticated', 'public._carte_lieu(text)', 'EXECUTE');
END $test$;
ROLLBACK;
