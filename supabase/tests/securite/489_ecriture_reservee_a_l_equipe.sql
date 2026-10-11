-- 489 : un visiteur et un joueur ne peuvent plus écrire ces tables ; l'équipe (admin) si. Annulé.
BEGIN;
\ir ../../migrations/489_ecriture_reservee_a_l_equipe.sql
DO $test$
DECLARE
  admin text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  joueur text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  r text := ''; n int;
BEGIN
  -- Visiteur sans compte.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  BEGIN UPDATE titles SET id = id WHERE id IN (SELECT id FROM titles LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' anon_titles=' || n; EXCEPTION WHEN others THEN r := r || ' anon_titles=refus'; END;
  BEGIN UPDATE tags SET title = title WHERE id IN (SELECT id FROM tags LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' anon_tags=' || n; EXCEPTION WHEN others THEN r := r || ' anon_tags=refus'; END;
  BEGIN INSERT INTO users (id, email_address, role) VALUES ('pirate', 'pirate@exemple.fr', 'admin'); r := r || ' anon_users=CREE'; EXCEPTION WHEN others THEN r := r || ' anon_users=refus'; END;
  BEGIN INSERT INTO user_fragments (user_id, fragment_id) SELECT joueur, id FROM title_fragments LIMIT 1; r := r || ' anon_fragment=CREE'; EXCEPTION WHEN others THEN r := r || ' anon_fragment=refus'; END;
  RESET ROLE;
  -- Un joueur connecté.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', joueur, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE titles SET id = id WHERE id IN (SELECT id FROM titles LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' joueur_titles=' || n; EXCEPTION WHEN others THEN r := r || ' joueur_titles=refus'; END;
  BEGIN INSERT INTO user_fragments (user_id, fragment_id) SELECT joueur, id FROM title_fragments LIMIT 1; r := r || ' joueur_fragment=CREE'; EXCEPTION WHEN others THEN r := r || ' joueur_fragment=refus'; END;
  RESET ROLE;
  -- L'équipe (le Hub).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE titles SET id = id WHERE id IN (SELECT id FROM titles LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' admin_titles=' || n; EXCEPTION WHEN others THEN r := r || ' admin_titles=REFUS'; END;
  BEGIN UPDATE shopify_unlocks SET id = id WHERE id IN (SELECT id FROM shopify_unlocks LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' admin_unlocks=' || n; EXCEPTION WHEN others THEN r := r || ' admin_unlocks=REFUS'; END;
  BEGIN SELECT count(*) INTO n FROM user_fragments; r := r || ' admin_lit_fragments=' || n; EXCEPTION WHEN others THEN r := r || ' admin_lit=REFUS'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN%  (attendu : anon et joueur à 0 ou refus, admin à 1, admin lit tous les fragments)', r;
END $test$;
ROLLBACK;
