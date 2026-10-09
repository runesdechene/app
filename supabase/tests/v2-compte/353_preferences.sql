-- 353 : préférences et titres portés, toujours au nom de l'appelant. Transaction annulée.
BEGIN;
\ir ../../migrations/353_preferences_et_titres_v2.sql
DO $test$
DECLARE
  a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  envies boolean; sans_session json; prefs json;
  cle_inconnue text := 'non'; trois_titres text := 'non'; non_debloque text := 'non';
  debloques int[]; portes int[]; anon_peut boolean;
BEGIN
  -- Sans session : rien à lire, rien à écrire.
  PERFORM set_config('request.jwt.claims', '', true);
  sans_session := public.get_my_preferences();

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.set_my_preference('show_envies', false);
  SELECT show_envies INTO envies FROM users WHERE id = a;
  prefs := public.get_my_preferences();

  BEGIN PERFORM public.set_my_preference('role', true);
  EXCEPTION WHEN invalid_parameter_value THEN cle_inconnue := 'refusee'; END;

  BEGIN PERFORM public.set_my_displayed_titles(ARRAY[1, 2, 3]);
  EXCEPTION WHEN invalid_parameter_value THEN trois_titres := 'refuses'; END;

  BEGIN PERFORM public.set_my_displayed_titles(ARRAY[999999]);
  EXCEPTION WHEN insufficient_privilege THEN non_debloque := 'refuse'; END;

  SELECT COALESCE(array_agg((t->>'id')::int), '{}') INTO debloques
    FROM json_array_elements(public.get_user_titles(a) -> 'unlockedGeneralTitles') t;
  PERFORM public.set_my_displayed_titles(debloques[1:1]);
  SELECT displayed_title_ids_v3 INTO portes FROM users WHERE id = a;

  anon_peut := has_function_privilege('anon', 'public.set_my_preference(text, boolean)', 'EXECUTE');

  RAISE EXCEPTION 'BILAN sans_session=% show_envies=% prefs.showEnvies=% cle_inconnue=% trois_titres=% non_debloque=% portes=% (debloques=%) anon_peut=%',
    sans_session, envies, prefs->>'showEnvies', cle_inconnue, trois_titres, non_debloque, portes, debloques, anon_peut;
END $test$;
ROLLBACK;
