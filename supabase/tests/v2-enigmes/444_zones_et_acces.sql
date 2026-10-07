-- 444 : cercles illimités tirés à égalité, écriture directe fermée, réponses cachées ; et les cas du
-- jeu que 441 ne couvrait pas (éveil effacé, Polymathe, titre acquis, retour au cycle). Annulé.
BEGIN;
\ir ../../migrations/444_enigmes_zones_et_acces.sql
DO $test$
DECLARE
  v_moi    text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_autre  text := (SELECT id FROM users WHERE role IS DISTINCT FROM 'admin' LIMIT 1);
  v_dans_petits int;
  v_eveil  bigint;
  v_enigme int;
  v_erreur text;
  v_lu     int;
  v_titre  int;
  v_avant  int;
BEGIN
  -- 1. Cinq cercles, dont quatre de 5 km : tirés à égalité, les petits reçoivent ~4 points sur 5.
  SELECT count(*) INTO v_dans_petits
    FROM generate_series(1, 400) g,
         LATERAL public._point_dans_les_cercles(
           '[{"lat":60,"lng":10,"rayon_km":800},{"lat":40,"lng":20,"rayon_km":5},{"lat":41,"lng":21,"rayon_km":5},{"lat":42,"lng":22,"rayon_km":5},{"lat":43,"lng":23,"rayon_km":5}]'::jsonb) p
   WHERE p.lat < 45;
  ASSERT v_dans_petits BETWEEN 260 AND 380, format('cercles à égalité : %s / 400 dans les petits', v_dans_petits);

  -- 2. Le Hub accepte six cercles, refuse un rayon de moins de 5 km.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
    '[{"lat":41,"lng":29,"rayon_km":20},{"lat":40,"lng":28,"rayon_km":20},{"lat":39,"lng":27,"rayon_km":20},{"lat":38,"lng":28,"rayon_km":20},{"lat":37,"lng":29,"rayon_km":20},{"lat":36,"lng":30,"rayon_km":20}]'::jsonb,
    true, 0);
  ASSERT (SELECT jsonb_array_length(cercles) FROM enigma_themes WHERE id = 'byzantine') = 6, 'six cercles enregistrés';
  BEGIN
    PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
      '[{"lat":41,"lng":29,"rayon_km":2}]'::jsonb, true, 0);
    v_erreur := 'accepté';
  EXCEPTION WHEN OTHERS THEN v_erreur := 'refusé';
  END;
  ASSERT v_erreur = 'refusé', 'un rayon de 2 km doit être refusé';

  -- 3. Un compte connecté n'écrit plus de réponse directement, et ne lit plus les réponses des énigmes.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_autre, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct) VALUES (1, v_autre, 'x', true);
    v_erreur := 'accepté';
  EXCEPTION WHEN OTHERS THEN v_erreur := 'refusé';
  END;
  SELECT count(*) INTO v_lu FROM enigmas;
  RESET ROLE;
  ASSERT v_erreur = 'refusé', 'insertion directe dans enigma_responses refusée';
  ASSERT v_lu = 0, format('un non-admin lit %s énigmes', v_lu);

  -- 4. Un éveil effacé ne s'ouvre plus.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  v_eveil := (public.enigmes_en_attente()->0->>'id')::bigint;
  UPDATE enigmes_eveillees SET effacee_le = now() WHERE id = v_eveil;
  BEGIN
    PERFORM public.ouvrir_enigme(v_eveil);
    v_erreur := 'ouvert';
  EXCEPTION WHEN OTHERS THEN v_erreur := SQLSTATE;
  END;
  ASSERT v_erreur = 'P0002', 'un éveil effacé doit lever P0002, pas ' || v_erreur;

  -- 5. Une énigme ratée revient au tour suivant : elle redevient la plus ancienne du cycle.
  SELECT enigma_id INTO v_enigme FROM enigmes_eveillees WHERE id = v_eveil;
  UPDATE enigmes_eveillees SET eveillee_le = '2000-01-01' WHERE enigma_id = v_enigme;
  UPDATE enigmes_eveillees SET eveillee_le = now() WHERE enigma_id <> v_enigme
     AND theme = (SELECT theme FROM enigmes_eveillees WHERE id = v_eveil);
  INSERT INTO enigmes_eveillees (enigma_id, theme, lat, lng, eveillee_le)
  SELECT e.id, e.theme, 0, 0, now() FROM public._enigmes_du_jeu((SELECT theme FROM enigmas WHERE id = v_enigme)) e
   WHERE e.id <> v_enigme AND NOT EXISTS (SELECT 1 FROM enigmes_eveillees w WHERE w.enigma_id = e.id);
  UPDATE enigmes_eveillees SET effacee_le = now() WHERE effacee_le IS NULL;
  PERFORM public._eveiller_enigmes();
  ASSERT EXISTS (SELECT 1 FROM enigmes_eveillees WHERE enigma_id = v_enigme AND effacee_le IS NULL),
    'l''énigme la plus ancienne du cycle doit se réveiller';

  -- 6. Polymathe : Sage dans trois cultures.
  DELETE FROM titres_connaissance WHERE user_id = v_autre;
  INSERT INTO titres_connaissance (user_id, title_id)
  SELECT v_autre, id FROM titles WHERE condition->>'stat' = 'connaissance' AND (condition->>'palier')::int = 6
     AND condition->>'theme' IN ('nordique', 'romaine', 'grecque');
  PERFORM public._attribuer_titres_connaissance(v_autre, 'nordique');
  ASSERT EXISTS (SELECT 1 FROM titres_connaissance c JOIN titles t ON t.id = c.title_id
                  WHERE c.user_id = v_autre AND t.condition->>'stat' = 'polymathe'), 'Polymathe attribué';

  -- 7. Un titre obtenu reste acquis quand le total monte (seuil plus haut).
  SELECT id INTO v_titre FROM titles WHERE condition->>'theme' = 'celtique' AND (condition->>'palier')::int = 3;
  INSERT INTO titres_connaissance (user_id, title_id) VALUES (v_autre, v_titre) ON CONFLICT DO NOTHING;
  v_avant := public._seuil_connaissance('celtique', 3);
  INSERT INTO enigmas (type, difficulty, theme, lore_text, question, format, answer, explanation, active)
  SELECT 'daily', 'hard', 'celtique', 'r', 'q', 'free', 'a', 'e', true FROM generate_series(1, 300);
  ASSERT public._seuil_connaissance('celtique', 3) > v_avant, 'le seuil monte avec le total';
  PERFORM public._attribuer_titres_connaissance(v_autre, 'celtique');
  ASSERT EXISTS (SELECT 1 FROM titres_connaissance WHERE user_id = v_autre AND title_id = v_titre),
    'le titre reste acquis';

  RAISE EXCEPTION 'BILAN tout passe (petits=%/400)', v_dans_petits;
END $test$;
ROLLBACK;
