-- 480 : chaque mise à jour dit si je l'ai déjà lue (la cloche ouverte après sa parution). Annulé.
BEGIN;
\ir ../../migrations/480_nouveaute_lue.sql
DO $test$
DECLARE
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  ancienne bigint; nouvelle bigint; liste json;
BEGIN
  INSERT INTO mises_a_jour (titre, texte, par, publiee_le) VALUES ('Ancienne', 'x', b, now() - interval '3 days') RETURNING id INTO ancienne;
  INSERT INTO mises_a_jour (titre, texte, par, publiee_le) VALUES ('Nouvelle', 'x', b, now()) RETURNING id INTO nouvelle;
  INSERT INTO nouveautes_vues (user_id, vue_le) VALUES (b, now() - interval '1 day')
    ON CONFLICT (user_id) DO UPDATE SET vue_le = excluded.vue_le;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  liste := public.mises_a_jour_publiees();
  RAISE EXCEPTION 'BILAN ancienne_lue=% (attendu true) nouvelle_lue=% (attendu false)',
    (SELECT j->>'lue' FROM json_array_elements(liste) j WHERE (j->>'id')::bigint = ancienne),
    (SELECT j->>'lue' FROM json_array_elements(liste) j WHERE (j->>'id')::bigint = nouvelle);
END $test$;
ROLLBACK;
