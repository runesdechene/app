-- 450 : le portrait d'une culture ; un Hub sans lui (ni zone) ne les efface plus. Annulé.
BEGIN;
\ir ../../migrations/450_presentation_des_cultures.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; -- admin
  v_cercles jsonb := (SELECT cercles FROM enigma_themes WHERE id = 'byzantine');
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  ASSERT public.mes_enigmes_culture('byzantine')->'culture'->>'presentation' LIKE 'Pendant mille ans%', 'le portrait pré-rempli se lit';
  ASSERT (SELECT bool_and(x->>'presentation' IS NOT NULL) FROM json_array_elements(public.cultures_du_hub()) x), 'le Hub les voit tous';
  -- Le Hub d'aujourd'hui enregistre la zone et le portrait.
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance', v_cercles, true, 0, 'entre la Thrace et l’Asie Mineure', 'Un portrait.');
  ASSERT (SELECT presentation FROM enigma_themes WHERE id = 'byzantine') = 'Un portrait.', 'portrait enregistré';
  -- Un Hub plus ancien, sans zone ni portrait : rien ne s'efface.
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance', v_cercles, true, 0);
  ASSERT (SELECT zone FROM enigma_themes WHERE id = 'byzantine') = 'entre la Thrace et l’Asie Mineure', 'la zone reste';
  ASSERT (SELECT presentation FROM enigma_themes WHERE id = 'byzantine') = 'Un portrait.', 'le portrait reste';
  -- Une chaîne vide les vide.
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance', v_cercles, true, 0, '', '');
  ASSERT (SELECT zone IS NULL AND presentation IS NULL FROM enigma_themes WHERE id = 'byzantine'), 'vides';
  ASSERT NOT has_function_privilege('anon', 'public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, integer, text, text)', 'execute'), 'fermée aux anonymes';
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
