-- 372 : les Murmures (écrire, boîte de réception, conversation, lu, règles d'accès). Annulé.
BEGIN;
\ir ../../migrations/372_murmures.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  b text; c text;
  boite_b json; conv json; lus int; boite_b_apres json; soi text; vide text;
  vus_par_c int; fiche_a json;
BEGIN
  SELECT id INTO b FROM users WHERE id <> a AND id ~ '^[0-9a-f-]{36}$' ORDER BY created_at LIMIT 1;
  SELECT id INTO c FROM users WHERE id NOT IN (a, b) AND id ~ '^[0-9a-f-]{36}$' ORDER BY created_at LIMIT 1;

  -- A murmure deux fois à B ; B répond une fois.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.murmurer(b, 'Salut, tu passes au menhir ?');
  PERFORM public.murmurer(b, '  Samedi, 10 h ?  ');
  BEGIN PERFORM public.murmurer(a, 'moi'); soi := 'accepté';
  EXCEPTION WHEN others THEN soi := SQLERRM; END;
  BEGIN PERFORM public.murmurer(b, '   '); vide := 'accepté';
  EXCEPTION WHEN others THEN vide := SQLERRM; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  boite_b := public.mes_murmures();
  conv := public.conversation(a);
  lus := public.lire_murmures(a);
  fiche_a := public.correspondant(a);
  PERFORM public.murmurer(a, 'Oui !');
  boite_b_apres := public.mes_murmures();

  -- C ne voit rien de la conversation A-B (la règle d'accès de la table).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO vus_par_c FROM murmures;
  RESET ROLE;

  RAISE EXCEPTION 'BILAN soi=% vide=% boite_b=% nb_conv=% dernier=% lus=% boite_b_apres_nonlus=% vus_par_c=% correspondant=%',
    soi, vide, boite_b->0->'nonLus', json_array_length(conv), conv->1->>'texte', lus,
    boite_b_apres->0->'nonLus', vus_par_c, fiche_a;
END $test$;
ROLLBACK;
