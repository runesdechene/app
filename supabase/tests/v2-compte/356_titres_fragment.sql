-- 356 : les mots des Fragments possédés se portent ; ceux d'un Fragment qu'on n'a pas, non. Annulé.
BEGIN;
\ir ../../migrations/356_titres_de_fragment_v2.sql
DO $test$
DECLARE
  b text := 'd22c0729-67eb-45eb-9dab-2e6c1d19b331';
  possede int; mot_possede int; mot_etranger int; nom_mot text;
  portables json; titres json; etranger_refuse text := 'non'; quatre_refuses text := 'non';
  anon_peut boolean; g int[];
BEGIN
  SELECT tf.id INTO possede FROM title_fragments tf JOIN fragment_words fw ON fw.fragment_id = tf.id
   WHERE tf.visible ORDER BY tf.id LIMIT 1;
  SELECT fw.id, fw.word INTO mot_possede, nom_mot FROM fragment_words fw WHERE fw.fragment_id = possede ORDER BY fw.id LIMIT 1;
  SELECT fw.id INTO mot_etranger FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
   WHERE fw.fragment_id <> possede AND tf.visible ORDER BY fw.id LIMIT 1;
  DELETE FROM user_fragments WHERE user_id = b;
  INSERT INTO user_fragments (user_id, fragment_id, unlocked_at, source) VALUES (b, possede, now(), 'manual');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  portables := public.get_my_wearable_titles();
  PERFORM public.set_my_displayed_titles(ARRAY[-mot_possede]);
  titres := public.get_profil_explorateur(b) -> 'titres';
  BEGIN PERFORM public.set_my_displayed_titles(ARRAY[-mot_etranger]);
  EXCEPTION WHEN insufficient_privilege THEN etranger_refuse := 'refuse'; END;
  SELECT array_agg(id) INTO g FROM (SELECT id FROM titles WHERE type = 'general' LIMIT 4) s;
  BEGIN PERFORM public.set_my_displayed_titles(g);
  EXCEPTION WHEN invalid_parameter_value THEN quatre_refuses := 'refuses'; END;
  anon_peut := has_function_privilege('anon', 'public.get_my_wearable_titles()', 'EXECUTE');

  RAISE EXCEPTION 'BILAN mot=% dans_portables=% titres_profil=% etranger=% quatre=% anon_peut=%',
    nom_mot,
    EXISTS (SELECT 1 FROM json_array_elements(portables) e WHERE (e->>'id')::int = -mot_possede),
    titres, etranger_refuse, quatre_refuses, anon_peut;
END $test$;
ROLLBACK;
