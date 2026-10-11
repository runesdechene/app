-- 479 : sous une mise à jour, l'équipe voit « Effacer » sur chaque mot. Annulé.
BEGIN;
\ir ../../migrations/479_effacer_par_l_equipe.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';   -- admin (équipe)
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';   -- un Explorateur sans rôle
  note bigint; m_a bigint; m_b bigint;
  vu_par_a json; vu_par_b json;
BEGIN
  INSERT INTO mises_a_jour (titre, texte, par) VALUES ('Essai', 'Un texte.', a) RETURNING id INTO note;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  m_a := (public.ecrire_sous_mise_a_jour(note, 'Le mot de l’équipe.')->>'id')::bigint;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  m_b := (public.ecrire_sous_mise_a_jour(note, 'Le mot du joueur.')->>'id')::bigint;
  vu_par_b := public.carnet_de_mise_a_jour(note);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  vu_par_a := public.carnet_de_mise_a_jour(note);

  RAISE EXCEPTION 'BILAN b_sur_son_mot=% (attendu true) b_sur_celui_de_a=% (attendu false) a_sur_celui_de_b=% (attendu true) a_aMoi_sur_b=% (attendu false)',
    (SELECT j->>'peutEffacer' FROM json_array_elements(vu_par_b->'mots') j WHERE (j->>'id')::bigint = m_b),
    (SELECT j->>'peutEffacer' FROM json_array_elements(vu_par_b->'mots') j WHERE (j->>'id')::bigint = m_a),
    (SELECT j->>'peutEffacer' FROM json_array_elements(vu_par_a->'mots') j WHERE (j->>'id')::bigint = m_b),
    (SELECT j->>'aMoi' FROM json_array_elements(vu_par_a->'mots') j WHERE (j->>'id')::bigint = m_b);
END $test$;
ROLLBACK;
