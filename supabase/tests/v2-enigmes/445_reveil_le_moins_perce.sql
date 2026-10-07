-- 445 : le réveil choisit d'abord l'énigme que le moins de joueurs ont percée. Annulé.
BEGIN;
\ir ../../migrations/445_reveil_le_moins_perce.sql
DO $test$
DECLARE
  v_theme   text := 'celtique';
  v_rare    int;
  v_eveille int;
BEGIN
  -- Toutes les énigmes de la culture comptent au moins une réponse juste fictive, sauf une : la « rare ».
  SELECT e.id INTO v_rare FROM public._enigmes_du_jeu(v_theme) e ORDER BY e.id DESC LIMIT 1;
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct)
  SELECT e.id, u.id, 'test', true
    FROM public._enigmes_du_jeu(v_theme) e
   CROSS JOIN (SELECT id FROM users ORDER BY id LIMIT 3) u
   WHERE e.id <> v_rare
  ON CONFLICT DO NOTHING;
  DELETE FROM enigma_responses WHERE enigma_id = v_rare;
  -- Rien d'éveillé dans la culture : le réveil doit prendre la rare.
  UPDATE enigmes_eveillees SET effacee_le = now() WHERE theme = v_theme AND effacee_le IS NULL;
  PERFORM public._eveiller_enigmes();
  SELECT enigma_id INTO v_eveille FROM enigmes_eveillees
   WHERE theme = v_theme AND effacee_le IS NULL ORDER BY id DESC LIMIT 1;
  ASSERT v_eveille = v_rare, format('le réveil a pris %s au lieu de la moins percée %s', v_eveille, v_rare);
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
