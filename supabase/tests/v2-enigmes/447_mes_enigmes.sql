-- 447 : ses énigmes résolues, par culture ; la phrase de zone. Annulé.
BEGIN;
\ir ../../migrations/447_mes_enigmes.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_neuf text := (SELECT id FROM users u WHERE u.id ~ '^[0-9a-f-]{36}$' AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.user_id = u.id) LIMIT 1);
  m json; c json; v_erreur text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  m := public.mes_enigmes();
  ASSERT (m->>'total')::int = (SELECT sum((x->>'total')::int) FROM json_array_elements(m->'cultures') x), 'total = somme des cultures';
  ASSERT (m->>'resolues')::int > 0, 'le compte de test a des énigmes résolues';
  c := public.mes_enigmes_culture('celtique');
  ASSERT json_array_length(c->'enigmes') = (c->>'resolues')::int, 'une énigme listée par énigme résolue';
  ASSERT c->'centre'->>'lat' IS NOT NULL, 'une culture avec cercles a un centre';
  ASSERT (c->'enigmes'->0->>'le')::timestamptz >= (c->'enigmes'->1->>'le')::timestamptz, 'la plus récente en tête';
  -- Une culture inactive n'apparaît pas et ne s'ouvre pas.
  UPDATE enigma_themes SET active = false WHERE id = 'romaine';
  ASSERT NOT EXISTS (SELECT 1 FROM json_array_elements(public.mes_enigmes()->'cultures') x WHERE x->>'id' = 'romaine'), 'culture inactive absente';
  BEGIN PERFORM public.mes_enigmes_culture('romaine'); v_erreur := 'ouverte';
  EXCEPTION WHEN OTHERS THEN v_erreur := SQLSTATE; END;
  ASSERT v_erreur = 'P0002', 'culture inactive : P0002, pas ' || v_erreur;
  -- Un compte neuf : zéro partout.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_neuf, 'role', 'authenticated')::text, true);
  ASSERT (public.mes_enigmes()->>'resolues')::int = 0, 'compte neuf : 0 résolue';
  -- La phrase de zone s'enregistre (le compte de test est admin) et l'ancien appel à 8 paramètres marche encore.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
    (SELECT cercles FROM enigma_themes WHERE id = 'byzantine'), true, 0, 'entre la Thrace et l’Asie Mineure');
  ASSERT (SELECT zone FROM enigma_themes WHERE id = 'byzantine') = 'entre la Thrace et l’Asie Mineure', 'zone enregistrée';
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
    (SELECT cercles FROM enigma_themes WHERE id = 'byzantine'), true, 0);
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
