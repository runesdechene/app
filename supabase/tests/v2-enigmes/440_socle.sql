-- 440 : le socle des énigmes — réveil, plafond de 7, points dans les cercles, 1 XP. Annulé.
BEGIN;
\ir ../../migrations/440_enigmes_socle.sql
DO $test$
DECLARE
  v_eveils int; v_max_par_culture int; v_hors int; v_paliers int; v_lu int; v_xp_avant int; v_xp_apres int;
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; v_enigme int;
BEGIN
  -- dix réveils : jamais plus de 7 en attente par culture
  PERFORM public._eveiller_enigmes() FROM generate_series(1, 10);
  SELECT count(*) INTO v_eveils FROM enigmes_eveillees WHERE effacee_le IS NULL;
  SELECT max(n) INTO v_max_par_culture FROM (SELECT count(*) n FROM enigmes_eveillees WHERE effacee_le IS NULL GROUP BY theme) x;
  -- chaque point tombe dans un des cercles de sa culture (tolérance 1 km)
  SELECT count(*) INTO v_hors FROM enigmes_eveillees w JOIN enigma_themes t ON t.id = w.theme
   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.cercles) c
     WHERE 111.32 * sqrt(power(w.lat - (c->>'lat')::float8, 2)
                       + power((w.lng - (c->>'lng')::float8) * cos(radians((c->>'lat')::float8)), 2))
           <= (c->>'rayon_km')::float8 + 1);
  SELECT count(*) INTO v_paliers FROM paliers_connaissance;
  -- un compte connecté ne lit rien directement dans les éveils
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_lu FROM enigmes_eveillees;
  RESET ROLE;
  -- une énigme juste (même difficile) donne 1 XP
  SELECT id INTO v_enigme FROM enigmas WHERE difficulty = 'hard' AND theme IS NOT NULL LIMIT 1;
  SELECT xp_total INTO v_xp_avant FROM users WHERE id = v_moi;
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (v_enigme, v_moi, 'test', true, 0, 0);
  SELECT xp_total INTO v_xp_apres FROM users WHERE id = v_moi;
  RAISE EXCEPTION 'BILAN eveils=% max_par_culture=% hors_cercle=% paliers=% lu_en_direct=% xp=%',
    v_eveils, v_max_par_culture, v_hors, v_paliers, v_lu, v_xp_apres - v_xp_avant;
END $test$;
ROLLBACK;
