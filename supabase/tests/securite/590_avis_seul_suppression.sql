-- 588-590 : un avis seul s'enregistre sans compte (user_id NULL), même avec l'e-mail d'un compte ;
-- supprimer ce compte anonymise aussi ses avis seuls, et pas ceux des autres. Annulé.
BEGIN;
DO $test$
DECLARE
  moi text := gen_random_uuid()::text;
  r text := ''; s record;
BEGIN
  INSERT INTO users (id, email_address, first_name, role, is_active, rank, biography)
  VALUES (moi, 'essai.avis@example.com', 'Essai', 'user', true, 0, '');

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  PERFORM public.deposer_contenu('Essai.Avis@Example.com', 'Essai', '[]'::jsonb, true, false, 'Très doux', null, null, null, null, 5, null, 'tshirt');
  PERFORM public.deposer_contenu('autre.avis@example.com', 'Autre', '[]'::jsonb, true, false, null, null, null, null, 4, null, null, 'sweatshirt');
  RESET ROLE;
  SELECT user_id INTO s FROM hub_photo_submissions WHERE submitter_email = 'essai.avis@example.com';
  r := r || ' compte=' || coalesce(s.user_id, 'aucun');

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', moi)::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.supprimer_mon_compte();
  RESET ROLE;

  r := r || ' restant=' || (SELECT count(*) FROM hub_photo_submissions WHERE submitter_email = 'essai.avis@example.com');
  r := r || ' autre=' || (SELECT count(*) FROM hub_photo_submissions WHERE submitter_email = 'autre.avis@example.com');
  RAISE EXCEPTION 'BILAN% (attendu : compte=aucun restant=0 autre=1)', r;
END $test$;
ROLLBACK;
