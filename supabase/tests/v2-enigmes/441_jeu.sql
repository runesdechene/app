-- 441 : le jeu — en attente, ouvrir, percer (juste, faux, deux fois), titres, rattrapage V1. Annulé.
BEGIN;
\ir ../../migrations/440_enigmes_socle.sql
\ir ../../migrations/441_enigmes_jeu.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_attente json; v_eveil bigint; v_eveil2 bigint; v_ouvert json; v_bonne text; v_res json; v_faux json;
  v_double text := 'non'; v_fuite text; v_titres int; v_anon text := 'non'; v_hub text := 'non';
  v_normal json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  v_attente := public.enigmes_en_attente();
  -- la liste ne dit que la place
  SELECT string_agg(k, ',') INTO v_fuite FROM json_object_keys(v_attente->0) k;
  v_eveil := (v_attente->0->>'id')::bigint;
  v_eveil2 := (v_attente->1->>'id')::bigint;
  v_ouvert := public.ouvrir_enigme(v_eveil);
  SELECT e.answer INTO v_bonne FROM enigmes_eveillees w JOIN enigmas e ON e.id = w.enigma_id WHERE w.id = v_eveil;
  -- juste, écrit en minuscules : la comparaison normalise
  v_res := public.percer_enigme(v_eveil, lower(v_bonne));
  -- une deuxième réponse au même éveil est refusée
  BEGIN
    PERFORM public.percer_enigme(v_eveil, v_bonne);
  EXCEPTION WHEN OTHERS THEN v_double := SQLERRM;
  END;
  -- une réponse fausse : pas de points, l'explication quand même
  v_faux := public.percer_enigme(v_eveil2, 'certainement pas la bonne réponse');
  SELECT count(*) INTO v_titres FROM titres_connaissance WHERE user_id = v_moi;
  -- sans compte : refusé
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.enigmes_en_attente();
    PERFORM public.ouvrir_enigme(v_eveil);
  EXCEPTION WHEN OTHERS THEN v_anon := SQLSTATE;
  END;
  -- le Hub est réservé aux admins : essayé avec un compte qui ne l'est pas (le compte de test l'est)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',
    (SELECT id FROM users WHERE role IS DISTINCT FROM 'admin' LIMIT 1), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.cultures_du_hub();
  EXCEPTION WHEN OTHERS THEN v_hub := SQLSTATE;
  END;
  RAISE EXCEPTION 'BILAN cles=% culture=% juste=% xp=% gagnes=% points>0=% titres_juste=% | double=% | faux_juste=% faux_gagnes=% faux_explication=% | titres_en_base=% | anon=% hub=% | titres_culture=% polymathe=%',
    v_fuite, v_ouvert->'culture'->>'nom', v_res->>'juste', v_res->>'xp', v_res->>'gagnes',
    (v_res->>'points')::int > 0, v_res->'nouveauxTitres', v_double,
    v_faux->>'juste', v_faux->>'gagnes', length(v_faux->>'explication') > 0, v_titres,
    v_anon, v_hub,
    (SELECT count(*) FROM titles WHERE condition->>'stat' = 'connaissance'),
    (SELECT count(*) FROM titles WHERE condition->>'stat' = 'polymathe');
END $test$;
ROLLBACK;
