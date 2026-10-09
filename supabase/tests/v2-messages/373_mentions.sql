-- 373 : mentionner avec @. Annulé.
BEGIN;
\ir ../../migrations/373_mentions.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  b text; nom_b text; trouves json; ecrit json; dernier json; faux text; vu_par_b json;
BEGIN
  SELECT id, user_public_name(id, display_name, first_name) INTO b, nom_b
  FROM users WHERE id <> a AND id ~ '^[0-9a-f-]{36}$' AND is_active IS NOT FALSE
    AND user_public_name(id, display_name, first_name) IS NOT NULL ORDER BY created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  trouves := public.chercher_explorateurs(left(nom_b, 3));
  -- B mentionné pour de vrai ; un identifiant inventé et soi-même sont ignorés.
  ecrit := public.ecrire_au_registre('general', '@' || nom_b || ', tu passes samedi ?', ARRAY[b, 'nexiste-pas', a]);
  dernier := (SELECT x FROM json_array_elements(public.registre()) x ORDER BY (x->>'id')::bigint DESC LIMIT 1);
  -- Une mention dont « @Nom » n'est pas dans le texte n'est pas retenue.
  faux := (public.ecrire_au_registre('general', 'Bonjour à tous', ARRAY[b]))->>'id';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  vu_par_b := (SELECT x FROM json_array_elements(public.registre()) x WHERE (x->>'id')::bigint = (ecrit->>'id')::bigint);

  RAISE EXCEPTION 'BILAN nom_b=% trouve=% mentions=% sans_arobase=% b_se_voit_mentionne=%',
    nom_b, (SELECT bool_or(t->>'id' = b) FROM json_array_elements(trouves) t),
    dernier->'mentions', (SELECT count(*) FROM chat_mentions WHERE message_id = faux::bigint),
    vu_par_b->'mentionneMoi';
END $test$;
ROLLBACK;
