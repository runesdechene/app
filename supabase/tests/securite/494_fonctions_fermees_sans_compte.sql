-- 494 : sans compte, la vitrine marche et le reste se ferme ; connecté et serveur : inchangé. Annulé.
BEGIN;
\ir ../../migrations/494_fonctions_fermees_sans_compte.sql
DO $test$
DECLARE r text := '';
  ouvrir text[] := ARRAY['get_landing_stats','lieux_au_hasard','carte_publique','recherche_publique','get_community_photos_by_product','compagnie_par_lien','recit_du_fragment','get_studio_config'];
  fermer text[] := ARRAY['fiche_lieu','moderate_submission','saluer','revisit_place_gps','get_my_preferences','set_submission_image_status'];
  x text; ok boolean;
BEGIN
  FOREACH x IN ARRAY ouvrir LOOP
    SELECT bool_and(has_function_privilege('anon', p.oid, 'EXECUTE')) INTO ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=x;
    IF ok IS NOT TRUE THEN r := r || ' FERME_A_TORT:' || x; END IF;
  END LOOP;
  FOREACH x IN ARRAY fermer LOOP
    SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) INTO ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=x;
    IF ok THEN r := r || ' OUVERT:' || x; END IF;
  END LOOP;
  SELECT r || ' connecte_fiche=' || has_function_privilege('authenticated', 'public.fiche_lieu(text)', 'EXECUTE')
           || ' serveur_fiche=' || has_function_privilege('service_role', 'public.fiche_lieu(text)', 'EXECUTE')
           || ' connecte_helper_interne=' || has_function_privilege('authenticated', 'public._lieu_public(text)', 'EXECUTE')
           || ' anon_definer_restants=' || (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE'))
    INTO r;
  -- Un appel réel, sans compte.
  SET LOCAL ROLE anon;
  PERFORM public.get_landing_stats();
  BEGIN PERFORM public.fiche_lieu('x'); r := r || ' appel_fiche_anon=PASSE'; EXCEPTION WHEN insufficient_privilege THEN r := r || ' appel_fiche_anon=refus'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN% (attendu : rien à tort, connecte true, serveur true, helper false, appel refusé)', r;
END $test$;
ROLLBACK;
