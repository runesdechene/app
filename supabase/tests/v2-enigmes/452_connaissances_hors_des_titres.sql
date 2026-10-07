-- 452 : les titres de connaissance ne se portent plus, quittent « Tous les titres » et deviennent
-- des gélules du profil ; la page d'une culture dit le grade et ce qui manque. Annulé.
BEGIN;
\ir ../../migrations/452_connaissances_hors_des_titres.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_connaissance int := (SELECT k.title_id FROM titres_connaissance k WHERE k.user_id = 'cb16ff47-1ead-4adf-8eff-04d117551541' LIMIT 1);
  v_erreur text; m json; p json; c json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  ASSERT NOT EXISTS (SELECT 1 FROM json_array_elements(public.get_user_titles(v_moi)->'unlockedGeneralTitles') x
                      JOIN titles t ON t.id = (x->>'id')::int WHERE t.condition->>'stat' IN ('connaissance', 'polymathe')),
         'plus aucun titre de connaissance parmi les titres';
  BEGIN PERFORM public.set_my_displayed_titles(ARRAY[v_connaissance]); v_erreur := 'porté';
  EXCEPTION WHEN OTHERS THEN v_erreur := SQLSTATE; END;
  ASSERT v_erreur = '42501', 'on ne peut plus le porter : ' || v_erreur;
  m := public.get_mes_titres();
  ASSERT json_array_length(m->'cultures') = 0 AND m->'polymathe' IS NULL OR json_typeof(m->'polymathe') = 'null', '« Tous les titres » sans connaissances (clés gardées)';
  p := public.get_profil_explorateur(v_moi);
  ASSERT json_array_length(p->'connaissances') > 0, 'des gélules sur le profil';
  ASSERT (SELECT bool_and((g->>'rang')::int BETWEEN 1 AND 7 AND g->>'titre' IS NOT NULL AND (g->>'enigmes')::int > 0
                          AND g->'culture'->>'id' IS NOT NULL) FROM json_array_elements(p->'connaissances') g), 'chacune complète';
  ASSERT (p->'connaissances'->0->>'rang')::int >= (p->'connaissances'->-1->>'rang')::int, 'la plus haute en tête';
  c := public.mes_enigmes_culture('byzantine');
  ASSERT (c->'grade'->>'rang')::int BETWEEN 1 AND 7, 'le grade dans la culture';
  ASSERT c->'prochain' IS NULL OR json_typeof(c->'prochain') = 'null'
      OR ((c->'prochain'->>'rang')::int = (c->'grade'->>'rang')::int + 1 AND (c->'prochain'->>'manque')::int >= 1), 'le suivant et ce qui manque';
  ASSERT NOT EXISTS (SELECT 1 FROM users WHERE displayed_title_ids_v3 && ARRAY(SELECT id FROM titles WHERE condition->>'stat' IN ('connaissance', 'polymathe'))),
         'plus personne ne les porte';
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
