-- 148_drop_legacy_contribute_to_place_5args.sql
-- WHY : 2 versions de contribute_to_place coexistaient en prod :
--   - legacy (5 args : user_id, place_id, type, content, image_url)
--   - V0.7+ (7 args : + p_era_id text, p_year_exact integer, avec auth check
--     et délégation à _contribute_to_place_internal)
-- Le front appelle avec 4 args (le DEFAULT NULL gère image_url/era_id/year_exact).
-- PostgREST n'arrivait pas à choisir entre les 2 → erreur PGRST203
-- "Could not choose the best candidate function" → le front voyait "rien
-- ne se passe" sur clic Enregistrer (saison/accessibilité/époque).
--
-- Cause : la version 7-args ajoutée plus tard n'a pas dropé la legacy.
-- Fix : DROP la legacy. La 7-args reste avec ses defaults — couvre tous les cas.

DROP FUNCTION IF EXISTS public.contribute_to_place(text, text, text, text, text);

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM pg_proc WHERE proname = 'contribute_to_place';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 contribute_to_place function after DROP, got %', v_count;
  END IF;
END $$;
