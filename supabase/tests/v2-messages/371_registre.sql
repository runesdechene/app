-- 371 : le Registre (lire, écrire). Annulé.
BEGIN;
\ir ../../migrations/371_registre.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  avant int; ecrit json; dernier json; bugs_seul text; canal_faux text; vide text; anonyme int;
BEGIN
  -- Sans connexion : rien.
  PERFORM set_config('request.jwt.claims', '{}', true);
  anonyme := json_array_length(public.registre());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  avant := json_array_length(public.registre());
  ecrit := public.ecrire_au_registre('general', '  Il y a du monde ici bas ?  ');
  dernier := (SELECT m FROM json_array_elements(public.registre()) m ORDER BY (m->>'id')::bigint DESC LIMIT 1);
  bugs_seul := (SELECT string_agg(DISTINCT m->>'canal', ',') FROM json_array_elements(public.registre(ARRAY['bugs'])) m);
  BEGIN PERFORM public.ecrire_au_registre('faction-byzantine', 'coucou'); canal_faux := 'accepté';
  EXCEPTION WHEN others THEN canal_faux := SQLERRM; END;
  BEGIN PERFORM public.ecrire_au_registre('general', '   '); vide := 'accepté';
  EXCEPTION WHEN others THEN vide := SQLERRM; END;

  RAISE EXCEPTION 'BILAN anonyme=% avant=% dernier=% bugs_seul=% canal_faux=% vide=% nom_colonne=%',
    anonyme, avant, dernier, bugs_seul, canal_faux, vide,
    (SELECT user_name FROM chat_messages WHERE id = (ecrit->>'id')::bigint);
END $test$;
ROLLBACK;
