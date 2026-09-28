-- 368 : l'Accueil (nouveauté, ajoutés, sur les chemins, saluer). Annulé.
BEGIN;
\ir ../../migrations/368_accueil.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  nouveaute json; ajoutes json; chemins json;
  autre json; mien json; s1 json; s2 json; soi text; faux text;
  masque_visible int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  nouveaute := public.accueil_nouveaute();
  ajoutes := public.accueil_ajoutes(3);
  chemins := public.sur_les_chemins(20);

  -- Aucun lieu masqué ni privé dans le fil.
  SELECT count(*) INTO masque_visible FROM json_array_elements(chemins) c
    JOIN places p ON p.id = c->'lieu'->>'id' WHERE p.masked OR p.private;

  -- Saluer la ligne de quelqu'un d'autre, puis retirer son salut.
  SELECT c INTO autre FROM json_array_elements(chemins) c WHERE c->'qui'->>'id' <> a LIMIT 1;
  s1 := public.saluer(autre->>'id');
  s2 := public.saluer(autre->>'id');

  -- Se saluer soi-même, ou saluer une ligne inventée : refusé.
  BEGIN PERFORM public.saluer('arrivee:' || a); soi := 'accepté';
  EXCEPTION WHEN others THEN soi := SQLERRM; END;
  BEGIN PERFORM public.saluer('visite:nexiste-pas:' || a); faux := 'accepté';
  EXCEPTION WHEN others THEN faux := SQLERRM; END;

  RAISE EXCEPTION 'BILAN nouveaute=% ajoutes=% nb_chemins=% types=% masques=% premier=% salut=% retrait=% soi=% faux=%',
    nouveaute->>'titre', json_array_length(ajoutes), json_array_length(chemins),
    (SELECT string_agg(DISTINCT c->>'type', ',') FROM json_array_elements(chemins) c),
    masque_visible, chemins->0, s1, s2, soi, faux;
END $test$;
ROLLBACK;
