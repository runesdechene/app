-- 356 : trois titres de jeu avec leur condition ; le signe d'un Fragment possédé. Annulé.
BEGIN;
\ir ../../migrations/356_trois_titres_et_signe.sql
DO $test$
DECLARE
  b text := 'd22c0729-67eb-45eb-9dab-2e6c1d19b331';
  a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  debloques int[]; g4 int[]; possede int; etranger int;
  profil json; quatre text := 'non'; etranger_refuse text := 'non'; signe_vu_par_a json;
  signe_perdu json; anon_peut boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  -- Trois titres de jeu débloqués (on force les niveaux en débloquant par XP haute).
  UPDATE users SET xp_total = 10000000 WHERE id = b;
  SELECT array_agg((t->>'id')::int) INTO debloques
    FROM json_array_elements(public.get_user_titles(b) -> 'unlockedGeneralTitles') t;
  PERFORM public.set_my_displayed_titles(debloques[1:3]);
  SELECT array_agg(id) INTO g4 FROM (SELECT id FROM titles WHERE type = 'general' LIMIT 4) s;
  BEGIN PERFORM public.set_my_displayed_titles(g4);
  EXCEPTION WHEN invalid_parameter_value THEN quatre := 'refuses'; END;

  -- Le signe : un Fragment possédé, puis un Fragment qu'on n'a pas.
  SELECT id INTO possede FROM title_fragments WHERE visible ORDER BY id LIMIT 1;
  SELECT id INTO etranger FROM title_fragments WHERE visible AND id <> possede ORDER BY id LIMIT 1;
  DELETE FROM user_fragments WHERE user_id = b;
  INSERT INTO user_fragments (user_id, fragment_id, unlocked_at, source) VALUES (b, possede, now(), 'manual');
  PERFORM public.set_my_signe(possede);
  BEGIN PERFORM public.set_my_signe(etranger);
  EXCEPTION WHEN insufficient_privilege THEN etranger_refuse := 'refuse'; END;

  profil := public.get_profil_explorateur(b);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  signe_vu_par_a := public.get_profil_explorateur(b) -> 'signe';

  -- Un signe dont on ne possède plus le Fragment ne s'affiche plus.
  DELETE FROM user_fragments WHERE user_id = b;
  signe_perdu := public.get_profil_explorateur(b) -> 'signe';
  anon_peut := has_function_privilege('anon', 'public.set_my_signe(integer)', 'EXECUTE');

  RAISE EXCEPTION 'BILAN nb_titres=% condition_1=% quatre=% signe=% etranger=% signe_vu_par_a=% signe_perdu=% anon_peut=%',
    json_array_length(profil -> 'titres'), profil -> 'titres' -> 0 -> 'condition', quatre,
    profil -> 'signe' ->> 'nom', etranger_refuse, signe_vu_par_a ->> 'nom', signe_perdu, anon_peut;
END $test$;
ROLLBACK;
