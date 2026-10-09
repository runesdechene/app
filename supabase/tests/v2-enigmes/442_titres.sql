-- 442 : les titres de connaissance se lisent partout, accordés. Annulé.
BEGIN;
\ir ../../migrations/440_enigmes_socle.sql
\ir ../../migrations/441_enigmes_jeu.sql
\ir ../../migrations/442_enigmes_titres_accordes.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_titre int; v_mes json; v_user json; v_profil json; v_nom_f text;
BEGIN
  -- le compte obtient « Curieux de Byzance » et le porte, au féminin
  SELECT id INTO v_titre FROM titles WHERE condition->>'stat' = 'connaissance'
     AND condition->>'theme' = 'byzantine' AND (condition->>'palier')::int = 1;
  INSERT INTO titres_connaissance (user_id, title_id) VALUES (v_moi, v_titre) ON CONFLICT DO NOTHING;
  UPDATE users SET title_gender = 'f', displayed_title_ids_v3 = ARRAY[v_titre] WHERE id = v_moi;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  v_mes := public.get_mes_titres();
  v_user := public.get_user_titles(v_moi);
  v_profil := public.get_profil_explorateur(v_moi);
  SELECT e->>'name' INTO v_nom_f FROM json_array_elements(v_user->'unlockedGeneralTitles') e WHERE (e->>'id')::int = v_titre;
  RAISE EXCEPTION 'BILAN cultures=% premiere=% titres_par_culture=% obtenu=% polymathe=% | user_titles=% | profil=% | chemins=%',
    json_array_length(v_mes->'cultures'), v_mes->'cultures'->0->>'nom',
    json_array_length(v_mes->'cultures'->0->'titres'),
    (SELECT bool_or((t->>'obtenu')::boolean) FROM json_array_elements(v_mes->'cultures') c, json_array_elements(c->'titres') t WHERE (t->>'id')::int = v_titre),
    v_mes->'polymathe'->>'nom', v_nom_f, v_profil->'titres'->0->>'nom',
    json_array_length(v_mes->'chemins');
END $test$;
ROLLBACK;
