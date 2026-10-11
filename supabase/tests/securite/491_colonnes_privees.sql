-- 491 : un joueur ne lit plus le code postal des autres ; le nom reste public ; l'équipe garde
--       ses droits sur tags (politique qui lit users.role). Annulé.
BEGIN;
\ir ../../migrations/491_colonnes_privees.sql
DO $test$
DECLARE r text := ''; n int; t text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '10e4c7d5-7f09-4bdf-8a47-c44db83a196f', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN SELECT count(location_zip) INTO n FROM users; r := r || ' code_postal=LU'; EXCEPTION WHEN others THEN r := r || ' code_postal=refus'; END;
  BEGIN SELECT count(shopify_customer_id) INTO n FROM users; r := r || ' shopify=LU'; EXCEPTION WHEN others THEN r := r || ' shopify=refus'; END;
  BEGIN SELECT display_name INTO t FROM users WHERE display_name IS NOT NULL LIMIT 1; r := r || ' nom=lu'; EXCEPTION WHEN others THEN r := r || ' nom=REFUS'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'cb16ff47-1ead-4adf-8eff-04d117551541', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE tags SET title = title WHERE id IN (SELECT id FROM tags LIMIT 1); GET DIAGNOSTICS n = ROW_COUNT; r := r || ' admin_tags=' || n; EXCEPTION WHEN others THEN r := r || ' admin_tags=REFUS'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN% (attendu : refus, refus, nom lu, admin_tags=1)', r;
END $test$;
ROLLBACK;
